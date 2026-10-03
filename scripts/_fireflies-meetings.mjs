import path from 'node:path';
import { relativeWorkspacePath } from './_path-helpers.mjs';
import { yamlString, yamlDurationMinutes } from './_yaml-helpers.mjs';

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'ohne-channel';
}

export const LIST_MEETINGS_FIELDS = `
  id
  title
  date
  dateString
  duration
  transcript_url
  organizer_email
  host_email
  channels {
    id
    title
  }
`;

export const MINIMAL_MEETING_FIELDS = `
  id
  title
  date
  dateString
  duration
  transcript_url
  meeting_link
  organizer_email
  host_email
  calendar_id
  cal_id
  calendar_type
  participants
  fireflies_users
  workspace_users
  speakers {
    id
    name
  }
  meeting_attendees {
    displayName
    email
    phoneNumber
    name
    location
  }
  meeting_attendance {
    name
    join_time
    leave_time
  }
  channels {
    id
    title
    is_private
  }
  user {
    user_id
    email
    name
    is_admin
    integrations
  }
  meeting_info {
    fred_joined
    silent_meeting
    summary_status
  }
  summary {
    keywords
    action_items
    outline
    shorthand_bullet
    overview
    notes
    bullet_gist
    gist
    short_summary
    short_overview
    meeting_type
    topics_discussed
    transcript_chapters
    extended_sections {
      title
      content
    }
  }
  shared_with {
    email
    name
    expires_at
  }
  apps_preview {
    outputs {
      transcript_id
      user_id
      app_id
      created_at
      title
      prompt
      response
    }
  }
  is_live
`;

const SENTENCE_FIELDS = `  sentences {
    index
    speaker_name
    speaker_id
    text
    raw_text
    start_time
    end_time
    ai_filters {
      task
      pricing
      metric
      question
      date_and_time
      text_cleanup
      sentiment
    }
  }
`;

export const FULL_ONLY_MEETING_FIELDS = `
${SENTENCE_FIELDS}`;

export const SENTENCES_ONLY_MEETING_FIELDS = `
  id
${SENTENCE_FIELDS}`;

export const GET_MEETING_FORMATS = ['json', 'markdown'];
export const GET_MEETING_MODES = ['minimal', 'full', 'sentences-only'];

export function buildGetMeetingQuery(mode = 'minimal') {
  const fields = mode === 'sentences-only'
    ? SENTENCES_ONLY_MEETING_FIELDS
    : `${MINIMAL_MEETING_FIELDS}
    ${mode === 'full' ? FULL_ONLY_MEETING_FIELDS : ''}`;

  return `query Transcript($transcriptId: String!) {
  transcript(id: $transcriptId) {
    ${fields}
  }
}`;
}

export function buildProbeQuery(includePaid = false, includeSummary = false) {
  const lines = [
    'query ProbeMeeting($transcriptId: String!) {',
    '  transcript(id: $transcriptId) {',
    '    id',
    '    title',
    '    transcript_url',
    '    meeting_link',
    '    organizer_email',
    '    participants',
    '    speakers { id name }',
    '    meeting_attendees { displayName email phoneNumber name location }',
    '    meeting_attendance { name join_time leave_time }',
    '    channels { id title is_private }',
    '    user { user_id email name is_admin integrations }',
    '    meeting_info { fred_joined silent_meeting summary_status }',
    '    shared_with { email name expires_at }',
    '    apps_preview { outputs { transcript_id user_id app_id created_at title prompt response } }',
    '    is_live'
  ];

  if (includePaid) {
    lines.push('    audio_url', '    video_url', '    analytics { __typename }');
  }

  if (includeSummary) {
    lines.push(
      '    summary {',
      '      keywords',
      '      action_items',
      '      outline',
      '      shorthand_bullet',
      '      overview',
      '      bullet_gist',
      '      gist',
      '      short_summary',
      '      short_overview',
      '      meeting_type',
      '      topics_discussed',
      '    }'
    );
  }

  lines.push('  }', '}');
  return lines.join('\n');
}

export function buildProbeCapabilities(meeting, options = {}) {
  const paidRequested = options.paidRequested === true;
  const summaryRequested = options.summaryRequested === true;

  return {
    transcript_url: Boolean(meeting?.transcript_url),
    meeting_link: Boolean(meeting?.meeting_link),
    organizer_email: Boolean(meeting?.organizer_email),
    participants_count: Array.isArray(meeting?.participants) ? meeting.participants.length : null,
    speakers_count: Array.isArray(meeting?.speakers) ? meeting.speakers.length : null,
    meeting_attendees_count: Array.isArray(meeting?.meeting_attendees) ? meeting.meeting_attendees.length : null,
    meeting_attendance_count: Array.isArray(meeting?.meeting_attendance) ? meeting.meeting_attendance.length : null,
    channels_count: Array.isArray(meeting?.channels) ? meeting.channels.length : null,
    user_present: Boolean(meeting?.user),
    meeting_info_present: Boolean(meeting?.meeting_info),
    shared_with_count: Array.isArray(meeting?.shared_with) ? meeting.shared_with.length : null,
    apps_preview_count: Array.isArray(meeting?.apps_preview?.outputs) ? meeting.apps_preview.outputs.length : null,
    is_live: Boolean(meeting?.is_live),
    audio_url_present: paidRequested ? Boolean(meeting?.audio_url) : null,
    video_url_present: paidRequested ? Boolean(meeting?.video_url) : null,
    analytics_present: paidRequested ? Boolean(meeting?.analytics) : null,
    summary_present: summaryRequested ? Boolean(meeting?.summary) : null
  };
}

export function secondsToClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export function buildCliFrontmatter(meeting) {
  const participants = Array.isArray(meeting?.participants)
    ? meeting.participants.filter((participant) => typeof participant === 'string')
    : [];
  const participantLines = participants.length
    ? ['participants:', ...participants.map((participant) => `  - ${yamlString(participant)}`)]
    : ['participants: []'];
  const date = meeting?.dateString ?? meeting?.date ?? null;

  return [
    '---',
    `id: ${yamlString(meeting?.id ?? null)}`,
    `title: ${yamlString(meeting?.title ?? null)}`,
    `date: ${yamlString(date)}`,
    `duration_minutes: ${yamlDurationMinutes(meeting?.duration)}`,
    ...participantLines,
    `source: ${yamlString('fireflies.ai')}`,
    `type: ${yamlString('meeting-transcript')}`,
    '---'
  ].join('\n');
}

function resolveSpeakerLabel(sentence, speakerMap) {
  const fallback = sentence.speaker_name ?? 'Unknown Speaker';
  if (!speakerMap) return fallback;
  const id = sentence.speaker_id === null || sentence.speaker_id === undefined
    ? null
    : String(sentence.speaker_id);
  if (id !== null && speakerMap.byId.has(id)) return speakerMap.byId.get(id);
  const name = sentence.speaker_name === null || sentence.speaker_name === undefined
    ? null
    : sentence.speaker_name;
  if (name !== null && speakerMap.byName.has(name)) return speakerMap.byName.get(name);
  return fallback;
}

export function renderTranscriptMarkdown(meeting, options = {}) {
  const sentences = Array.isArray(meeting?.sentences) ? meeting.sentences : [];
  const bracketed = options.bracketed !== false;
  const body = sentences.length
    ? sentences
      .map((sentence) => {
        const clock = secondsToClock(sentence.start_time);
        const prefix = bracketed ? `[${clock}]` : clock;
        const speaker = resolveSpeakerLabel(sentence, options.speakerMap);
        const text = sentence.text ?? sentence.raw_text ?? '';
        return `#### ${prefix} ${speaker}\n${text}`;
      })
      .join('\n\n')
    : '_Keine Satzdaten verfügbar._';

  return options.withFrontmatter ? `${buildCliFrontmatter(meeting)}\n\n${body}` : body;
}

function rejectFlagValue(flag, value) {
  if (value === undefined || value === '' || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
}

export function parseSpeakerMap(raw) {
  const text = String(raw ?? '').trim();
  const entries = [];

  if (text.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('invalid_speaker_map_json');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid_speaker_map_json');
    }
    for (const [key, value] of Object.entries(parsed)) {
      entries.push([key, value]);
    }
  } else {
    for (const pair of text.split(',')) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        throw new Error('invalid_speaker_map_entry');
      }
      entries.push([trimmed.slice(0, separator), trimmed.slice(separator + 1)]);
    }
  }

  const byId = new Map();
  const byName = new Map();
  const resolved = [];

  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey).trim();
    const value = rawValue === null || rawValue === undefined || typeof rawValue === 'object'
      ? ''
      : String(rawValue).trim();
    if (!key) continue;
    if (!value) {
      throw new Error('speaker_map_empty_value');
    }
    byName.set(key, value);
    resolved.push([key, value]);
  }

  for (const [key, value] of resolved) {
    const numeric = key.match(/^\d+$/);
    if (numeric) {
      byId.set(numeric[0], value);
    }
  }

  for (const [key, value] of resolved) {
    const speaker = key.match(/^speaker\s+(\d+)$/i);
    if (speaker && !byId.has(speaker[1])) {
      byId.set(speaker[1], value);
    }
  }

  return { byId, byName };
}

export function parseGetMeetingArgs(argv) {
  const args = {
    mode: 'minimal',
    modeExplicit: false,
    format: 'json',
    sentencesOnly: false,
    withFrontmatter: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (!arg.startsWith('--')) {
      if (args.transcriptId !== undefined) {
        throw new Error(`unexpected_positional_argument:${arg}`);
      }
      args.transcriptId = arg;
    } else if (arg === '--mode' || arg === '--format' || arg === '--output' || arg === '--speaker-map') {
      rejectFlagValue(arg, next);
      if (arg === '--mode') {
        args.mode = next;
        args.modeExplicit = true;
      } else if (arg === '--format') {
        args.format = next;
      } else if (arg === '--output') {
        args.output = next;
      } else {
        args.speakerMap = next;
      }
      i += 1;
    } else if (arg === '--sentences-only') {
      args.sentencesOnly = true;
    } else if (arg === '--with-frontmatter') {
      args.withFrontmatter = true;
    }
  }

  if (args.format === 'markdown' && args.mode === 'minimal' && !args.modeExplicit && !args.sentencesOnly) {
    args.mode = 'sentences-only';
  }

  return args;
}

export function resolveGetMeetingMode(args) {
  const effective = args.sentencesOnly ? 'sentences-only' : args.mode;
  if (args.withFrontmatter && !args.modeExplicit && effective === 'sentences-only') {
    return 'full';
  }
  return effective;
}

export function validateGetMeetingArgs(args) {
  if (!args.transcriptId) {
    throw new Error('usage: node get-meeting.mjs <transcriptId> [--mode minimal|full|sentences-only] [--format json|markdown] [--output <file>] [--sentences-only]');
  }

  if (!GET_MEETING_MODES.includes(args.mode)) {
    throw new Error('mode_must_be_minimal_full_or_sentences_only');
  }

  if (!GET_MEETING_FORMATS.includes(args.format)) {
    throw new Error('format_must_be_json_or_markdown');
  }

  if (args.withFrontmatter && args.format !== 'markdown') {
    throw new Error('frontmatter_requires_markdown_format');
  }

  return args;
}

export function buildListMeetingsRequest(options = {}, fields = LIST_MEETINGS_FIELDS) {
  const allowedScopes = new Set(['title', 'sentences', 'all']);

  if (options.scope && !allowedScopes.has(options.scope)) {
    throw new Error('scope_must_be_title_sentences_or_all');
  }

  if (options.scope && !options.keyword) {
    throw new Error('scope_requires_keyword');
  }

  const variableDefs = [];
  const queryArgs = [];
  const variables = {};

  if (options.keyword) {
    variableDefs.push('$keyword: String');
    queryArgs.push('keyword: $keyword');
    variables.keyword = options.keyword;
  }

  if (options.fromDate) {
    variableDefs.push('$fromDate: DateTime');
    queryArgs.push('fromDate: $fromDate');
    variables.fromDate = options.fromDate;
  }

  if (options.toDate) {
    variableDefs.push('$toDate: DateTime');
    queryArgs.push('toDate: $toDate');
    variables.toDate = options.toDate;
  }

  if (typeof options.limit !== 'undefined') {
    variableDefs.push('$limit: Int');
    queryArgs.push('limit: $limit');
    variables.limit = options.limit;
  }

  if (typeof options.skip !== 'undefined') {
    variableDefs.push('$skip: Int');
    queryArgs.push('skip: $skip');
    variables.skip = options.skip;
  }

  if (options.host_email) {
    variableDefs.push('$host_email: String');
    queryArgs.push('host_email: $host_email');
    variables.host_email = options.host_email;
  }

  if (options.user_id) {
    variableDefs.push('$user_id: String');
    queryArgs.push('user_id: $user_id');
    variables.user_id = options.user_id;
  }

  if (options.channel_id) {
    variableDefs.push('$channel_id: String');
    queryArgs.push('channel_id: $channel_id');
    variables.channel_id = options.channel_id;
  }

  if (options.scope) {
    queryArgs.push(`scope: ${options.scope}`);
  }

  const query = `query Transcripts(${variableDefs.join(', ')}) {
  transcripts(${queryArgs.join(', ')}) {
    ${fields}
  }
}`;

  return { query, variables };
}

function resolveProjectRoot(workspaceRoot, projectSlug) {
  return path.join(workspaceRoot, 'memory', 'evidence', 'projects', projectSlug);
}

export function buildMeetingDestinationPaths(options = {}) {
  const {
    meetingsRoot,
    projectSlug = null,
    channelSlug = null,
    datePrefix = 'undated',
    meetingSlug = '',
    workspaceRoot = null
  } = options;
  const channelFolder = channelSlug || 'ohne-channel';
  const root = workspaceRoot ?? path.resolve(meetingsRoot, '..', '..', '..');
  const folderPath = projectSlug
    ? path.join(resolveProjectRoot(root, projectSlug), 'meetings', channelFolder)
    : path.join(meetingsRoot, channelFolder);

  return {
    folderPath,
    summaryFileName: `${datePrefix}-${meetingSlug}.summary.md`,
    transcriptFileName: `${datePrefix}-${meetingSlug}.transcript.md`
  };
}

export function buildProjectRelocatePlan(meeting, options = {}) {
  const { projectSlug: rawProjectSlug, workspaceRoot } = options;
  const projectSlug = slugify(rawProjectSlug);
  if (!projectSlug || projectSlug === 'ohne-channel') {
    throw new Error(`empty_project_slug:${rawProjectSlug ?? ''}`);
  }
  const channelSlug = meeting?.channel_slug || 'ohne-channel';
  const datePrefix = String(meeting?.dateString ?? '').slice(0, 10) || 'undated';
  const meetingSlug = meeting?.slug ?? '';
  const destination = buildMeetingDestinationPaths({
    meetingsRoot: path.join(workspaceRoot, 'memory', 'evidence', 'meetings'),
    projectSlug,
    channelSlug,
    datePrefix,
    meetingSlug,
    workspaceRoot
  });
  const summaryToAbsolute = path.join(destination.folderPath, destination.summaryFileName);
  const transcriptToAbsolute = path.join(destination.folderPath, destination.transcriptFileName);
  const summaryFromAbsolute = meeting?.summary_path ? path.join(workspaceRoot, meeting.summary_path) : null;
  const transcriptFromAbsolute = meeting?.transcript_path ? path.join(workspaceRoot, meeting.transcript_path) : null;
  const summaryToRelative = relativeWorkspacePath(workspaceRoot, summaryToAbsolute);
  const transcriptToRelative = relativeWorkspacePath(workspaceRoot, transcriptToAbsolute);
  const previousProjectSlug = meeting?.project_slug ?? null;
  const existingProjectSlugs = Array.isArray(meeting?.project_slugs) ? meeting.project_slugs : [];
  const retainedProjectSlugs = previousProjectSlug && previousProjectSlug !== projectSlug
    ? existingProjectSlugs.filter((slug) => slug !== previousProjectSlug)
    : existingProjectSlugs;
  const projectSlugs = [...new Set([...retainedProjectSlugs, projectSlug])];

  return {
    fromPaths: {
      summary: summaryFromAbsolute,
      transcript: transcriptFromAbsolute
    },
    toPaths: {
      summary: summaryToAbsolute,
      transcript: transcriptToAbsolute
    },
    frontmatterUpdates: {
      project_slug: projectSlug,
      summary_path: summaryToRelative,
      transcript_path: transcriptToRelative
    },
    entryUpdates: {
      project_slug: projectSlug,
      project_slugs: projectSlugs,
      project_scoped: true,
      summary_path: summaryToRelative,
      transcript_path: transcriptToRelative,
      review_input: {
        project_slug: projectSlug,
        project_scoped: true
      }
    }
  };
}
