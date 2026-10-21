import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  WRITER_RECORD_SCHEMA,
  WRITER_VERSION,
  WriterTransportError,
  checkWriterCapabilities,
  ingestRecord,
  resolveWriterConfig
} from '../scripts/_meeting-writer.mjs';
import { buildMeetingRecord } from '../scripts/_meeting-record.mjs';

const FAKE_WRITER_SOURCE = String.raw`
import fs from 'node:fs';

function envelope(overrides = {}) {
  return {
    action: 'ingest_meeting',
    success: true,
    state: 'committed',
    message: 'ok',
    data: {
      entry: { meeting_id: 'meeting-1' },
      meeting_id: 'meeting-1',
      paths: { summary: 'memory/evidence/meetings/ops/summary.md' },
      changed: true
    },
    error: null,
    ...overrides
  };
}

const args = process.argv.slice(2);
if (args.includes('--capabilities')) {
  const mode = process.env.FAKE_CAPS || 'ok';
  if (mode === 'wrong_schema') {
    process.stdout.write(JSON.stringify({
      action: 'capabilities', success: true, state: 'ready', message: 'ok',
      data: { record_schema: 'meeting-record/9', writer_version: 'meeting-desk/1' }, error: null
    }));
  } else if (mode === 'exit2') {
    process.stderr.write('capabilities failed');
    process.exitCode = 2;
  } else if (mode === 'malformed') {
    process.stdout.write('not json');
  } else {
    process.stdout.write(JSON.stringify({
      action: 'capabilities', success: true, state: 'ready', message: 'ok',
      data: { record_schema: 'meeting-record/1', writer_version: 'meeting-desk/1' }, error: null
    }));
  }
} else {
  const stdin = fs.readFileSync(0, 'utf8');
  if (process.env.FAKE_CAPTURE) {
    fs.writeFileSync(process.env.FAKE_CAPTURE, JSON.stringify({ args, stdin }), 'utf8');
  }
  const mode = process.env.FAKE_INGEST || 'ok';
  if (mode === 'hang') {
    setTimeout(() => {}, 5000);
  } else if (mode === 'malformed') {
    process.stdout.write('{broken');
  } else if (mode === 'trailing') {
    process.stdout.write(JSON.stringify(envelope()) + ' trailing');
  } else if (mode === 'success_false') {
    process.stdout.write(JSON.stringify(envelope({ success: false, state: 'rejected', data: null, error: { code: 'nope' } })));
  } else if (mode === 'missing_data') {
    const value = envelope();
    delete value.data.paths;
    process.stdout.write(JSON.stringify(value));
  } else if (mode === 'paths_array') {
    const value = envelope();
    value.data.paths = [];
    process.stdout.write(JSON.stringify(value));
  } else if (mode === 'unexpected_action') {
    process.stdout.write(JSON.stringify(envelope({ action: 'publish_transcript' })));
  } else if (mode === 'exit1_failure') {
    process.stdout.write(JSON.stringify(envelope({ success: false, state: 'failed', data: null, error: { code: 'unknown' } })));
    process.exitCode = 1;
  } else if (mode === 'exit2') {
    process.stdout.write(JSON.stringify(envelope({ success: false, state: 'rejected', data: null, error: { code: 'record_invalid' } })));
    process.exitCode = 2;
  } else if (mode === 'exit3') {
    process.stdout.write(JSON.stringify(envelope({ success: false, state: 'recovery_required', data: null, error: { code: 'journal_open' } })));
    process.exitCode = 3;
  } else if (mode === 'exit1_success') {
    process.stdout.write(JSON.stringify(envelope()));
    process.exitCode = 1;
  } else {
    process.stdout.write(JSON.stringify(envelope()));
  }
}
`;

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-writer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeFakeWriter(dir) {
  const writer = path.join(dir, 'fake_ingest_meeting.mjs');
  fs.writeFileSync(writer, FAKE_WRITER_SOURCE, 'utf8');
  return writer;
}

function makeConfig(dir, writer) {
  const lockRoot = path.join(dir, 'trusted-skills');
  fs.mkdirSync(lockRoot, { recursive: true });
  return resolveWriterConfig({
    cli: {
      python: process.execPath,
      meetingWriter: writer,
      workspaceRoot: dir,
      workspaceLockRoot: lockRoot,
      leaseId: 'lease-1'
    },
    env: {}
  });
}

function meetingRecord() {
  return buildMeetingRecord({
    id: 'meeting-1',
    title: 'Kickoff',
    date: 1776757200000,
    dateString: '2026-04-21T07:40:00.000Z',
    duration: 42,
    participants: [],
    speakers: [],
    channels: [],
    summary: { overview: 'Overview' },
    sentences: [{ text: 'Hello', raw_text: 'Hello', speaker_name: 'Ada', start_time: 0 }]
  }, { accountRef: null });
}

test('transport: explicit CLI values beat environment fallbacks and record fields never supply them', () => {
  const config = resolveWriterConfig({
    cli: {
      python: '/trusted/python',
      meetingWriter: '/trusted/ingest_meeting.py',
      workspaceRoot: '/trusted/workspace',
      workspaceLockRoot: '/trusted/skills',
      leaseId: 'lease-1'
    },
    env: {
      MEETING_DESK_PYTHON: '/env/python',
      MEETING_DESK_WRITER: '/env/writer.py'
    }
  });
  assert.equal(config.python, '/trusted/python');
  assert.equal(config.writer, '/trusted/ingest_meeting.py');
  assert.equal(config.leaseId, 'lease-1');

  const envOnly = resolveWriterConfig({
    cli: {},
    env: {
      MEETING_DESK_PYTHON: '/env/python',
      MEETING_DESK_WRITER: '/env/writer.py'
    }
  });
  assert.equal(envOnly.python, '/env/python');
  assert.equal(envOnly.writer, '/env/writer.py');
});

test('transport: capabilities must report the frozen record schema and writer version', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);

  const data = await checkWriterCapabilities(config);
  assert.equal(data.record_schema, WRITER_RECORD_SCHEMA);
  assert.equal(data.writer_version, WRITER_VERSION);

  process.env.FAKE_CAPS = 'wrong_schema';
  t.after(() => { delete process.env.FAKE_CAPS; });
  await assert.rejects(
    () => checkWriterCapabilities(config),
    (error) => {
      assert.ok(error instanceof WriterTransportError);
      assert.equal(error.kind, 'capabilities');
      return true;
    }
  );
});

test('transport: malformed capabilities fail closed before any import could start', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  process.env.FAKE_CAPS = 'malformed';
  t.after(() => { delete process.env.FAKE_CAPS; });

  await assert.rejects(
    () => checkWriterCapabilities(config),
    (error) => error.kind === 'capabilities' && /envelope/.test(error.message)
  );
});

test('transport: ingest sends exact UTF-8 JSON on stdin, no shell, and returns the validated data', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  const capture = path.join(dir, 'capture.json');
  process.env.FAKE_CAPTURE = capture;
  t.after(() => { delete process.env.FAKE_CAPTURE; });

  const record = meetingRecord();
  const data = await ingestRecord(record, {
    config,
    route: { topic: 'topic-a', project: 'project-b', event: 'event-c' },
    dryRun: true
  });

  assert.equal(data.meeting_id, 'meeting-1');
  assert.equal(data.changed, true);
  const captured = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.deepEqual(JSON.parse(captured.stdin), record);
  assert.ok(captured.args.includes('--record'));
  assert.ok(captured.args.includes('--workspace'));
  assert.ok(captured.args.includes('--lease-id'));
  assert.ok(captured.args.includes('--workspace-lock-root'));
  assert.ok(captured.args.includes('--conversation-id') === false);
  assert.ok(captured.args.includes('--topic'));
  assert.ok(captured.args.includes('--project'));
  assert.ok(captured.args.includes('--event'));
  assert.ok(captured.args.includes('--dry-run'));
  assert.ok(captured.args.includes('--json'));
});

test('transport: malformed stdout and trailing junk become outcome_unknown after a possible apply', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  const record = meetingRecord();

  for (const mode of ['malformed', 'trailing']) {
    process.env.FAKE_INGEST = mode;
    await assert.rejects(
      () => ingestRecord(record, { config }),
      (error) => error.kind === 'outcome_unknown'
        && error.recoveryRequired === true
        && error.outcomeUnknown === true
        && error.reason === 'malformed_envelope',
      `mode ${mode} must be an ambiguous apply outcome`
    );
  }
  delete process.env.FAKE_INGEST;
});

test('transport: contradictory exits and envelopes become outcome_unknown, not ordinary failures', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  const record = meetingRecord();

  const cases = [
    ['success_false', 'contradictory_envelope'],
    ['missing_data', 'malformed_success_data'],
    ['paths_array', 'malformed_success_data'],
    ['unexpected_action', 'unexpected_action'],
    ['exit1_success', 'contradictory_exit'],
    ['exit1_failure', 'nonzero_exit']
  ];
  for (const [mode, reason] of cases) {
    process.env.FAKE_INGEST = mode;
    await assert.rejects(
      () => ingestRecord(record, { config }),
      (error) => error.kind === 'outcome_unknown'
        && error.recoveryRequired === true
        && error.outcomeUnknown === true
        && error.reason === reason,
      `mode ${mode} must be an ambiguous apply outcome`
    );
  }

  delete process.env.FAKE_INGEST;
});

test('transport: exit 2 is a rejection and exit 3 is recovery_required, never a legacy fallback', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  const record = meetingRecord();

  process.env.FAKE_INGEST = 'exit2';
  await assert.rejects(
    () => ingestRecord(record, { config }),
    (error) => error.kind === 'rejected' && error.exitCode === 2 && error.recoveryRequired === false
  );

  process.env.FAKE_INGEST = 'exit3';
  await assert.rejects(
    () => ingestRecord(record, { config }),
    (error) => error.kind === 'recovery_required' && error.exitCode === 3 && error.recoveryRequired === true
  );

  delete process.env.FAKE_INGEST;
});

test('transport: a timeout is an unknown outcome and must request recovery inspection', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  const record = meetingRecord();
  process.env.FAKE_INGEST = 'hang';
  t.after(() => { delete process.env.FAKE_INGEST; });

  await assert.rejects(
    () => ingestRecord(record, { config, timeoutMs: 250 }),
    (error) => error.kind === 'outcome_unknown' && error.recoveryRequired === true
  );
});

test('transport: a record with an invalid shape is rejected before the child starts', async (t) => {
  const dir = makeTempDir(t);
  const writer = writeFakeWriter(dir);
  const config = makeConfig(dir, writer);
  const record = { ...meetingRecord(), schema: 'meeting-record/9' };

  await assert.rejects(
    () => ingestRecord(record, { config }),
    (error) => error.kind === 'record_invalid'
  );
});
