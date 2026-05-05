import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!args.transcriptId && !arg.startsWith('--')) {
      args.transcriptId = arg;
    } else if (arg === '--include-summary') {
      args.includeSummary = true;
    }
  }
  return args;
}

const { transcriptId, includeSummary } = parseArgs(process.argv.slice(2));

if (!transcriptId) {
  printError(new Error('usage: node probe-meeting-capabilities.mjs <transcriptId> [--include-summary]'));
  process.exit(2);
}

const query = `query ProbeMeeting($transcriptId: String!) {
  transcript(id: $transcriptId) {
    id
    title
    transcript_url
    meeting_link
    organizer_email
    participants
    speakers { id name }
    meeting_attendees { displayName email phoneNumber name location }
    meeting_attendance { name join_time leave_time }
    channels { id title is_private }
    user { user_id email name is_admin integrations }
    meeting_info { fred_joined silent_meeting summary_status }
    shared_with { email name expires_at }
    apps_preview { outputs { transcript_id user_id app_id created_at title prompt response } }
    is_live
    audio_url
    video_url
    analytics { __typename }
    ${includeSummary ? `summary {
      keywords
      action_items
      outline
      shorthand_bullet
      overview
      bullet_gist
      gist
      short_summary
      short_overview
      meeting_type
      topics_discussed
    }` : ''}
  }
}`;

try {
  const data = await firefliesGraphQL({ query, variables: { transcriptId } });
  const meeting = data?.transcript ?? null;

  printJson({
    ok: true,
    meeting_id: meeting?.id ?? null,
    title: meeting?.title ?? null,
    capabilities: {
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
      audio_url_present: Boolean(meeting?.audio_url),
      video_url_present: Boolean(meeting?.video_url),
      analytics_present: Boolean(meeting?.analytics),
      summary_present: Boolean(meeting?.summary)
    },
    sample: meeting
  });
} catch (error) {
  printError(error);
  process.exit(1);
}
