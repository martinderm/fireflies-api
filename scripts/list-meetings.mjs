import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';
import { buildListMeetingsRequest } from './_fireflies-meetings.mjs';

function parseArgs(argv) {
  const args = {
    limit: 10,
    skip: 0
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--keyword' && next) {
      args.keyword = next;
      i += 1;
    } else if (arg === '--scope' && next) {
      args.scope = next;
      i += 1;
    } else if (arg === '--from-date' && next) {
      args.fromDate = next;
      i += 1;
    } else if (arg === '--to-date' && next) {
      args.toDate = next;
      i += 1;
    } else if (arg === '--host-email' && next) {
      args.host_email = next;
      i += 1;
    } else if (arg === '--user-id' && next) {
      args.user_id = next;
      i += 1;
    } else if (arg === '--channel-id' && next) {
      args.channel_id = next;
      i += 1;
    } else if (arg === '--limit' && next) {
      args.limit = Number(next);
      i += 1;
    } else if (arg === '--skip' && next) {
      args.skip = Number(next);
      i += 1;
    }
  }

  return args;
}

const options = parseArgs(process.argv.slice(2));

if (Number.isNaN(options.limit) || options.limit < 1 || options.limit > 50) {
  printError(new Error('limit_must_be_between_1_and_50'));
  process.exit(2);
}

if (Number.isNaN(options.skip) || options.skip < 0) {
  printError(new Error('skip_must_be_zero_or_greater'));
  process.exit(2);
}

try {
  const { query, variables } = buildListMeetingsRequest(options);
  const data = await firefliesGraphQL({ query, variables });

  printJson({
    ok: true,
    query: options,
    count: Array.isArray(data?.transcripts) ? data.transcripts.length : 0,
    meetings: data?.transcripts ?? []
  });
} catch (error) {
  printError(error);
  process.exit(1);
}
