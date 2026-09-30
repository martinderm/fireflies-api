import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SENTENCES_ONLY_MEETING_FIELDS,
  buildGetMeetingQuery,
  parseGetMeetingArgs,
  renderTranscriptMarkdown,
  validateGetMeetingArgs
} from '../scripts/_fireflies-meetings.mjs';

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
