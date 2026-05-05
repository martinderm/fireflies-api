import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';

const query = `query Channels {
  channels {
    id
    title
    is_private
    created_by
    created_at
    updated_at
    members {
      user_id
      email
      name
    }
  }
}`;

try {
  const data = await firefliesGraphQL({ query });
  printJson({
    ok: true,
    count: Array.isArray(data?.channels) ? data.channels.length : 0,
    channels: data?.channels ?? []
  });
} catch (error) {
  printError(error);
  process.exit(1);
}
