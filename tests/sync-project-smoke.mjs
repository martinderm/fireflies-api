import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  parseSyncArgs,
  readRegistryFile,
  resolveRouting,
  runSync
} from '../scripts/sync-meetings-to-memory.mjs';

const SYNC_SCRIPT = fileURLToPath(new URL('../scripts/sync-meetings-to-memory.mjs', import.meta.url));

function createWorkspace(t) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-sync-cli-'));
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workspaceRoot, '.agents'), { recursive: true });
  const meetingsRoot = path.join(workspaceRoot, 'memory', 'evidence', 'meetings');
  fs.mkdirSync(meetingsRoot, { recursive: true });
  return { workspaceRoot, meetingsRoot, registryPath: path.join(meetingsRoot, 'meetings.json') };
}

function writeFakeWriter(dir, capabilitiesExitCode = 0) {
  const writer = path.join(dir, 'fake_ingest_meeting.mjs');
  fs.writeFileSync(writer, `
if (process.argv.slice(2).includes('--capabilities')) {
  if (${capabilitiesExitCode} !== 0) {
    process.stderr.write('capabilities failed');
    process.exitCode = ${capabilitiesExitCode};
  } else {
    process.stdout.write(JSON.stringify({
      action: 'capabilities', success: true, state: 'ready', message: 'ok',
      data: { record_schema: 'meeting-record/1', writer_version: 'meeting-desk/1' }, error: null
    }));
  }
} else {
  process.stdout.write(JSON.stringify({
    action: 'ingest', success: true, state: 'committed', message: 'ok',
    data: { entry: {}, meeting_id: 'x', paths: {}, changed: false }, error: null
  }));
}
`, 'utf8');
  return writer;
}

function runSyncCli(workspaceRoot, args, extraEnv = {}) {
  return spawnSync(process.execPath, [SYNC_SCRIPT, ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot, PWD: workspaceRoot, ...extraEnv },
    encoding: 'utf8',
    timeout: 30000
  });
}

test('sync args: an absent --project-slug is a valid unmapped intake, not a routing error', () => {
  const args = parseSyncArgs(['--limit', '1']);
  assert.deepEqual(resolveRouting(args), { topic: null, project: null, event: null });
  assert.equal(args.projectSlugRaw, undefined);
});

test('sync args: --project, --topic and --event are the canonical routing options', () => {
  const args = parseSyncArgs(['--project', 'pjr', '--topic', 'kickoff', '--event', 'launch']);
  assert.deepEqual(resolveRouting(args), { topic: 'kickoff', project: 'pjr', event: 'launch' });
});

test('sync args: legacy routing aliases still map onto the canonical route', () => {
  const args = parseSyncArgs(['--project-slug', 'pjr', '--topic-slug', 'kickoff', '--event-slug', 'launch']);
  assert.deepEqual(resolveRouting(args), { topic: 'kickoff', project: 'pjr', event: 'launch' });
});

test('sync args: explicit empty or empty-normalizing route values fail loud before any API call', () => {
  for (const value of ['', '---', '   ']) {
    assert.throws(
      () => resolveRouting(parseSyncArgs(['--project-slug', value])),
      /empty_project_slug:/,
      `project ${JSON.stringify(value)} must be rejected`
    );
  }
  assert.throws(
    () => resolveRouting(parseSyncArgs(['--project-slug', 'ohne-channel'])),
    /empty_project_slug:ohne-channel/
  );
});

test('sync args: a flag following --project-slug is rejected as a missing value', () => {
  assert.throws(() => parseSyncArgs(['--project-slug', '--limit']), /missing value for --project-slug/);
});

test('sync args: writer transport configuration is explicit and never taken from a route value', () => {
  const args = parseSyncArgs([
    '--meeting-writer', 'C:/trusted/ingest_meeting.py',
    '--python', 'C:/trusted/python.exe',
    '--workspace-lock-root', 'C:/trusted/skills',
    '--lease-id', 'lease-1',
    '--conversation-id', 'conv-1'
  ]);
  assert.equal(args.meetingWriter, 'C:/trusted/ingest_meeting.py');
  assert.equal(args.python, 'C:/trusted/python.exe');
  assert.equal(args.workspaceLockRoot, 'C:/trusted/skills');
  assert.equal(args.leaseId, 'lease-1');
  assert.equal(args.conversationId, 'conv-1');
});

test('registry: a missing register is distinguishable from a corrupt one', (t) => {
  const workspace = createWorkspace(t);
  const missing = readRegistryFile(workspace.registryPath);
  assert.equal(missing.exists, false);
  assert.deepEqual(missing.document, { meetings: [] });

  fs.writeFileSync(workspace.registryPath, '{ broken', 'utf8');
  assert.throws(() => readRegistryFile(workspace.registryPath), /registry_invalid_json/);
});

test('registry: a bare legacy array fails instead of being reset or silently converted', (t) => {
  const workspace = createWorkspace(t);
  fs.writeFileSync(workspace.registryPath, '[]', 'utf8');
  assert.throws(() => readRegistryFile(workspace.registryPath), /registry_legacy_array_unsupported/);

  fs.writeFileSync(workspace.registryPath, '{"meetings": {}}', 'utf8');
  assert.throws(() => readRegistryFile(workspace.registryPath), /registry_meetings_not_array/);
});

test('registry: a canonical object keeps unknown root metadata for the writer', (t) => {
  const workspace = createWorkspace(t);
  fs.writeFileSync(
    workspace.registryPath,
    `${JSON.stringify({ meetings: [{ meeting_id: 'm1' }], channel_strategy: { mode: 'scarce_channels' }, future_root: { keep: true } }, null, 2)}\n`,
    'utf8'
  );
  const result = readRegistryFile(workspace.registryPath);
  assert.equal(result.exists, true);
  assert.deepEqual(result.document.future_root, { keep: true });
  assert.deepEqual(result.document.channel_strategy, { mode: 'scarce_channels' });
  assert.equal(result.document.meetings.length, 1);
});

test('sync cli: a missing project route reaches writer configuration instead of empty_project_slug', (t) => {
  const workspace = createWorkspace(t);
  const result = runSyncCli(workspace.workspaceRoot, ['--limit', '1']);

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /missing_writer_config/);
  assert.doesNotMatch(result.stderr, /empty_project_slug/);
  assert.doesNotMatch(result.stderr, /missing_secrets_file/);
});

test('sync cli: a corrupt registry is rejected after capabilities but before any list API call', (t) => {
  const workspace = createWorkspace(t);
  fs.writeFileSync(workspace.registryPath, '[]', 'utf8');
  const writer = writeFakeWriter(workspace.workspaceRoot);
  const result = runSyncCli(workspace.workspaceRoot, [
    '--limit', '1',
    '--meeting-writer', writer,
    '--python', process.execPath,
    '--workspace-lock-root', workspace.workspaceRoot,
    '--lease-id', 'lease-1'
  ]);

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /registry_legacy_array_unsupported/);
  assert.doesNotMatch(result.stderr, /missing_secrets_file/);
});

test('sync cli: capabilities fail closed before the registry or any live API is touched', (t) => {
  const workspace = createWorkspace(t);
  fs.writeFileSync(workspace.registryPath, '[]', 'utf8');
  const writer = writeFakeWriter(workspace.workspaceRoot, 2);
  const result = runSyncCli(workspace.workspaceRoot, [
    '--limit', '1',
    '--meeting-writer', writer,
    '--python', process.execPath,
    '--workspace-lock-root', workspace.workspaceRoot,
    '--lease-id', 'lease-1'
  ]);

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /capabilities/);
  assert.doesNotMatch(result.stderr, /registry_legacy_array_unsupported/);
  assert.doesNotMatch(result.stderr, /missing_secrets_file/);
});

test('sync cli: explicit empty project values still fail as usage errors before writer setup', (t) => {
  const workspace = createWorkspace(t);
  const result = runSyncCli(workspace.workspaceRoot, ['--project-slug', '---', '--limit', '1']);

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /empty_project_slug:---/);
  assert.doesNotMatch(result.stderr, /missing_writer_config/);
});

test('sync cli: the old relocate command is no longer part of the adapter surface', () => {
  const relocate = fileURLToPath(new URL('../scripts/relocate-local-meeting.mjs', import.meta.url));
  assert.equal(fs.existsSync(relocate), false);
});

function baseMeeting(overrides = {}) {
  return {
    id: 'cli-meet-1',
    title: 'CLI Kickoff',
    date: 1776757200000,
    dateString: '2026-04-21T07:40:00.000Z',
    duration: 15,
    participants: ['a@example.com'],
    speakers: [],
    channels: [{ id: 'c1', title: 'Ops' }],
    summary: { overview: 'Overview' },
    sentences: [{ text: 'Hello', raw_text: 'Hello', speaker_name: 'Ada', start_time: 0 }],
    ...overrides
  };
}

function writeStubWriter(dir) {
  const writer = path.join(dir, 'stub_ingest_meeting.mjs');
  fs.writeFileSync(writer, '// exists only so trusted writer-config validation passes\n', 'utf8');
  return writer;
}

test('sync function: no routing still delegates a valid unmapped record through the writer boundary', async (t) => {
  const workspace = createWorkspace(t);
  const writerFile = writeStubWriter(workspace.workspaceRoot);
  const meeting = baseMeeting();
  const calls = [];
  const writer = {
    async ingestRecord(record, options) {
      calls.push({ record, options });
      return {
        entry: { meeting_id: record.meeting_id },
        meeting_id: record.meeting_id,
        paths: { summary: 'memory/evidence/meetings/ops/summary.md' },
        changed: true
      };
    }
  };
  const graph = async ({ variables }) => {
    if (variables?.transcriptId) return { transcript: meeting };
    return { transcripts: [{ id: meeting.id, title: meeting.title }] };
  };

  const result = await runSync({
    argv: [
      '--limit', '1',
      '--meeting-writer', writerFile,
      '--python', process.execPath,
      '--workspace-lock-root', workspace.workspaceRoot,
      '--lease-id', 'lease-1'
    ],
    graph,
    writer,
    workspaceRoot: workspace.workspaceRoot,
    settings: {},
    env: {}
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.envelope.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.route, { topic: null, project: null, event: null });
  assert.equal(calls[0].record.schema, 'meeting-record/1');
  assert.equal(calls[0].record.classification_hint.project_slug, null);
  assert.equal(fs.existsSync(workspace.registryPath), false, 'sync itself never creates a register');
});

test('sync function: a register-bound account with an unknown current account stops before API and writer', async (t) => {
  const workspace = createWorkspace(t);
  const writerFile = writeStubWriter(workspace.workspaceRoot);
  fs.writeFileSync(workspace.registryPath, `${JSON.stringify({
    channel_mappings: {},
    meetings: [{
      meeting_id: 'cli-meet-1',
      source: {
        system: 'fireflies',
        external_id: 'cli-meet-1',
        account_ref: 'owner@example.com'
      }
    }]
  }, null, 2)}\n`, 'utf8');
  let graphCalls = 0;
  let writerCalls = 0;
  const graph = async () => {
    graphCalls += 1;
    throw new Error('api_must_not_be_called');
  };
  const writer = {
    async ingestRecord(record) {
      writerCalls += 1;
      return { entry: {}, meeting_id: record.meeting_id, paths: {}, changed: true };
    }
  };

  const result = await runSync({
    argv: [
      '--meeting-id', 'cli-meet-1',
      '--meeting-writer', writerFile,
      '--python', process.execPath,
      '--workspace-lock-root', workspace.workspaceRoot,
      '--lease-id', 'lease-1'
    ],
    graph,
    writer,
    workspaceRoot: workspace.workspaceRoot,
    settings: {},
    env: {}
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.envelope.ok, false);
  assert.equal(result.envelope.failed, 1);
  assert.match(result.envelope.failures[0].error.message, /unresolved_account_binding/);
  assert.equal(graphCalls, 0, 'no list or detail API may run before registry account preflight');
  assert.equal(writerCalls, 0, 'no writer call is allowed for an unresolved account binding');
});

test('sync function: an explicit project route is forwarded without becoming a classification approval', async (t) => {
  const workspace = createWorkspace(t);
  const writerFile = writeStubWriter(workspace.workspaceRoot);
  const meeting = baseMeeting();
  const calls = [];
  const writer = {
    async ingestRecord(record, options) {
      calls.push({ record, options });
      return {
        entry: { meeting_id: record.meeting_id },
        meeting_id: record.meeting_id,
        paths: {},
        changed: true
      };
    }
  };
  const graph = async ({ variables }) => {
    if (variables?.transcriptId) return { transcript: meeting };
    return { transcripts: [{ id: meeting.id, title: meeting.title }] };
  };

  const result = await runSync({
    argv: [
      '--limit', '1',
      '--project', 'pjr-relaunch',
      '--meeting-writer', writerFile,
      '--python', process.execPath,
      '--workspace-lock-root', workspace.workspaceRoot,
      '--lease-id', 'lease-1'
    ],
    graph,
    writer,
    workspaceRoot: workspace.workspaceRoot,
    settings: {},
    env: {}
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls[0].options.route, { topic: null, project: 'pjr-relaunch', event: null });
  assert.equal(calls[0].record.classification_hint.project_slug, null);
  assert.equal(calls[0].record.review.recommended, true);
});
