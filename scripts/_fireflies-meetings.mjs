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

export function secondsToClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export function renderTranscriptMarkdown(meeting, options = {}) {
  const sentences = Array.isArray(meeting?.sentences) ? meeting.sentences : [];

  if (!sentences.length) {
    return '_Keine Satzdaten verfügbar._';
  }

  const bracketed = options.bracketed !== false;

  return sentences
    .map((sentence) => {
      const clock = secondsToClock(sentence.start_time);
      const prefix = bracketed ? `[${clock}]` : clock;
      const speaker = sentence.speaker_name ?? 'Unknown Speaker';
      const text = sentence.text ?? sentence.raw_text ?? '';
      return `#### ${prefix} ${speaker}\n${text}`;
    })
    .join('\n\n');
}

function rejectFlagValue(flag, value) {
  if (value === undefined || value === '' || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
}

export function parseGetMeetingArgs(argv) {
  const args = {
    mode: 'minimal',
    modeExplicit: false,
    format: 'json',
    sentencesOnly: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (!arg.startsWith('--')) {
      if (args.transcriptId !== undefined) {
        throw new Error(`unexpected_positional_argument:${arg}`);
      }
      args.transcriptId = arg;
    } else if (arg === '--mode' || arg === '--format' || arg === '--output') {
      rejectFlagValue(arg, next);
      if (arg === '--mode') {
        args.mode = next;
        args.modeExplicit = true;
      } else if (arg === '--format') {
        args.format = next;
      } else {
        args.output = next;
      }
      i += 1;
    } else if (arg === '--sentences-only') {
      args.sentencesOnly = true;
    }
  }

  if (args.format === 'markdown' && args.mode === 'minimal' && !args.modeExplicit && !args.sentencesOnly) {
    args.mode = 'sentences-only';
  }

  return args;
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
