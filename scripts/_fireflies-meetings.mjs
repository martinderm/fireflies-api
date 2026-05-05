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

export const FULL_ONLY_MEETING_FIELDS = `
  sentences {
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

export function buildGetMeetingQuery(mode = 'minimal') {
  return `query Transcript($transcriptId: String!) {
  transcript(id: $transcriptId) {
    ${MINIMAL_MEETING_FIELDS}
    ${mode === 'full' ? FULL_ONLY_MEETING_FIELDS : ''}
  }
}`;
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
