import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';
import { buildProbeQuery, buildProbeCapabilities } from './_fireflies-meetings.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!args.transcriptId && !arg.startsWith('--')) {
      args.transcriptId = arg;
    } else if (arg === '--include-summary') {
      args.includeSummary = true;
    } else if (arg === '--include-paid-fields') {
      args.includePaidFields = true;
    }
  }
  return args;
}

const { transcriptId, includeSummary, includePaidFields } = parseArgs(process.argv.slice(2));
const paidRequested = Boolean(includePaidFields);
const summaryRequested = Boolean(includeSummary);
let exitCode = 1;
const query = buildProbeQuery(paidRequested, summaryRequested);

try {
  if (!transcriptId) {
    exitCode = 2;
    throw new Error('usage: node probe-meeting-capabilities.mjs <transcriptId> [--include-summary] [--include-paid-fields]');
  }

  const data = await firefliesGraphQL({ query, variables: { transcriptId } });
  const meeting = data?.transcript ?? null;

  printJson({
    ok: true,
    meeting_id: meeting?.id ?? null,
    title: meeting?.title ?? null,
    capabilities: buildProbeCapabilities(meeting, { paidRequested, summaryRequested }),
    sample: meeting
  });
} catch (error) {
  printError(error);
  process.exitCode = exitCode;
}
