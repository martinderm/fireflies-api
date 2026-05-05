import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';
import { LIST_MEETINGS_FIELDS, buildGetMeetingQuery, buildListMeetingsRequest } from './_fireflies-meetings.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const meetingsRoot = path.join(workspaceRoot, 'memory', 'references', 'meetings');
const meetingsJsonPath = path.join(meetingsRoot, 'meetings.json');
const ACCOUNT_REF = process.env.FIREFLIES_ACCOUNT || null;
const ENDPOINT = 'https://api.fireflies.ai/graphql';
const CLOUD_TITLE_SUFFIX = ' (syncd)';
const UPDATE_MEETING_TITLE_MUTATION = `mutation UpdateMeetingTitle($input: UpdateMeetingTitleInput!) {
  updateMeetingTitle(input: $input) {
    title
  }
}`;

function buildChannelStrategy() {
  return {
    mode: 'scarce_channels',
    max_channels: 3,
    channels_are_taxonomy: false,
    classification_source_of_truth: 'chat_review_classification'
  };
}

function parseArgs(argv) {
  const args = { limit: 10, skip: 0, mode: 'new', refreshChanged: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--limit' && next) {
      args.limit = Number(next);
      i += 1;
    } else if (arg === '--skip' && next) {
      args.skip = Number(next);
      i += 1;
    } else if (arg === '--mode' && next) {
      args.mode = next;
      i += 1;
    } else if (arg === '--meeting-id' && next) {
      args.meetingId = next;
      i += 1;
    } else if (arg === '--context-channel-slug' && next) {
      args.contextChannelSlug = slugify(next);
      i += 1;
    } else if (arg === '--context-channel-title' && next) {
      args.contextChannelTitle = next;
      i += 1;
    } else if (arg === '--refresh-changed') {
      args.refreshChanged = true;
    }
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildDefaultChannelMapping(channel) {
  return {
    channel_id: channel?.id ?? null,
    channel_title: channel?.title ?? null,
    routing_mode: 'unmapped',
    project_slug: null,
    topic_slug: null,
    mapping_source: 'unmapped',
    notes: 'Automatisch beim Meeting-Sync angelegt; Routing erfolgt später im Chat-Review.'
  };
}

function normalizeMeetingsState(raw) {
  const state = raw && typeof raw === 'object' ? raw : {};
  const previousStrategy = state.channel_strategy ?? {};
  const normalized = {
    channel_strategy: {
      ...buildChannelStrategy(),
      ...previousStrategy,
      classification_source_of_truth: 'chat_review_classification'
    },
    channel_mappings: state.channel_mappings && typeof state.channel_mappings === 'object' ? state.channel_mappings : {},
    meetings: Array.isArray(state.meetings) ? state.meetings : []
  };

  for (const [channelSlug, mapping] of Object.entries(normalized.channel_mappings)) {
    const next = mapping && typeof mapping === 'object' ? mapping : {};
    if (!next.routing_mode) {
      next.routing_mode = 'unmapped';
    }
    delete next.channel_role;
    normalized.channel_mappings[channelSlug] = next;
  }

  delete normalized.channel_strategy.primary_context_channel_slug;
  return normalized;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'ohne-channel';
}

function stripCloudSuffix(title, suffix = CLOUD_TITLE_SUFFIX) {
  const baseTitle = String(title ?? '').trim();
  if (!baseTitle) return baseTitle;
  return baseTitle.endsWith(suffix) ? baseTitle.slice(0, -suffix.length).trimEnd() : baseTitle;
}

function ensureCloudSuffix(title, suffix = CLOUD_TITLE_SUFFIX) {
  const baseTitle = String(title ?? '').trim();
  if (!baseTitle) return baseTitle;
  return baseTitle.endsWith(suffix) ? baseTitle : `${baseTitle}${suffix}`;
}

async function maybeUpdateCloudTitle(meetingId, cloudTitle) {
  const current = String(cloudTitle ?? '').trim();
  const desiredTitle = ensureCloudSuffix(current);
  if (!desiredTitle || desiredTitle === current) {
    return { updated: false, title: current };
  }

  const data = await firefliesGraphQL({
    query: UPDATE_MEETING_TITLE_MUTATION,
    variables: { input: { id: meetingId, title: desiredTitle } }
  });

  return {
    updated: true,
    title: data?.updateMeetingTitle?.title ?? desiredTitle
  };
}

function yamlString(value) {
  if (value === null || value === undefined) return 'null';
  return JSON.stringify(String(value));
}

function yamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return yamlString(value);
}

function yamlInline(value, fallback = []) {
  const resolved = value === null || value === undefined ? fallback : value;
  return JSON.stringify(resolved);
}

function listSpeakerNames(meeting) {
  return (meeting.speakers ?? []).map((speaker) => speaker.name).filter(Boolean);
}

function listChannelTitles(meeting) {
  return (meeting.channels ?? []).map((channel) => channel.title).filter(Boolean);
}

function secondsToClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function linesFromText(value) {
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function bullets(lines) {
  if (!lines.length) return '-';
  return lines.map((line) => `- ${line}`).join('\n');
}

function buildHaystack(meeting) {
  const parts = [
    meeting.title,
    meeting.organizer_email,
    meeting.host_email,
    meeting.participants?.join(' '),
    listSpeakerNames(meeting).join(' '),
    listChannelTitles(meeting).join(' '),
    meeting.summary?.keywords?.join(' '),
    meeting.summary?.overview,
    meeting.summary?.short_summary,
    meeting.summary?.short_overview,
    meeting.summary?.bullet_gist,
    meeting.summary?.gist,
    meeting.summary?.action_items,
    meeting.summary?.shorthand_bullet,
    meeting.apps_preview?.outputs?.map((x) => `${x.title} ${x.prompt} ${x.response}`).join(' ')
  ];
  return normalizeText(parts.filter(Boolean).join(' \n '));
}

function computeMeetingFingerprint(meeting) {
  const payload = {
    title: meeting.title ?? null,
    dateString: meeting.dateString ?? null,
    duration: meeting.duration ?? null,
    channels: (meeting.channels ?? []).map((channel) => ({ id: channel.id, title: channel.title, is_private: channel.is_private ?? null })),
    speakers: (meeting.speakers ?? []).map((speaker) => ({ id: speaker.id, name: speaker.name })),
    summary: meeting.summary ?? null,
    sentences: (meeting.sentences ?? []).map((sentence) => ({
      index: sentence.index,
      speaker_name: sentence.speaker_name,
      speaker_id: sentence.speaker_id,
      text: sentence.text,
      raw_text: sentence.raw_text,
      start_time: sentence.start_time,
      end_time: sentence.end_time
    })),
    apps_preview: meeting.apps_preview ?? null,
    shared_with: meeting.shared_with ?? []
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function classifyMeeting(meeting, channelMapping, channelSlug) {
  const channelEvidence = channelSlug ? `channel:${channelSlug}` : null;

  return {
    project_slug: null,
    topic_slug: null,
    project_slugs: [],
    topic_slugs: [],
    project_matches: [],
    topic_matches: [],
    classification_notes: ['chat-review-classification-pending'],
    classification_basis: channelEvidence ? [channelEvidence] : [],
    classification_status: 'unmapped',
    classification_confidence: 'low',
    review_recommended: true,
    review_reason: channelMapping ? 'chat-review-classification-required' : 'missing-channel-mapping',
    classifier_mode: 'chat-review'
  };
}

function buildFrontmatter(meta) {
  return [
    '---',
    `meeting_id: ${yamlString(meta.meeting_id)}`,
    `title: ${yamlString(meta.title)}`,
    `slug: ${yamlString(meta.slug)}`,
    `date: ${yamlScalar(meta.date)}`,
    `dateString: ${yamlString(meta.dateString)}`,
    `duration: ${yamlScalar(meta.duration)}`,
    `channel: ${yamlScalar(meta.channel)}`,
    `channel_slug: ${yamlString(meta.channel_slug)}`,
    `channel_id: ${yamlScalar(meta.channel_id)}`,
    `channels: ${yamlInline(meta.channels)}`,
    `project_slug: ${yamlScalar(meta.project_slug)}`,
    `topic_slug: ${yamlScalar(meta.topic_slug)}`,
    `classification_status: ${yamlString(meta.classification_status)}`,
    `classification_confidence: ${yamlString(meta.classification_confidence)}`,
    `classification_notes: ${yamlInline(meta.classification_notes)}`,
    `classification_basis: ${yamlInline(meta.classification_basis)}`,
    `review_recommended: ${yamlScalar(meta.review_recommended)}`,
    `review_reason: ${yamlScalar(meta.review_reason)}`,
    `llm_review_status: ${yamlScalar(meta.llm_review_status)}`,
    `transcript_url: ${yamlString(meta.transcript_url)}`,
    `meeting_link: ${yamlScalar(meta.meeting_link)}`,
    `organizer_email: ${yamlScalar(meta.organizer_email)}`,
    `host_email: ${yamlScalar(meta.host_email)}`,
    `calendar_id: ${yamlScalar(meta.calendar_id)}`,
    `cal_id: ${yamlScalar(meta.cal_id)}`,
    `calendar_type: ${yamlScalar(meta.calendar_type)}`,
    `participants_count: ${yamlScalar(meta.participants_count)}`,
    `participants: ${yamlInline(meta.participants)}`,
    `speakers_count: ${yamlScalar(meta.speakers_count)}`,
    `speakers: ${yamlInline(meta.speakers)}`,
    `meeting_attendees_count: ${yamlScalar(meta.meeting_attendees_count)}`,
    `meeting_attendance_count: ${yamlScalar(meta.meeting_attendance_count)}`,
    `shared_with_count: ${yamlScalar(meta.shared_with_count)}`,
    `shared_with: ${yamlInline(meta.shared_with)}`,
    `apps_present: ${yamlScalar(meta.apps_present)}`,
    `apps_count: ${yamlScalar(meta.apps_count)}`,
    `meeting_info_fred_joined: ${yamlScalar(meta.meeting_info_fred_joined)}`,
    `meeting_info_silent_meeting: ${yamlScalar(meta.meeting_info_silent_meeting)}`,
    `meeting_info_summary_status: ${yamlScalar(meta.meeting_info_summary_status)}`,
    `has_summary: ${yamlScalar(meta.has_summary)}`,
    `has_full_transcript: ${yamlScalar(meta.has_full_transcript)}`,
    `audio_url_present: ${yamlScalar(meta.audio_url_present)}`,
    `video_url_present: ${yamlScalar(meta.video_url_present)}`,
    `analytics_present: ${yamlScalar(meta.analytics_present)}`,
    `summary_keywords: ${yamlInline(meta.summary_keywords)}`,
    `summary_meeting_type: ${yamlScalar(meta.summary_meeting_type)}`,
    `summary_topics_discussed: ${yamlInline(meta.summary_topics_discussed)}`,
    `summary_has_notes: ${yamlScalar(meta.summary_has_notes)}`,
    `summary_extended_sections_count: ${yamlScalar(meta.summary_extended_sections_count)}`,
    `summary_path: ${yamlString(meta.summary_path)}`,
    `transcript_path: ${yamlString(meta.transcript_path)}`,
    `server_change_status: ${yamlString(meta.server_change_status)}`,
    `server_changed_since_last_sync: ${yamlScalar(meta.server_changed_since_last_sync)}`,
    `first_synced_at: ${yamlString(meta.first_synced_at)}`,
    `last_synced_at: ${yamlString(meta.last_synced_at)}`,
    `source_system: "fireflies"`,
    `source_account_ref: ${yamlString(ACCOUNT_REF)}`,
    '---',
    ''
  ].join('\n');
}

function buildSummaryMarkdown(meta, meeting, notes) {
  const fm = buildFrontmatter(meta);
  const participants = (meeting.participants ?? []).length ? meeting.participants.join(', ') : '-';
  const speakers = listSpeakerNames(meeting).length
    ? listSpeakerNames(meeting).join(', ')
    : '-';
  const channels = listChannelTitles(meeting).length
    ? listChannelTitles(meeting).join(', ')
    : '-';

  const summary = meeting.summary ?? {};
  const executive = summary.short_summary || summary.gist || summary.overview || '-';
  const keyPoints = bullets(linesFromText(summary.bullet_gist || summary.overview));
  const actionItems = bullets(linesFromText(summary.action_items));
  const openQuestions = bullets(linesFromText(summary.outline));
  const detailedNotes = String(summary.notes ?? '').trim();
  const extendedSections = Array.isArray(summary.extended_sections) ? summary.extended_sections : [];
  const extendedSectionsMd = extendedSections.length
    ? extendedSections.map((section) => `#### ${section.title ?? 'Ohne Titel'}\n${String(section.content ?? '').trim() || '-'}`).join('\n\n')
    : '-';

  return `${fm}# ${meeting.title}\n\n## Kurzüberblick\n- Datum: ${meeting.dateString ?? '-'}\n- Dauer: ${meeting.duration ?? '-'}\n- Channel: ${meta.channel ?? '-'}\n- Organizer: ${meeting.organizer_email ?? '-'}\n- Teilnehmer: ${participants}\n- Transcript URL: ${meeting.transcript_url ?? '-'}\n\n## Summary\n\n### Executive Summary\n${executive}\n\n### Key Points\n${keyPoints}\n\n### Decisions\n-\n\n### Action Items\n${actionItems}\n\n### Open Questions\n${openQuestions}\n\n### Detailed Notes\n${detailedNotes || '-'}\n\n### Extended Sections\n${extendedSectionsMd}\n\n### Participants and Speakers\n- Teilnehmer: ${participants}\n- Speakers: ${speakers}\n\n### Analytics Snapshot\n- Sentiment: nicht abgefragt\n- Kategorien: nicht abgefragt\n- Speaker Insights: nicht abgefragt\n\n### Related Systems\n- Meeting Link: ${meeting.meeting_link ?? '-'}\n- Calendar: ${meeting.calendar_id ?? '-'}\n- Channels: ${channels}\n- Shared With: ${(meeting.shared_with ?? []).length ? meeting.shared_with.map((x) => x.email || x.name).join(', ') : '-'}\n\n### Source Notes\n- Fireflies Meeting ID: ${meeting.id}\n- Last Synced: ${meta.last_synced_at}\n- Data Completeness: Summary + Volltranskript lokal gespiegelt\n- Classification Notes: ${notes.length ? notes.join('; ') : '-'}\n`;
}

function buildTranscriptMarkdown(meta, meeting) {
  const fm = buildFrontmatter(meta);
  const sentences = (meeting.sentences ?? []).length
    ? meeting.sentences.map((sentence) => `#### ${secondsToClock(sentence.start_time)} ${sentence.speaker_name ?? 'Unknown Speaker'}\n${sentence.text ?? sentence.raw_text ?? ''}`).join('\n\n')
    : '_Keine Satzdaten verfügbar._';

  return `${fm}# ${meeting.title} - Volltranskript\n\n## Metadaten\n- Meeting ID: ${meeting.id}\n- Datum: ${meeting.dateString ?? '-'}\n- Dauer: ${meeting.duration ?? '-'}\n- Channel: ${meta.channel ?? '-'}\n- Transcript URL: ${meeting.transcript_url ?? '-'}\n\n## Volltranskript\n\n${sentences}\n`;
}

function buildReviewInput(meeting, channelMapping, classified, channelTitle, channelSlug) {
  return {
    source: 'sync-intake',
    title: meeting.title ?? null,
    channel: channelTitle,
    channel_slug: channelSlug,
    routing_mode: channelMapping?.routing_mode ?? null,
    keywords: meeting.summary?.keywords ?? [],
    project_slug: null,
    topic_slug: null,
    classification_status: classified.classification_status,
    classification_confidence: classified.classification_confidence,
    classification_basis: classified.classification_basis,
    review_recommended: classified.review_recommended,
    review_reason: classified.review_reason
  };
}

function relativeWorkspacePath(absPath) {
  return path.relative(workspaceRoot, absPath).replace(/\\/g, '/');
}

function upsertMeeting(existingMeetings, entry) {
  const index = existingMeetings.findIndex((meeting) => meeting.meeting_id === entry.meeting_id);
  if (index >= 0) {
    existingMeetings[index] = entry;
  } else {
    existingMeetings.push(entry);
  }
}

const args = parseArgs(process.argv.slice(2));

if (Number.isNaN(args.limit) || args.limit < 1 || args.limit > 50) {
  printError(new Error('limit_must_be_between_1_and_50'));
  process.exit(2);
}

if (!['new', 'all'].includes(args.mode)) {
  printError(new Error('mode_must_be_new_or_all'));
  process.exit(2);
}

const detailQuery = buildGetMeetingQuery('full');

try {
  const meetingsState = normalizeMeetingsState(readJson(meetingsJsonPath, null));

  const knownMeetingsById = new Map((meetingsState.meetings ?? []).map((meeting) => [meeting.meeting_id, meeting]));
  let listedMeetings;

  if (args.meetingId) {
    listedMeetings = [{ id: args.meetingId, title: null }];
  } else if (args.refreshChanged) {
    listedMeetings = (meetingsState.meetings ?? []).map((meeting) => ({ id: meeting.meeting_id, title: meeting.title ?? null }));
  } else {
    const listOptions = {
      limit: args.limit,
      skip: args.skip,
      ...(args.contextChannelSlug && meetingsState.channel_mappings?.[args.contextChannelSlug]?.channel_id
        ? { channel_id: meetingsState.channel_mappings[args.contextChannelSlug].channel_id }
        : {})
    };
    const { query: listQuery, variables: listVariables } = buildListMeetingsRequest(
      listOptions,
      LIST_MEETINGS_FIELDS
    );

    const listed = await firefliesGraphQL({
      query: listQuery,
      variables: listVariables
    });

    listedMeetings = listed.transcripts ?? [];
  }

  const candidates = listedMeetings.filter((meeting) => args.mode === 'all' || !knownMeetingsById.has(meeting.id) || args.meetingId || args.refreshChanged);

  const processed = [];
  ensureDir(meetingsRoot);

  for (const listedMeeting of candidates) {
    const detailData = await firefliesGraphQL({
      query: detailQuery,
      variables: { transcriptId: listedMeeting.id }
    });

    const meeting = detailData?.transcript;
    if (!meeting) continue;

    const localMeeting = {
      ...meeting,
      title: stripCloudSuffix(meeting.title)
    };

    const firstChannel = localMeeting.channels?.[0] ?? null;
    const channelTitle = firstChannel?.title ?? null;
    const channelSlug = firstChannel?.title ? slugify(firstChannel.title) : 'ohne-channel';

    if (firstChannel && !meetingsState.channel_mappings[channelSlug]) {
      meetingsState.channel_mappings[channelSlug] = buildDefaultChannelMapping(firstChannel);
    } else if (!firstChannel && args.contextChannelSlug && !meetingsState.channel_mappings[args.contextChannelSlug]) {
      meetingsState.channel_mappings[args.contextChannelSlug] = buildDefaultChannelMapping({ id: null, title: args.contextChannelTitle ?? null });
    }

    const channelMapping = meetingsState.channel_mappings[channelSlug] ?? null;
    if (channelMapping) {
      channelMapping.channel_id = channelMapping.channel_id ?? firstChannel?.id ?? null;
      channelMapping.channel_title = channelMapping.channel_title ?? firstChannel?.title ?? null;
      if (!channelMapping.routing_mode) {
        channelMapping.routing_mode = 'unmapped';
      }
      delete channelMapping.channel_role;
    }

    const classified = classifyMeeting(localMeeting, channelMapping, channelSlug);

    const datePrefix = String(localMeeting.dateString ?? '').slice(0, 10) || 'undated';
    const meetingSlug = slugify(localMeeting.title);
    const folderPath = path.join(meetingsRoot, channelSlug);
    ensureDir(folderPath);

    const summaryAbsPath = path.join(folderPath, `${datePrefix}-${meetingSlug}.summary.md`);
    const transcriptAbsPath = path.join(folderPath, `${datePrefix}-${meetingSlug}.transcript.md`);
    const summaryPath = relativeWorkspacePath(summaryAbsPath);
    const transcriptPath = relativeWorkspacePath(transcriptAbsPath);
    const lastSyncedAt = new Date().toISOString();

    const fingerprint = computeMeetingFingerprint(localMeeting);
    const existingEntry = knownMeetingsById.get(meeting.id) ?? null;
    const previousFingerprint = existingEntry?.server_fingerprint ?? null;
    const serverChangeStatus = !existingEntry
      ? 'new'
      : !previousFingerprint
        ? 'unknown'
        : previousFingerprint === fingerprint
          ? 'unchanged'
          : 'changed';
    const serverChanged = serverChangeStatus === 'changed';

    const reviewInput = buildReviewInput(localMeeting, channelMapping, classified, channelTitle, channelSlug);
    const hadResolvedReview = existingEntry?.llm_review_status === 'resolved' || existingEntry?.llm_review_status === 'user-query';
    const shouldPendingReview = classified.review_recommended && (serverChangeStatus === 'new' || serverChangeStatus === 'changed' || !hadResolvedReview);
    const llmReviewStatus = shouldPendingReview
      ? 'pending'
      : existingEntry?.llm_review_status ?? (classified.review_recommended ? 'pending' : 'not-needed');
    const participantList = localMeeting.participants ?? [];
    const speakerNames = listSpeakerNames(localMeeting);
    const sharedWithList = (localMeeting.shared_with ?? []).map((entry) => entry.email || entry.name).filter(Boolean);
    const appsCount = Array.isArray(localMeeting.apps_preview?.outputs) ? localMeeting.apps_preview.outputs.length : 0;
    const firstSyncedAt = existingEntry?.first_synced_at ?? lastSyncedAt;

    const meta = {
      meeting_id: meeting.id,
      title: localMeeting.title,
      slug: meetingSlug,
      date: localMeeting.date,
      dateString: localMeeting.dateString,
      duration: localMeeting.duration,
      channel: channelTitle,
      channel_slug: channelSlug,
      channel_id: firstChannel?.id ?? null,
      channels: listChannelTitles(localMeeting),
      project_slug: classified.project_slug,
      topic_slug: classified.topic_slug,
      classification_status: classified.classification_status,
      classification_confidence: classified.classification_confidence,
      classification_notes: classified.classification_notes,
      classification_basis: classified.classification_basis,
      review_recommended: classified.review_recommended,
      review_reason: classified.review_reason,
      llm_review_status: llmReviewStatus,
      transcript_url: localMeeting.transcript_url,
      meeting_link: localMeeting.meeting_link,
      organizer_email: localMeeting.organizer_email,
      host_email: localMeeting.host_email,
      calendar_id: localMeeting.calendar_id,
      cal_id: localMeeting.cal_id,
      calendar_type: localMeeting.calendar_type,
      participants_count: participantList.length,
      participants: participantList,
      speakers_count: speakerNames.length,
      speakers: speakerNames,
      meeting_attendees_count: Array.isArray(localMeeting.meeting_attendees) ? localMeeting.meeting_attendees.length : 0,
      meeting_attendance_count: Array.isArray(localMeeting.meeting_attendance) ? localMeeting.meeting_attendance.length : 0,
      shared_with_count: sharedWithList.length,
      shared_with: sharedWithList,
      apps_present: appsCount > 0,
      apps_count: appsCount,
      meeting_info_fred_joined: localMeeting.meeting_info?.fred_joined ?? null,
      meeting_info_silent_meeting: localMeeting.meeting_info?.silent_meeting ?? null,
      meeting_info_summary_status: localMeeting.meeting_info?.summary_status ?? null,
      has_summary: Boolean(localMeeting.summary && Object.values(localMeeting.summary).some((value) => Array.isArray(value) ? value.length : Boolean(value))),
      has_full_transcript: Array.isArray(localMeeting.sentences) && localMeeting.sentences.length > 0,
      audio_url_present: false,
      video_url_present: false,
      analytics_present: false,
      summary_keywords: localMeeting.summary?.keywords ?? [],
      summary_meeting_type: localMeeting.summary?.meeting_type ?? null,
      summary_topics_discussed: localMeeting.summary?.topics_discussed ?? [],
      summary_has_notes: Boolean(String(localMeeting.summary?.notes ?? '').trim()),
      summary_extended_sections_count: Array.isArray(localMeeting.summary?.extended_sections) ? localMeeting.summary.extended_sections.length : 0,
      summary_path: summaryPath,
      transcript_path: transcriptPath,
      server_change_status: serverChangeStatus,
      server_changed_since_last_sync: serverChanged,
      first_synced_at: firstSyncedAt,
      last_synced_at: lastSyncedAt
    };

    fs.writeFileSync(summaryAbsPath, buildSummaryMarkdown(meta, localMeeting, classified.classification_notes), 'utf8');
    fs.writeFileSync(transcriptAbsPath, buildTranscriptMarkdown(meta, localMeeting), 'utf8');

    const cloudTitleUpdated = false;
    const cloudTitleError = 'skipped-no-write';

    const entry = {
      meeting_id: meeting.id,
      title: localMeeting.title,
      slug: meetingSlug,
      date: localMeeting.date,
      dateString: localMeeting.dateString,
      duration: localMeeting.duration,
      channel: channelTitle,
      channel_slug: channelSlug,
      channel_id: firstChannel?.id ?? null,
      channels: meta.channels,
      project_slug: classified.project_slug,
      topic_slug: classified.topic_slug,
      project_slugs: classified.project_slugs,
      topic_slugs: classified.topic_slugs,
      project_matches: classified.project_matches,
      topic_matches: classified.topic_matches,
      classification_status: classified.classification_status,
      classification_confidence: classified.classification_confidence,
      classification_notes: classified.classification_notes,
      classification_basis: classified.classification_basis,
      review_recommended: classified.review_recommended,
      review_reason: classified.review_reason,
      classifier_mode: classified.classifier_mode,
      review_input: reviewInput,
      llm_review_status: llmReviewStatus,
      llm_review_summary: shouldPendingReview ? null : existingEntry?.llm_review_summary ?? null,
      resolved_by: shouldPendingReview ? null : existingEntry?.resolved_by ?? null,
      resolved_at: shouldPendingReview ? null : existingEntry?.resolved_at ?? null,
      transcript_url: localMeeting.transcript_url,
      meeting_link: localMeeting.meeting_link,
      organizer_email: localMeeting.organizer_email,
      host_email: localMeeting.host_email,
      participants_count: meta.participants_count,
      speakers_count: meta.speakers_count,
      meeting_attendees_count: meta.meeting_attendees_count,
      meeting_attendance_count: meta.meeting_attendance_count,
      shared_with_count: meta.shared_with_count,
      is_live: Boolean(localMeeting.is_live),
      meeting_info_summary_status: meta.meeting_info_summary_status,
      has_summary: meta.has_summary,
      has_full_transcript: meta.has_full_transcript,
      summary_keywords: meta.summary_keywords,
      summary_has_notes: meta.summary_has_notes,
      summary_extended_sections_count: meta.summary_extended_sections_count,
      summary_path: summaryPath,
      transcript_path: transcriptPath,
      audio_url_present: meta.audio_url_present,
      video_url_present: meta.video_url_present,
      analytics_present: meta.analytics_present,
      apps_present: meta.apps_present,
      apps_count: meta.apps_count,
      server_fingerprint: fingerprint,
      server_change_status: serverChangeStatus,
      server_changed_since_last_sync: serverChanged,
      first_synced_at: firstSyncedAt,
      last_synced_at: lastSyncedAt,
      source: {
        system: 'fireflies',
        account_ref: ACCOUNT_REF,
        endpoint: ENDPOINT
      }
    };

    upsertMeeting(meetingsState.meetings, entry);

    processed.push({
      meeting_id: meeting.id,
      title: localMeeting.title,
      channel_slug: channelSlug,
      project_slug: classified.project_slug,
      topic_slug: classified.topic_slug,
      project_slugs: classified.project_slugs,
      topic_slugs: classified.topic_slugs,
      classification_status: classified.classification_status,
      classification_confidence: classified.classification_confidence,
      classification_basis: classified.classification_basis,
      review_recommended: classified.review_recommended,
      review_reason: classified.review_reason,
      classifier_mode: classified.classifier_mode,
      llm_review_status: llmReviewStatus,
      server_change_status: serverChangeStatus,
      server_changed_since_last_sync: serverChanged,
      cloud_title_updated: cloudTitleUpdated,
      cloud_title_error: cloudTitleError,
      summary_path: summaryPath,
      transcript_path: transcriptPath
    });
  }

  meetingsState.meetings.sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
  writeJson(meetingsJsonPath, meetingsState);

  printJson({
    ok: true,
    mode: args.mode,
    refresh_changed: args.refreshChanged,
    meeting_id: args.meetingId ?? null,
    listed: listedMeetings.length,
    synced: processed.length,
    skipped_existing: args.mode === 'new' && !args.meetingId && !args.refreshChanged ? (listedMeetings.length - processed.length) : 0,
    meetings: processed,
    meetings_json: relativeWorkspacePath(meetingsJsonPath)
  });
} catch (error) {
  printError(error);
  process.exit(1);
}
