import fs from 'node:fs';
import { firefliesGraphQL, printError, printJson } from './_fireflies-client.mjs';
import { buildGetMeetingQuery, parseGetMeetingArgs, parseSpeakerMap, renderTranscriptMarkdown, resolveGetMeetingMode, validateGetMeetingArgs } from './_fireflies-meetings.mjs';

let args;
let speakerMap;
try {
  const parsedArgs = validateGetMeetingArgs(parseGetMeetingArgs(process.argv.slice(2)));
  speakerMap = parsedArgs.speakerMap ? parseSpeakerMap(parsedArgs.speakerMap) : undefined;
  args = parsedArgs;
} catch (error) {
  printError(error);
  process.exitCode = 2;
}

if (args) {
  const mode = resolveGetMeetingMode(args);

  try {
    const query = buildGetMeetingQuery(mode);
    const data = await firefliesGraphQL({
      query,
      variables: { transcriptId: args.transcriptId }
    });

    const meeting = data?.transcript ?? null;
    const result = args.format === 'markdown'
      ? renderTranscriptMarkdown(meeting, { speakerMap, withFrontmatter: args.withFrontmatter })
      : JSON.stringify({ ok: true, mode, meeting }, null, 2);

    if (args.output) {
      fs.writeFileSync(args.output, `${result}\n`, 'utf8');
      printJson({ ok: true, mode, format: args.format, output: args.output });
    } else {
      process.stdout.write(`${result}\n`);
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
