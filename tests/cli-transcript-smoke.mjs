import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  SENTENCES_ONLY_MEETING_FIELDS,
  buildGetMeetingQuery,
  parseGetMeetingArgs,
  renderTranscriptMarkdown,
  validateGetMeetingArgs
} from '../scripts/_fireflies-meetings.mjs';
import * as meetings from '../scripts/_fireflies-meetings.mjs';
import {
  yamlString,
  yamlScalar,
  yamlInline,
  yamlDurationMinutes
} from '../scripts/_yaml-helpers.mjs';

const MEETING = {
  sentences: [
    { index: 0, start_time: 80, speaker_name: 'Martin', text: 'Willkommen.', raw_text: 'willkommen' },
    { index: 1, start_time: 3725, speaker_name: 'Ada', text: null, raw_text: 'Roh Fassung' },
    { index: 2, start_time: 5, speaker_name: null, text: null, raw_text: null }
  ]
};

const SYNC_MEETING = {
  sentences: [
    { start_time: 80, speaker_name: 'Martin', text: 'Willkommen.', raw_text: 'willkommen' },
    { start_time: 3725, speaker_name: 'Ada', text: null, raw_text: 'Roh Fassung' },
    { start_time: 5, speaker_name: null, text: null, raw_text: null },
    { start_time: 0, speaker_name: '', text: '', raw_text: 'x' }
  ]
};

test('render: clock prefix uses bracketed mm:ss and keeps speaker plus text', () => {
  const markdown = renderTranscriptMarkdown(MEETING);
  assert.ok(markdown.includes('#### [01:20] Martin\nWillkommen.'));
  assert.ok(markdown.includes('#### [62:05] Ada\nRoh Fassung'));
});

test('render: speaker_name fallback is Unknown Speaker', () => {
  const markdown = renderTranscriptMarkdown(MEETING);
  assert.ok(markdown.includes('#### [00:05] Unknown Speaker'));
});

test('render: raw_text fallback when text is missing', () => {
  const markdown = renderTranscriptMarkdown({ sentences: [{ start_time: 80, speaker_name: 'Martin', text: null, raw_text: 'Rohtext' }] });
  assert.equal(markdown, '#### [01:20] Martin\nRohtext');
});

test('render: empty sentences produce the placeholder text', () => {
  assert.equal(renderTranscriptMarkdown({}), '_Keine Satzdaten verfügbar._');
  assert.equal(renderTranscriptMarkdown({ sentences: [] }), '_Keine Satzdaten verfügbar._');
});

test('render: sync-compatible format without brackets is byte-identical to the legacy sync output', () => {
  const expected = '#### 01:20 Martin\nWillkommen.\n\n#### 62:05 Ada\nRoh Fassung\n\n#### 00:05 Unknown Speaker\n\n\n#### 00:00 \n';
  assert.equal(renderTranscriptMarkdown(SYNC_MEETING, { bracketed: false }), expected);
});

test('sentences-only catalog contains sentences and excludes summary', () => {
  assert.ok(SENTENCES_ONLY_MEETING_FIELDS.includes('sentences'));
  assert.ok(!SENTENCES_ONLY_MEETING_FIELDS.includes('summary'));
});

test('sentences-only query requests sentences and never summary', () => {
  const query = buildGetMeetingQuery('sentences-only');
  assert.ok(query.includes('sentences'));
  assert.ok(!query.includes('summary'));
});

test('full query still embeds summary and sentences', () => {
  const query = buildGetMeetingQuery('full');
  assert.ok(query.includes('summary'));
  assert.ok(query.includes('sentences'));
});

test('parseArgs: defaults are minimal mode and json format', () => {
  const args = parseGetMeetingArgs(['abc123']);
  assert.equal(args.transcriptId, 'abc123');
  assert.equal(args.mode, 'minimal');
  assert.equal(args.format, 'json');
  assert.equal(args.sentencesOnly, false);
  assert.equal(args.output, undefined);
});

test('parseArgs: format, output and sentences-only flags are captured', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--output', 'out.md', '--sentences-only']);
  assert.equal(args.format, 'markdown');
  assert.equal(args.output, 'out.md');
  assert.equal(args.sentencesOnly, true);
});

test('parseArgs: output without an explicit format keeps the json default', () => {
  const args = parseGetMeetingArgs(['abc123', '--output', 'out.json']);
  assert.equal(args.format, 'json');
  assert.equal(args.output, 'out.json');
});

test('parseArgs: value flags reject a following flag instead of swallowing it', () => {
  const cases = [
    ['--mode', '--output'],
    ['--format', '--output'],
    ['--output', '--sentences-only']
  ];
  for (const [flag, following] of cases) {
    assert.throws(
      () => parseGetMeetingArgs(['abc123', flag, following]),
      new RegExp(`missing value for ${flag}`)
    );
  }
});

test('parseArgs: trailing --mode without a value throws missing value', () => {
  assert.throws(
    () => parseGetMeetingArgs(['abc123', '--mode']),
    /missing value for --mode/
  );
});

test('parseArgs: trailing --format without a value throws missing value', () => {
  assert.throws(
    () => parseGetMeetingArgs(['abc123', '--format']),
    /missing value for --format/
  );
});

test('parseArgs: trailing --output without a value throws missing value', () => {
  assert.throws(
    () => parseGetMeetingArgs(['abc123', '--output']),
    /missing value for --output/
  );
});

test('parseArgs: trailing --sentences-only stays a legitimate value-less flag', () => {
  const args = parseGetMeetingArgs(['abc123', '--sentences-only']);
  assert.equal(args.sentencesOnly, true);
});

test('parseArgs: value flags still accept legitimate values', () => {
  const args = parseGetMeetingArgs(['abc123', '--mode', 'full', '--format', 'markdown', '--output', 'out.md']);
  assert.equal(args.mode, 'full');
  assert.equal(args.format, 'markdown');
  assert.equal(args.output, 'out.md');
});

test('validate: unknown format is rejected with format_must_be_json_or_markdown', () => {
  assert.throws(
    () => validateGetMeetingArgs({ transcriptId: 'abc123', mode: 'minimal', format: 'yaml', sentencesOnly: false }),
    /format_must_be_json_or_markdown/
  );
});

test('validate: mode sentences-only is accepted', () => {
  assert.doesNotThrow(() => validateGetMeetingArgs({ transcriptId: 'abc123', mode: 'sentences-only', format: 'json', sentencesOnly: false }));
  assert.doesNotThrow(() => validateGetMeetingArgs({ transcriptId: 'abc123', mode: 'minimal', format: 'json', sentencesOnly: true }));
});

test('validate: missing transcript id raises a usage error', () => {
  assert.throws(
    () => validateGetMeetingArgs({ mode: 'minimal', format: 'json', sentencesOnly: false }),
    /usage: node get-meeting\.mjs/
  );
});

test('resolve: markdown without an explicit mode defaults to sentences-only', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown']);
  assert.equal(args.modeExplicit, false);
  assert.equal(args.mode, 'sentences-only');
});

test('resolve: explicit --mode minimal wins over the markdown auto default', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--mode', 'minimal']);
  assert.equal(args.modeExplicit, true);
  assert.equal(args.mode, 'minimal');
});

test('resolve: --sentences-only with markdown does not trigger the auto default', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--sentences-only']);
  assert.equal(args.sentencesOnly, true);
  assert.equal(args.mode, 'minimal');
});

test('resolve: explicit --mode full with markdown stays full', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--mode', 'full']);
  assert.equal(args.mode, 'full');
});

test('resolve: json without an explicit mode stays minimal', () => {
  const args = parseGetMeetingArgs(['abc123']);
  assert.equal(args.mode, 'minimal');
});

test('parseArgs: an empty --output value is rejected as missing value', () => {
  assert.throws(
    () => parseGetMeetingArgs(['abc123', '--output', '']),
    /missing value for --output/
  );
});

test('parseArgs: a surplus positional argument is rejected fail-loud', () => {
  assert.throws(
    () => parseGetMeetingArgs(['abc123', 'surplus']),
    /unexpected_positional_argument:surplus/
  );
});

test('parseArgs: a single transcript id remains a valid call', () => {
  const args = parseGetMeetingArgs(['abc123']);
  assert.equal(args.transcriptId, 'abc123');
});

test('parseArgs: --sentences-only without a value remains valid next to a transcript id', () => {
  const args = parseGetMeetingArgs(['abc123', '--sentences-only']);
  assert.equal(args.sentencesOnly, true);
});

test('cli: get-meeting without arguments exits with usage code 2', () => {
  const scriptPath = fileURLToPath(new URL('../scripts/get-meeting.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});

test('cli: get-meeting with an unknown format exits with usage code 2 before any API call', () => {
  const scriptPath = fileURLToPath(new URL('../scripts/get-meeting.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, 'abc123', '--format', 'yaml'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});

const FRONTMATTER_MEETING = {
  id: '01M3PBHZZ610X593KYNF763Y40',
  title: 'Website-Migration und kontrolliertes Deployment',
  date: 1759156200000,
  dateString: '2026-09-29T14:30:00.000Z',
  duration: 25,
  participants: ['Dr. Patrícia J. Reis', 'Martin'],
  sentences: [
    { index: 0, start_time: 80, speaker_id: '0', speaker_name: 'Speaker 0', text: 'Willkommen.', raw_text: 'willkommen' },
    { index: 1, start_time: 3725, speaker_id: '1', speaker_name: 'Speaker 1', text: null, raw_text: 'Roh Fassung' }
  ]
};

test('frontmatter: block is delimited, ordered and quote-safe', () => {
  const fm = meetings.buildCliFrontmatter(FRONTMATTER_MEETING);
  assert.ok(fm.startsWith('---\n'));
  assert.ok(fm.endsWith('\n---'));
  assert.ok(!fm.endsWith('\n---\n'));
  assert.ok(fm.includes('id: "01M3PBHZZ610X593KYNF763Y40"'));
  assert.ok(fm.includes('title: "Website-Migration und kontrolliertes Deployment"'));
  assert.ok(fm.includes('date: "2026-09-29T14:30:00.000Z"'));
  assert.ok(fm.includes('duration_minutes: 25'));
  assert.ok(fm.includes('participants:\n  - "Dr. Patrícia J. Reis"\n  - "Martin"'));
  assert.ok(fm.includes('source: "fireflies.ai"'));
  assert.ok(fm.includes('type: "meeting-transcript"'));
  const order = ['id:', 'title:', 'date:', 'duration_minutes:', 'participants:', 'source:', 'type:'];
  const positions = order.map((key) => fm.indexOf(`\n${key}`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('frontmatter: missing metadata stays null or empty array and never invents values', () => {
  const fm = meetings.buildCliFrontmatter({ sentences: [] });
  assert.ok(fm.includes('id: null'));
  assert.ok(fm.includes('title: null'));
  assert.ok(fm.includes('date: null'));
  assert.ok(fm.includes('duration_minutes: null'));
  assert.ok(fm.includes('participants: []'));
  assert.ok(fm.includes('source: "fireflies.ai"'));
  assert.ok(fm.includes('type: "meeting-transcript"'));
});

test('frontmatter: date prefers dateString and falls back to date', () => {
  const preferred = meetings.buildCliFrontmatter({ date: 1, dateString: '2026-09-29T14:30:00.000Z' });
  assert.ok(preferred.includes('date: "2026-09-29T14:30:00.000Z"'));
  const fallback = meetings.buildCliFrontmatter({ date: '2026-01-02T00:00:00.000Z', dateString: null });
  assert.ok(fallback.includes('date: "2026-01-02T00:00:00.000Z"'));
});

test('frontmatter: render option prepends the block and keeps the body intact', () => {
  const body = renderTranscriptMarkdown(FRONTMATTER_MEETING);
  const rendered = renderTranscriptMarkdown(FRONTMATTER_MEETING, { withFrontmatter: true });
  assert.equal(rendered, `${meetings.buildCliFrontmatter(FRONTMATTER_MEETING)}\n\n${body}`);
  assert.ok(rendered.includes('\n---\n\n#### [01:20]'));
  assert.ok(rendered.endsWith(body));
});

test('frontmatter: render option also prepends when no sentences are available', () => {
  const rendered = renderTranscriptMarkdown({}, { withFrontmatter: true });
  assert.ok(rendered.startsWith('---\n'));
  assert.ok(rendered.endsWith('\n\n_Keine Satzdaten verfügbar._'));
});

test('parseArgs: --with-frontmatter defaults to false and is captured when present', () => {
  assert.equal(parseGetMeetingArgs(['abc123']).withFrontmatter, false);
  assert.equal(parseGetMeetingArgs(['abc123', '--with-frontmatter']).withFrontmatter, true);
});

test('validate: --with-frontmatter with json format fails loud before any API call', () => {
  assert.throws(
    () => validateGetMeetingArgs({ transcriptId: 'abc123', mode: 'minimal', format: 'json', sentencesOnly: false, withFrontmatter: true }),
    /frontmatter_requires_markdown_format/
  );
  assert.doesNotThrow(
    () => validateGetMeetingArgs({ transcriptId: 'abc123', mode: 'minimal', format: 'markdown', sentencesOnly: false, withFrontmatter: true })
  );
});

test('cli: get-meeting with --with-frontmatter on the default json format exits with code 2', () => {
  const scriptPath = fileURLToPath(new URL('../scripts/get-meeting.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, 'abc123', '--with-frontmatter'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /frontmatter_requires_markdown_format/);
});

test('resolve: markdown with --with-frontmatter upgrades the auto sentences-only default to full', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--with-frontmatter']);
  assert.equal(args.mode, 'sentences-only');
  assert.equal(meetings.resolveGetMeetingMode(args), 'full');
  const query = buildGetMeetingQuery(meetings.resolveGetMeetingMode(args));
  assert.ok(query.includes('summary'));
  assert.ok(query.includes('sentences'));
});

test('resolve: explicit --sentences-only flag is upgraded by --with-frontmatter to full', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--sentences-only', '--with-frontmatter']);
  assert.equal(meetings.resolveGetMeetingMode(args), 'full');
});

test('resolve: an explicit --mode always wins over the --with-frontmatter cascade', () => {
  const minimal = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--with-frontmatter', '--mode', 'minimal']);
  assert.equal(minimal.modeExplicit, true);
  assert.equal(meetings.resolveGetMeetingMode(minimal), 'minimal');
  const full = parseGetMeetingArgs(['abc123', '--format', 'markdown', '--with-frontmatter', '--mode', 'full']);
  assert.equal(meetings.resolveGetMeetingMode(full), 'full');
});

test('resolve: without --with-frontmatter the markdown auto default stays sentences-only', () => {
  const args = parseGetMeetingArgs(['abc123', '--format', 'markdown']);
  assert.equal(meetings.resolveGetMeetingMode(args), 'sentences-only');
});

test('parseSpeakerMap: comma-delimited key=value pairs map ids and names', () => {
  const map = meetings.parseSpeakerMap('0=Dr. X,1=Martin');
  assert.equal(map.byId.get('0'), 'Dr. X');
  assert.equal(map.byId.get('1'), 'Martin');
  assert.equal(map.byName.get('0'), 'Dr. X');
});

test('parseSpeakerMap: Speaker-prefixed keys normalize into both byId and byName', () => {
  const map = meetings.parseSpeakerMap('Speaker 0=Dr. X,Speaker 1=Martin');
  assert.equal(map.byId.get('0'), 'Dr. X');
  assert.equal(map.byId.get('1'), 'Martin');
  assert.equal(map.byName.get('Speaker 0'), 'Dr. X');
});

test('parseSpeakerMap: a JSON mapping object is accepted', () => {
  const map = meetings.parseSpeakerMap('{"0":"Dr. X","1":"Martin"}');
  assert.equal(map.byId.get('0'), 'Dr. X');
  assert.equal(map.byId.get('1'), 'Martin');
});

test('parseSpeakerMap: malformed JSON fails loud with invalid_speaker_map_json', () => {
  assert.throws(() => meetings.parseSpeakerMap('{not valid json'), /invalid_speaker_map_json/);
});

test('parseSpeakerMap: an empty mapping target fails loud', () => {
  assert.throws(() => meetings.parseSpeakerMap('0='), /speaker_map_empty_value/);
  assert.throws(() => meetings.parseSpeakerMap('{"0":""}'), /speaker_map_empty_value/);
});

test('render: speakerMap resolves speaker_id before speaker_name', () => {
  const map = meetings.parseSpeakerMap('0=By Id,Speaker 0=By Name');
  const markdown = renderTranscriptMarkdown(
    { sentences: [{ start_time: 80, speaker_id: '0', speaker_name: 'Speaker 0', text: 'Hallo' }] },
    { speakerMap: map }
  );
  assert.equal(markdown, '#### [01:20] By Id\nHallo');
});

test('render: speakerMap falls back to a full speaker_name match when the id is unmapped', () => {
  const map = meetings.parseSpeakerMap('0=By Id,Speaker 0=By Name');
  const markdown = renderTranscriptMarkdown(
    { sentences: [{ start_time: 80, speaker_id: '9', speaker_name: 'Speaker 0', text: 'Hallo' }] },
    { speakerMap: map }
  );
  assert.equal(markdown, '#### [01:20] By Name\nHallo');
});

test('render: speakerMap falls back to the original label when nothing matches', () => {
  const map = meetings.parseSpeakerMap('0=By Id');
  const markdown = renderTranscriptMarkdown(
    { sentences: [{ start_time: 80, speaker_id: '9', speaker_name: 'Martin', text: 'Hallo' }] },
    { speakerMap: map }
  );
  assert.equal(markdown, '#### [01:20] Martin\nHallo');
});

test('render: speakerMap keeps the Unknown Speaker fallback for null speaker_name', () => {
  const map = meetings.parseSpeakerMap('0=By Id');
  const markdown = renderTranscriptMarkdown(
    { sentences: [{ start_time: 5, speaker_id: null, speaker_name: null, text: 'Hallo' }] },
    { speakerMap: map }
  );
  assert.equal(markdown, '#### [00:05] Unknown Speaker\nHallo');
});

test('render: speakerMap integrates with bracketed true and false output', () => {
  const map = meetings.parseSpeakerMap('0=Dr. X');
  const meeting = { sentences: [{ start_time: 80, speaker_id: '0', speaker_name: 'Speaker 0', text: 'Hallo' }] };
  assert.equal(renderTranscriptMarkdown(meeting, { speakerMap: map }), '#### [01:20] Dr. X\nHallo');
  assert.equal(renderTranscriptMarkdown(meeting, { speakerMap: map, bracketed: false }), '#### 01:20 Dr. X\nHallo');
});

test('parseArgs: --speaker-map captures its value and rejects a swallowed flag', () => {
  const args = parseGetMeetingArgs(['abc123', '--speaker-map', '0=Dr. X']);
  assert.equal(args.speakerMap, '0=Dr. X');
  assert.throws(() => parseGetMeetingArgs(['abc123', '--speaker-map', '--format']), /missing value for --speaker-map/);
  assert.throws(() => parseGetMeetingArgs(['abc123', '--speaker-map']), /missing value for --speaker-map/);
});

test('cli: get-meeting with invalid --speaker-map json exits with usage code 2 before any API call', () => {
  const scriptPath = fileURLToPath(new URL('../scripts/get-meeting.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, 'abc123', '--speaker-map', '{bad'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid_speaker_map_json/);
});

test('yamlString: null and undefined render as bare null', () => {
  assert.equal(yamlString(null), 'null');
  assert.equal(yamlString(undefined), 'null');
});

test('yamlString: every other value is JSON-quoted as a string', () => {
  assert.equal(yamlString('plain'), '"plain"');
  assert.equal(yamlString('a"b'), '"a\\"b"');
  assert.equal(yamlString('line\nbreak'), '"line\\nbreak"');
  assert.equal(yamlString(25), '"25"');
  assert.equal(yamlString(true), '"true"');
});

test('yamlScalar: null-ish render as bare null', () => {
  assert.equal(yamlScalar(null), 'null');
  assert.equal(yamlScalar(undefined), 'null');
});

test('yamlScalar: numbers and booleans render bare, strings stay quoted', () => {
  assert.equal(yamlScalar(25), '25');
  assert.equal(yamlScalar(1.5), '1.5');
  assert.equal(yamlScalar(0), '0');
  assert.equal(yamlScalar(true), 'true');
  assert.equal(yamlScalar(false), 'false');
  assert.equal(yamlScalar('plain'), '"plain"');
});

test('yamlInline: null and undefined fall back to an empty array', () => {
  assert.equal(yamlInline(), '[]');
  assert.equal(yamlInline(null), '[]');
  assert.equal(yamlInline(undefined), '[]');
});

test('yamlInline: arrays and objects serialize as compact JSON', () => {
  assert.equal(yamlInline(['a', 'b']), '["a","b"]');
  assert.equal(yamlInline([1, 2]), '[1,2]');
  assert.equal(yamlInline({ a: 1 }), '{"a":1}');
});

test('yamlInline: a caller-provided fallback replaces the empty-array default', () => {
  assert.equal(yamlInline(null, ['z']), '["z"]');
  assert.equal(yamlInline(undefined, ['z']), '["z"]');
});

test('yamlDurationMinutes: finite numbers render as plain minutes', () => {
  assert.equal(yamlDurationMinutes(25), '25');
  assert.equal(yamlDurationMinutes(25.5), '25.5');
  assert.equal(yamlDurationMinutes(0), '0');
});

test('yamlDurationMinutes: numeric strings normalize and non-numeric strings render null', () => {
  assert.equal(yamlDurationMinutes('25'), '25');
  assert.equal(yamlDurationMinutes('25.50'), '25.5');
  assert.equal(yamlDurationMinutes('0'), '0');
  assert.equal(yamlDurationMinutes('abc'), 'null');
  assert.equal(yamlDurationMinutes(''), 'null');
  assert.equal(yamlDurationMinutes('   '), 'null');
});

test('yamlDurationMinutes: non-finite and null-ish values render null', () => {
  assert.equal(yamlDurationMinutes(Number.NaN), 'null');
  assert.equal(yamlDurationMinutes(Number.POSITIVE_INFINITY), 'null');
  assert.equal(yamlDurationMinutes(null), 'null');
  assert.equal(yamlDurationMinutes(undefined), 'null');
});
