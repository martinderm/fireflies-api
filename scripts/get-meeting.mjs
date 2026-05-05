import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';
import { buildGetMeetingQuery } from './_fireflies-meetings.mjs';

function parseArgs(argv) {
  const args = {
    mode: 'minimal'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (!args.transcriptId && !arg.startsWith('--')) {
      args.transcriptId = arg;
    } else if (arg === '--mode' && next) {
      args.mode = next;
      i += 1;
    }
  }

  return args;
}

const { transcriptId, mode } = parseArgs(process.argv.slice(2));

if (!transcriptId) {
  printError(new Error('usage: node get-meeting.mjs <transcriptId> [--mode minimal|full]'));
  process.exit(2);
}

if (!['minimal', 'full'].includes(mode)) {
  printError(new Error('mode_must_be_minimal_or_full'));
  process.exit(2);
}

try {
  const query = buildGetMeetingQuery(mode);
  const data = await firefliesGraphQL({
    query,
    variables: { transcriptId }
  });

  printJson({
    ok: true,
    mode,
    meeting: data?.transcript ?? null
  });
} catch (error) {
  printError(error);
  process.exit(1);
}
