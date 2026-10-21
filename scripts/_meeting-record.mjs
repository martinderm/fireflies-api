import { renderTranscriptMarkdown, slugify } from './_fireflies-meetings.mjs';

export const RECORD_SCHEMA = 'meeting-record/1';
export const RECORD_SOURCE_SYSTEMS = Object.freeze(['fireflies', 'ticnote', 'zoom', 'manual', 'vimeo-webvtt']);
export const RECORD_ROOT_KEYS = Object.freeze([
  'schema',
  'source',
  'meeting_id',
  'title',
  'start',
  'duration_minutes',
  'participants',
  'artifacts',
  'classification_hint',
  'review',
  'source_metadata'
]);

export const RECORD_LIMITS = Object.freeze({
  max_depth: 32,
  max_array_items: 5000,
  max_string_bytes: 524_288,
  max_record_bytes: 1_048_576,
  max_source_metadata_bytes: 65_536,
  max_identity_chars: 512
});

const CLOUD_TITLE_SUFFIX = ' (syncd)';
const START_KEYS = ['utc', 'calendar_date', 'estimated', 'basis'];
const SOURCE_KEYS = ['system', 'account_ref', 'external_id'];
const ARTIFACT_KEYS = ['summary_md', 'transcript_md', 'transcript_raw_md'];
const HINT_KEYS = ['topic_slug', 'project_slug', 'event_slug', 'basis'];
const REVIEW_KEYS = ['recommended', 'reason'];
const RFC3339_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class RecordValidationError extends Error {
  constructor(code, message, path = '$') {
    super(`${code}:${path}:${message}`);
    this.name = 'RecordValidationError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path, message) {
  throw new RecordValidationError(code, message, path);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripCloudSuffix(title) {
  const baseTitle = String(title ?? '').trim();
  if (!baseTitle) return '';
  return baseTitle.endsWith(CLOUD_TITLE_SUFFIX)
    ? baseTitle.slice(0, -CLOUD_TITLE_SUFFIX.length).trimEnd()
    : baseTitle;
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function durationMetadata(value) {
  const type = value === undefined
    ? 'missing'
    : value === null
      ? 'null'
      : Array.isArray(value)
        ? 'array'
        : typeof value;
  const normalized = normalizeDuration(value);
  const nonFiniteNumber = typeof value === 'number' && !Number.isFinite(value);
  return {
    raw: value === undefined || nonFiniteNumber ? null : value,
    type: nonFiniteNumber ? 'nonfinite-number' : type,
    repr: nonFiniteNumber ? String(value) : null,
    normalized,
    status: value === undefined || value === null
      ? 'missing'
      : normalized === null
        ? 'invalid'
        : 'valid'
  };
}

function normalizeParticipants(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const participants = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    participants.push(normalized);
  }
  return participants;
}

function unknownStart() {
  return { utc: null, calendar_date: null, estimated: true, basis: ['unknown'] };
}

export function buildStart(meeting) {
  const epoch = finiteNumber(meeting?.date);
  if (epoch !== null) {
    const instant = new Date(epoch);
    if (!Number.isNaN(instant.getTime())) {
      const utc = instant.toISOString();
      return {
        utc,
        calendar_date: utc.slice(0, 10),
        estimated: false,
        basis: ['provider-epoch-ms']
      };
    }
  }

  const raw = typeof meeting?.dateString === 'string' ? meeting.dateString.trim() : '';
  if (!raw) return unknownStart();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return {
      utc: null,
      calendar_date: validCalendarDate(raw) ? raw : null,
      estimated: true,
      basis: ['date-only']
    };
  }

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
    const datePart = raw.slice(0, 10);
    const calendarDate = validCalendarDate(datePart) ? datePart : null;
    if (!calendarDate) {
      return { utc: null, calendar_date: null, estimated: true, basis: ['invalid-provider-date'] };
    }
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
      const parsed = new Date(raw.replace(' ', 'T'));
      if (!Number.isNaN(parsed.getTime())) {
        return {
          utc: parsed.toISOString(),
          calendar_date: calendarDate,
          estimated: false,
          basis: ['provider-datestring-zone']
        };
      }
    }
    return {
      utc: null,
      calendar_date: calendarDate,
      estimated: true,
      basis: ['local-time-without-zone']
    };
  }

  return { utc: null, calendar_date: null, estimated: true, basis: ['invalid-provider-date'] };
}

function listText(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim() !== '');
  }
  return [];
}

function firstChannel(meeting) {
  const channels = Array.isArray(meeting?.channels) ? meeting.channels : [];
  const channel = channels.find((entry) => isPlainObject(entry));
  return channel ?? null;
}

const SUMMARY_CONTENT_FIELDS = [
  'short_summary',
  'short_overview',
  'gist',
  'overview',
  'bullet_gist',
  'shorthand_bullet',
  'action_items',
  'outline',
  'notes'
];

function hasSummaryContent(summary) {
  if (!isPlainObject(summary)) return false;
  const hasTextField = SUMMARY_CONTENT_FIELDS.some((field) => (
    typeof summary[field] === 'string' && summary[field].trim() !== ''
  ));
  if (hasTextField) return true;
  const extendedSections = Array.isArray(summary.extended_sections) ? summary.extended_sections : [];
  return extendedSections.some((section) => (
    isPlainObject(section)
    && typeof section.content === 'string'
    && section.content.trim() !== ''
  ));
}

function artifactCoverage(meeting) {
  const parts = [];
  if (hasSummaryContent(meeting?.summary)) parts.push('Summary');
  const sentences = Array.isArray(meeting?.sentences) ? meeting.sentences : [];
  if (sentences.length > 0) parts.push('Volltranskript');
  if (buildRawTranscript(sentences) !== null) parts.push('Rohtranskript');
  return parts.length ? `${parts.join(' + ')} lokal gespiegelt` : 'keine Artefakte';
}

function summaryLines(value, prefix = '- ') {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${prefix}${line}`)
    .join('\n') || '-';
}

export function renderSummaryMarkdown(meeting) {
  if (!hasSummaryContent(meeting?.summary)) return null;

  const title = stripCloudSuffix(meeting?.title) || 'Untitled meeting';
  const summary = meeting.summary;
  const participants = normalizeParticipants(meeting?.participants);
  const speakers = (Array.isArray(meeting?.speakers) ? meeting.speakers : [])
    .map((speaker) => speaker?.name)
    .filter((name) => typeof name === 'string' && name.trim() !== '');
  const channels = listText((Array.isArray(meeting?.channels) ? meeting.channels : []).map((channel) => channel?.title));
  const extendedSections = Array.isArray(summary.extended_sections)
    ? summary.extended_sections.filter(isPlainObject)
    : [];
  const executive = summary.short_summary || summary.gist || summary.overview || '-';
  const detailedNotes = String(summary.notes ?? '').trim() || '-';
  const extendedMarkdown = extendedSections.length
    ? extendedSections
      .map((section) => `#### ${String(section.title ?? 'Ohne Titel')}\n${String(section.content ?? '').trim() || '-'}`)
      .join('\n\n')
    : '-';

  return [
    `# ${title}`,
    '',
    '## Kurzüberblick',
    `- Datum: ${meeting?.dateString ?? '-'}`,
    `- Dauer: ${meeting?.duration ?? '-'}`,
    `- Channel: ${firstChannel(meeting)?.title ?? '-'}`,
    `- Organizer: ${meeting?.organizer_email ?? '-'}`,
    `- Teilnehmer: ${participants.length ? participants.join(', ') : '-'}`,
    `- Transcript URL: ${meeting?.transcript_url ?? '-'}`,
    '',
    '## Summary',
    '',
    '### Executive Summary',
    String(executive).trim() || '-',
    '',
    '### Key Points',
    summaryLines([summary.overview, summary.bullet_gist].filter((value) => typeof value === 'string' && value.trim() !== '').join('\n')),
    '',
    '### Decisions',
    '-',
    '',
    '### Action Items',
    summaryLines(summary.action_items),
    '',
    '### Open Questions',
    summaryLines(summary.outline),
    '',
    '### Detailed Notes',
    detailedNotes,
    '',
    '### Extended Sections',
    extendedMarkdown,
    '',
    '### Participants and Speakers',
    `- Teilnehmer: ${participants.length ? participants.join(', ') : '-'}`,
    `- Speakers: ${speakers.length ? speakers.join(', ') : '-'}`,
    '',
    '### Analytics Snapshot',
    '- Sentiment: nicht abgefragt',
    '- Kategorien: nicht abgefragt',
    '- Speaker Insights: nicht abgefragt',
    '',
    '### Related Systems',
    `- Meeting Link: ${meeting?.meeting_link ?? '-'}`,
    `- Calendar: ${meeting?.calendar_id ?? '-'}`,
    `- Channels: ${channels.length ? channels.join(', ') : '-'}`,
    '',
    '### Source Notes',
    `- Fireflies Meeting ID: ${meeting?.id ?? '-'}`,
    `- Data Completeness: ${artifactCoverage(meeting)}`,
    ''
  ].join('\n');
}

function rawSentenceText(sentence) {
  if (typeof sentence?.raw_text === 'string') return sentence.raw_text;
  if (typeof sentence?.text === 'string') return sentence.text;
  return null;
}

export function buildRawTranscript(sentences) {
  if (!Array.isArray(sentences)) return null;
  const parts = sentences
    .map(rawSentenceText)
    .filter((value) => value !== null);
  if (!parts.length) return null;
  const raw = parts.join('\n');
  return raw.length ? raw : null;
}

export function renderTranscriptArtifact(meeting) {
  const sentences = Array.isArray(meeting?.sentences) ? meeting.sentences : [];
  if (!sentences.length) return null;

  const title = stripCloudSuffix(meeting?.title) || 'Untitled meeting';
  return [
    `# ${title} - Volltranskript`,
    '',
    '## Metadaten',
    `- Meeting ID: ${meeting?.id ?? '-'}`,
    `- Datum: ${meeting?.dateString ?? '-'}`,
    `- Dauer: ${meeting?.duration ?? '-'}`,
    `- Channel: ${firstChannel(meeting)?.title ?? '-'}`,
    `- Transcript URL: ${meeting?.transcript_url ?? '-'}`,
    '',
    '## Volltranskript',
    '',
    renderTranscriptMarkdown(meeting, { bracketed: false }),
    ''
  ].join('\n');
}

function buildSourceMetadata(meeting, duration, providerState) {
  const channel = firstChannel(meeting);
  const channels = (Array.isArray(meeting?.channels) ? meeting.channels : [])
    .filter(isPlainObject)
    .map((entry) => ({
      id: entry.id ?? null,
      title: entry.title ?? null,
      is_private: typeof entry.is_private === 'boolean' ? entry.is_private : null
    }));
  const speakers = (Array.isArray(meeting?.speakers) ? meeting.speakers : [])
    .filter(isPlainObject)
    .map((entry) => ({ id: entry.id ?? null, name: entry.name ?? null }));
  const sharedWith = (Array.isArray(meeting?.shared_with) ? meeting.shared_with : [])
    .filter(isPlainObject)
    .map((entry) => ({
      email: entry.email ?? null,
      name: entry.name ?? null,
      expires_at: entry.expires_at ?? null
    }));
  const summary = isPlainObject(meeting?.summary) ? meeting.summary : {};
  const extendedSections = Array.isArray(summary.extended_sections) ? summary.extended_sections : [];

  return {
    provider: 'fireflies',
    provider_meeting_id: meeting?.id ?? null,
    provider_title: meeting?.title ?? null,
    provider_date: finiteNumber(meeting?.date),
    provider_date_string: typeof meeting?.dateString === 'string' ? meeting.dateString : null,
    provider_duration_raw: duration.raw,
    provider_duration_raw_type: duration.type,
    provider_duration_raw_repr: duration.repr,
    provider_duration_minutes: duration.normalized,
    provider_duration_status: duration.status,
    channel_id: channel?.id ?? null,
    channel_title: channel?.title ?? null,
    channel_slug: channel?.title ? slugify(channel.title) : null,
    channels,
    organizer_email: meeting?.organizer_email ?? null,
    host_email: meeting?.host_email ?? null,
    transcript_url: meeting?.transcript_url ?? null,
    meeting_link: meeting?.meeting_link ?? null,
    calendar_id: meeting?.calendar_id ?? null,
    cal_id: meeting?.cal_id ?? null,
    calendar_type: meeting?.calendar_type ?? null,
    participants_count: Array.isArray(meeting?.participants) ? meeting.participants.length : 0,
    speakers,
    speakers_count: speakers.length,
    meeting_attendees_count: Array.isArray(meeting?.meeting_attendees) ? meeting.meeting_attendees.length : 0,
    meeting_attendance_count: Array.isArray(meeting?.meeting_attendance) ? meeting.meeting_attendance.length : 0,
    shared_with: sharedWith,
    apps_count: Array.isArray(meeting?.apps_preview?.outputs) ? meeting.apps_preview.outputs.length : 0,
    is_live: Boolean(meeting?.is_live),
    meeting_info: isPlainObject(meeting?.meeting_info)
      ? {
        fred_joined: meeting.meeting_info.fred_joined ?? null,
        silent_meeting: meeting.meeting_info.silent_meeting ?? null,
        summary_status: meeting.meeting_info.summary_status ?? null
      }
      : null,
    meeting_info_summary_status: meeting?.meeting_info?.summary_status ?? null,
    has_summary: hasSummaryContent(summary),
    has_full_transcript: Array.isArray(meeting?.sentences) && meeting.sentences.length > 0,
    summary_keywords: listText(summary.keywords),
    summary_meeting_type: summary.meeting_type ?? null,
    summary_topics_discussed: listText(summary.topics_discussed),
    summary_has_notes: Boolean(String(summary.notes ?? '').trim()),
    summary_extended_sections_count: extendedSections.length,
    ...(isPlainObject(providerState) ? providerState : {})
  };
}

export function buildMeetingRecord(meeting, options = {}) {
  if (!isPlainObject(meeting)) {
    throw new RecordValidationError('meeting_payload_invalid', 'meeting must be an object');
  }
  const externalId = meeting.id;
  if (typeof externalId !== 'string' || externalId.trim() === '') {
    throw new RecordValidationError('missing_provider_id', 'Fireflies meeting id is required');
  }

  const accountRef = typeof options.accountRef === 'string' && options.accountRef.trim() !== ''
    ? options.accountRef.trim()
    : null;
  const duration = durationMetadata(meeting.duration);
  const record = {
    schema: RECORD_SCHEMA,
    source: {
      system: 'fireflies',
      account_ref: accountRef,
      external_id: externalId
    },
    meeting_id: externalId,
    title: stripCloudSuffix(meeting.title) || 'Untitled meeting',
    start: buildStart(meeting),
    duration_minutes: duration.normalized,
    participants: normalizeParticipants(meeting.participants),
    artifacts: {
      summary_md: renderSummaryMarkdown(meeting),
      transcript_md: renderTranscriptArtifact(meeting),
      transcript_raw_md: buildRawTranscript(meeting.sentences)
    },
    classification_hint: {
      topic_slug: null,
      project_slug: null,
      event_slug: null,
      basis: []
    },
    review: {
      recommended: true,
      reason: 'fireflies-asr-and-name-check'
    },
    source_metadata: buildSourceMetadata(meeting, duration, options.providerState)
  };

  validateMeetingRecord(record);
  return record;
}

function assertExactKeys(value, expectedKeys, path, code = 'unknown_key') {
  if (!isPlainObject(value)) fail(`${code}_not_object`, path, 'must be an object');
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  for (const key of actual) {
    if (!expected.includes(key)) fail(code, path, `unexpected key ${key}`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) fail('missing_key', path, `missing key ${key}`);
  }
}

function assertNonEmptyString(value, path, code = 'invalid_string') {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(code, path, 'must be a non-empty string');
  }
}

function assertNullableSlug(value, path) {
  if (value === null) return;
  assertNonEmptyString(value, path, 'invalid_slug');
}

function assertStringList(value, path) {
  if (!Array.isArray(value)) fail('invalid_string_list', path, 'must be an array of strings');
  for (let index = 0; index < value.length; index += 1) {
    assertNonEmptyString(value[index], `${path}[${index}]`, 'invalid_string_list_entry');
  }
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

function assertJsonSafe(value, path, depth = 0) {
  if (depth > RECORD_LIMITS.max_depth) fail('record_too_deep', path, 'nesting exceeds the documented limit');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (hasUnpairedSurrogate(value)) fail('unpaired_surrogate', path, 'string is not valid UTF-8 text');
    if (Buffer.byteLength(value, 'utf8') > RECORD_LIMITS.max_string_bytes) {
      fail('string_too_large', path, 'string exceeds the documented byte limit');
    }
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('non_finite_number', path, 'numbers must be finite');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > RECORD_LIMITS.max_array_items) {
      fail('array_too_large', path, 'array exceeds the documented item limit');
    }
    value.forEach((entry, index) => assertJsonSafe(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      assertJsonSafe(entry, `${path}.${key}`, depth + 1);
    }
    return;
  }
  fail('unsupported_json_value', path, 'value is not JSON-safe');
}

export function validateMeetingRecord(record) {
  assertExactKeys(record, RECORD_ROOT_KEYS, '$', 'unknown_root_key');
  if (record.schema !== RECORD_SCHEMA) {
    fail('unsupported_schema', '$.schema', `expected ${RECORD_SCHEMA}`);
  }

  assertExactKeys(record.source, SOURCE_KEYS, '$.source', 'unknown_source_key');
  if (!RECORD_SOURCE_SYSTEMS.includes(record.source.system)) {
    fail('invalid_source_system', '$.source.system', 'unknown source system');
  }
  if (record.source.account_ref !== null) {
    assertNonEmptyString(record.source.account_ref, '$.source.account_ref', 'invalid_account_ref');
  }
  assertNonEmptyString(record.source.external_id, '$.source.external_id', 'missing_external_id');
  if (/[\u0000-\u001F\u007F-\u009F]/.test(record.source.external_id)) {
    fail('invalid_external_id', '$.source.external_id', 'id must not contain control characters');
  }
  if ([...record.source.external_id].length > RECORD_LIMITS.max_identity_chars) {
    fail('invalid_external_id', '$.source.external_id', 'id exceeds the 512-character identity bound');
  }

  assertNonEmptyString(record.meeting_id, '$.meeting_id', 'missing_meeting_id');
  if (/[\u0000-\u001F\u007F-\u009F]/.test(record.meeting_id)) {
    fail('invalid_meeting_id', '$.meeting_id', 'id must not contain control characters');
  }
  if ([...record.meeting_id].length > RECORD_LIMITS.max_identity_chars) {
    fail('invalid_meeting_id', '$.meeting_id', 'id exceeds the 512-character identity bound');
  }
  if (typeof record.title !== 'string') fail('invalid_title', '$.title', 'must be a string');
  if (/[\u0000-\u001F\u007F-\u009F]/.test(record.title)) {
    fail('invalid_title', '$.title', 'must not contain control characters');
  }

  assertExactKeys(record.start, START_KEYS, '$.start', 'unknown_start_key');
  if (record.start.utc !== null) {
    if (typeof record.start.utc !== 'string' || !RFC3339_WITH_ZONE.test(record.start.utc)) {
      fail('invalid_start_utc', '$.start.utc', 'must be null or RFC3339 with an explicit zone');
    }
  }
  if (record.start.calendar_date !== null && !validCalendarDate(record.start.calendar_date)) {
    fail('invalid_calendar_date', '$.start.calendar_date', 'must be null or a real ISO calendar date');
  }
  if (typeof record.start.estimated !== 'boolean') {
    fail('invalid_start_estimated', '$.start.estimated', 'must be a boolean');
  }
  assertStringList(record.start.basis, '$.start.basis');
  if (record.start.utc === null && record.start.estimated !== true) {
    fail('null_start_requires_estimate', '$.start.estimated', 'a start without UTC must be marked estimated');
  }
  if (record.start.estimated === true && record.start.basis.length === 0) {
    fail('estimated_start_requires_basis', '$.start.basis', 'an estimated start must expose its basis');
  }

  if (record.duration_minutes !== null) {
    if (typeof record.duration_minutes !== 'number' || !Number.isFinite(record.duration_minutes) || record.duration_minutes < 0) {
      fail('invalid_duration', '$.duration_minutes', 'must be null or a finite non-negative number');
    }
  }

  if (!Array.isArray(record.participants)) fail('invalid_participants', '$.participants', 'must be an array');
  record.participants.forEach((participant, index) => {
    assertNonEmptyString(participant, `$.participants[${index}]`, 'invalid_participant');
  });

  assertExactKeys(record.artifacts, ARTIFACT_KEYS, '$.artifacts', 'unknown_artifact_key');
  let artifactCount = 0;
  for (const key of ARTIFACT_KEYS) {
    const value = record.artifacts[key];
    if (value === null) continue;
    if (typeof value !== 'string') fail('invalid_artifact', `$.artifacts.${key}`, 'must be null or a string');
    if (value.length > 0) artifactCount += 1;
  }
  if (artifactCount === 0) {
    fail('record_empty_artifacts', '$.artifacts', 'at least one summary or transcript artifact must be non-empty');
  }
  if (typeof record.artifacts.transcript_md === 'string'
    && record.artifacts.transcript_md.length > 0
    && (typeof record.artifacts.transcript_raw_md !== 'string' || record.artifacts.transcript_raw_md.length === 0)) {
    fail('transcript_requires_raw', '$.artifacts.transcript_raw_md', 'a new transcript must carry its raw source bytes');
  }

  assertExactKeys(record.classification_hint, HINT_KEYS, '$.classification_hint', 'unknown_hint_key');
  assertNullableSlug(record.classification_hint.topic_slug, '$.classification_hint.topic_slug');
  assertNullableSlug(record.classification_hint.project_slug, '$.classification_hint.project_slug');
  assertNullableSlug(record.classification_hint.event_slug, '$.classification_hint.event_slug');
  assertStringList(record.classification_hint.basis, '$.classification_hint.basis');

  assertExactKeys(record.review, REVIEW_KEYS, '$.review', 'unknown_review_key');
  if (typeof record.review.recommended !== 'boolean') {
    fail('invalid_review_recommended', '$.review.recommended', 'must be a boolean');
  }
  if (record.review.reason !== null && typeof record.review.reason !== 'string') {
    fail('invalid_review_reason', '$.review.reason', 'must be null or a string');
  }

  if (!isPlainObject(record.source_metadata)) {
    fail('source_metadata_must_be_object', '$.source_metadata', 'must be an inert JSON object');
  }
  assertJsonSafe(record, '$');
  if (Buffer.byteLength(JSON.stringify(record.source_metadata), 'utf8') > RECORD_LIMITS.max_source_metadata_bytes) {
    fail('source_metadata_too_large', '$.source_metadata', 'source_metadata exceeds the writer transport bound');
  }

  let serialized;
  try {
    serialized = JSON.stringify(record);
  } catch {
    fail('record_not_serializable', '$', 'record cannot be serialized as JSON');
  }
  if (Buffer.byteLength(serialized, 'utf8') > RECORD_LIMITS.max_record_bytes) {
    fail('record_too_large', '$', 'record exceeds the documented byte limit');
  }

  return true;
}
