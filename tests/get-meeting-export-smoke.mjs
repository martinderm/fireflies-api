import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  parseGetMeetingArgs,
  validateGetMeetingArgs
} from '../scripts/_fireflies-meetings.mjs';
import {
  discardStagedRecordExport,
  exportMeetingRecord,
  publishStagedRecordExport,
  resolveRecordExportTarget,
  stageRecordExport
} from '../scripts/get-meeting.mjs';
import { requireWorkspaceLease } from '../scripts/_workspace-lease.mjs';
import { buildMeetingRecord } from '../scripts/_meeting-record.mjs';
import { findWorkspaceLockRoot } from './helpers/canonical-installations.mjs';

const GET_MEETING_SCRIPT = fileURLToPath(new URL('../scripts/get-meeting.mjs', import.meta.url));

function createWorkspace(t) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-export-'));
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workspaceRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(workspaceRoot, '.agents'), { recursive: true });
  return workspaceRoot;
}

function meeting() {
  return {
    id: 'export-1',
    title: 'Export',
    date: 1776757200000,
    dateString: '2026-04-21T07:40:00.000Z',
    duration: 10,
    participants: [],
    speakers: [],
    channels: [],
    summary: { overview: 'Overview' },
    sentences: [{ text: 'Hello', raw_text: 'Hello', speaker_name: 'Ada', start_time: 0 }]
  };
}

function runCli(workspaceRoot, args, extraEnv = {}) {
  return spawnSync(process.execPath, [GET_MEETING_SCRIPT, ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot, PWD: workspaceRoot, ...extraEnv },
    encoding: 'utf8',
    timeout: 30000
  });
}

test('export args: lease, lock root, workspace and python are trusted CLI values', () => {
  const args = parseGetMeetingArgs([
    'id-1',
    '--output', 'data/x.meeting-export.json',
    '--lease-id', 'lease-1',
    '--workspace-lock-root', 'C:/trusted/skills',
    '--workspace', 'C:/workspace',
    '--python', 'C:/trusted/python.exe'
  ]);
  assert.equal(args.leaseId, 'lease-1');
  assert.equal(args.workspaceLockRoot, 'C:/trusted/skills');
  assert.equal(args.workspace, 'C:/workspace');
  assert.equal(args.python, 'C:/trusted/python.exe');
});

test('export args: a file output must be a JSON meeting-export record and never a markdown sidecar', () => {
  assert.throws(
    () => validateGetMeetingArgs(parseGetMeetingArgs(['id-1', '--output', 'notes.md'])),
    /output_must_end_with_meeting_export_json/
  );
  assert.throws(
    () => validateGetMeetingArgs(parseGetMeetingArgs(['id-1', '--format', 'markdown', '--output', 'data/x.meeting-export.json'])),
    /output_requires_json_record_export/
  );
});

test('export args: a record file output requires an explicit trusted lease and lock root', () => {
  assert.throws(
    () => validateGetMeetingArgs(parseGetMeetingArgs(['id-1', '--output', 'data/x.meeting-export.json'])),
    /output_requires_lease_id/
  );
  assert.throws(
    () => validateGetMeetingArgs(parseGetMeetingArgs(['id-1', '--output', 'data/x.meeting-export.json', '--lease-id', 'lease-1'])),
    /output_requires_workspace_lock_root/
  );
});

test('export target: only a path inside the selected workspace data zone is accepted', (t) => {
  const workspaceRoot = createWorkspace(t);
  const target = resolveRecordExportTarget({
    workspaceRoot,
    output: 'data/meeting.meeting-export.json'
  });
  assert.equal(target.absolutePath, path.join(fs.realpathSync.native(workspaceRoot), 'data', 'meeting.meeting-export.json'));
  assert.equal(target.relativePath, 'data/meeting.meeting-export.json');
});

test('export target: traversal and outside paths are rejected before API fetch', (t) => {
  const workspaceRoot = createWorkspace(t);
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: '../outside.meeting-export.json' }),
    /output_outside_workspace_data_zone/
  );
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: 'data/../../outside.meeting-export.json' }),
    /output_outside_workspace_data_zone/
  );
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: '/tmp/outside.meeting-export.json' }),
    /output_outside_workspace_data_zone/
  );
});

test('export target: a data zone or parent link that escapes the workspace is rejected', (t) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-export-link-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-export-outside-'));
  t.after(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  fs.symlinkSync(outside, path.join(workspaceRoot, 'data'), 'junction');
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: 'data/x.meeting-export.json' }),
    /workspace_data_zone_escapes_workspace/
  );

  fs.rmSync(path.join(workspaceRoot, 'data'));
  fs.mkdirSync(path.join(workspaceRoot, 'data'), { recursive: true });
  const dataLink = path.join(workspaceRoot, 'data', 'linked');
  fs.symlinkSync(outside, dataLink, 'junction');
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: 'data/linked/x.meeting-export.json' }),
    /output_path_escapes_workspace_data_zone/
  );
});

test('export target: a missing data zone or missing parent is a rejection, not an implicit mkdir', (t) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-export-nodata-'));
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: 'data/x.meeting-export.json' }),
    /workspace_data_zone_missing/
  );

  fs.mkdirSync(path.join(workspaceRoot, 'data'), { recursive: true });
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: 'data/missing/x.meeting-export.json' }),
    /output_parent_missing/
  );
});

test('export target: an existing target is rejected before any API or write attempt', (t) => {
  const workspaceRoot = createWorkspace(t);
  const existing = path.join(workspaceRoot, 'data', 'meeting.meeting-export.json');
  fs.writeFileSync(existing, '{"keep":"me"}', 'utf8');
  assert.throws(
    () => resolveRecordExportTarget({ workspaceRoot, output: 'data/meeting.meeting-export.json' }),
    /output_exists_no_clobber/
  );
  assert.equal(fs.readFileSync(existing, 'utf8'), '{"keep":"me"}');
});

test('export write: a valid record is written byte-deterministically and never clobbered', (t) => {
  const workspaceRoot = createWorkspace(t);
  const target = resolveRecordExportTarget({
    workspaceRoot,
    output: 'data/meeting.meeting-export.json'
  });
  const record = buildMeetingRecord(meeting(), { accountRef: null });

  const staged = stageRecordExport({ absolutePath: target.absolutePath, record });
  try {
    publishStagedRecordExport(staged);
  } finally {
    discardStagedRecordExport(staged);
  }
  const content = fs.readFileSync(target.absolutePath, 'utf8');
  assert.equal(content, `${JSON.stringify(record, null, 2)}\n`);
  assert.equal(JSON.parse(content).schema, 'meeting-record/1');

  const second = stageRecordExport({ absolutePath: target.absolutePath, record });
  try {
    assert.throws(() => publishStagedRecordExport(second), /output_exists_no_clobber/);
  } finally {
    discardStagedRecordExport(second);
  }
});

function lockPython() {
  return process.env.MEETING_DESK_PYTHON || 'python';
}

function runLock(action, workspaceRoot, leaseId, extraArgs = []) {
  const lockRoot = findWorkspaceLockRoot();
  const invoke = path.join(lockRoot, 'scripts', 'invoke_workspace_lock.py');
  const args = [invoke, action, workspaceRoot, '--json', ...extraArgs];
  if (leaseId) args.push('--lease-id', leaseId);
  return spawnSync(lockPython(), args, {
    shell: false,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
}

function acquireLease(t, workspaceRoot, leaseId) {
  const result = runLock('acquire', workspaceRoot, leaseId, ['--harness', 'opencode']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.state, 'Acquired');
  t.after(() => {
    try {
      runLock('release', workspaceRoot, leaseId, ['--force']);
    } catch {
      // Temp workspace cleanup follows; a release failure is not a second assertion.
    }
  });
}

function releaseLease(workspaceRoot, leaseId) {
  const result = runLock('release', workspaceRoot, leaseId, ['--force']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function expireLeaseFile(workspaceRoot) {
  const lockFile = path.join(workspaceRoot, '.agents', 'session.lock');
  const data = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  data.heartbeat = '2000-01-01T00:00:00+00:00';
  data.protectedUntil = '2000-01-01T00:00:00+00:00';
  fs.writeFileSync(lockFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function leaseArgs(workspaceRoot, leaseId) {
  return {
    python: lockPython(),
    workspaceLockRoot: findWorkspaceLockRoot(),
    workspace: workspaceRoot,
    leaseId
  };
}

function assertNoExport(workspaceRoot) {
  const dataDir = path.join(workspaceRoot, 'data');
  assert.equal(fs.existsSync(path.join(dataDir, 'meeting.meeting-export.json')), false);
  assert.deepEqual(fs.readdirSync(dataDir), [], 'no staged or published export may remain');
}

test('lease guard: missing, foreign and expired real leases are rejected', (t) => {
  const workspaceRoot = createWorkspace(t);

  assert.throws(
    () => requireWorkspaceLease(leaseArgs(workspaceRoot, 'lease-a')),
    (error) => error.code === 'workspace-lock-denied' || error.code === 'workspace-lock-inactive'
  );

  acquireLease(t, workspaceRoot, 'lease-a');
  assert.doesNotThrow(() => requireWorkspaceLease(leaseArgs(workspaceRoot, 'lease-a')));
  assert.throws(
    () => requireWorkspaceLease(leaseArgs(workspaceRoot, 'lease-b')),
    (error) => error.code === 'workspace-lock-foreign' || error.code === 'workspace-lock-denied'
  );

  expireLeaseFile(workspaceRoot);
  assert.throws(
    () => requireWorkspaceLease(leaseArgs(workspaceRoot, 'lease-a')),
    (error) => error.code === 'workspace-lock-denied' || error.code === 'workspace-lock-inactive'
  );
});

test('export publication: a lease released after fetch leaves zero export and no staging file', async (t) => {
  const workspaceRoot = createWorkspace(t);
  acquireLease(t, workspaceRoot, 'lease-a');

  await assert.rejects(
    () => exportMeetingRecord({
      workspaceRoot,
      output: 'data/meeting.meeting-export.json',
      leaseId: 'lease-a',
      workspaceLockRoot: findWorkspaceLockRoot(),
      python: lockPython(),
      fetchMeeting: async () => {
        releaseLease(workspaceRoot, 'lease-a');
        return meeting();
      }
    }),
    (error) => error.code === 'workspace-lock-denied' || error.code === 'workspace-lock-inactive'
  );
  assertNoExport(workspaceRoot);
});

test('export publication: a lease replaced after fetch leaves zero export and no staging file', async (t) => {
  const workspaceRoot = createWorkspace(t);
  acquireLease(t, workspaceRoot, 'lease-a');

  await assert.rejects(
    () => exportMeetingRecord({
      workspaceRoot,
      output: 'data/meeting.meeting-export.json',
      leaseId: 'lease-a',
      workspaceLockRoot: findWorkspaceLockRoot(),
      python: lockPython(),
      fetchMeeting: async () => {
        releaseLease(workspaceRoot, 'lease-a');
        const acquired = runLock('acquire', workspaceRoot, 'lease-b', ['--harness', 'opencode']);
        assert.equal(acquired.status, 0, acquired.stderr || acquired.stdout);
        return meeting();
      }
    }),
    (error) => error.code === 'workspace-lock-foreign' || error.code === 'workspace-lock-denied'
  );
  assertNoExport(workspaceRoot);
});

test('export publication: a lease replaced after staging but before publication leaves zero export and no staging file', async (t) => {
  const workspaceRoot = createWorkspace(t);
  acquireLease(t, workspaceRoot, 'lease-a');

  await assert.rejects(
    () => exportMeetingRecord({
      workspaceRoot,
      output: 'data/meeting.meeting-export.json',
      leaseId: 'lease-a',
      workspaceLockRoot: findWorkspaceLockRoot(),
      python: lockPython(),
      fetchMeeting: async () => meeting(),
      afterStage: async () => {
        releaseLease(workspaceRoot, 'lease-a');
        const acquired = runLock('acquire', workspaceRoot, 'lease-b', ['--harness', 'opencode']);
        assert.equal(acquired.status, 0, acquired.stderr || acquired.stdout);
      }
    }),
    (error) => error.code === 'workspace-lock-foreign' || error.code === 'workspace-lock-denied'
  );
  assertNoExport(workspaceRoot);
});

test('export publication: an owned active lease publishes one record', async (t) => {
  const workspaceRoot = createWorkspace(t);
  acquireLease(t, workspaceRoot, 'lease-a');

  const exported = await exportMeetingRecord({
    workspaceRoot,
    output: 'data/meeting.meeting-export.json',
    leaseId: 'lease-a',
    workspaceLockRoot: findWorkspaceLockRoot(),
    python: lockPython(),
    fetchMeeting: async () => meeting()
  });
  assert.equal(exported.record.schema, 'meeting-record/1');
  assert.equal(exported.output, 'data/meeting.meeting-export.json');
  const content = fs.readFileSync(path.join(workspaceRoot, 'data', 'meeting.meeting-export.json'), 'utf8');
  assert.equal(JSON.parse(content).meeting_id, 'export-1');
  assert.deepEqual(fs.readdirSync(path.join(workspaceRoot, 'data')), ['meeting.meeting-export.json']);
});

test('cli: a markdown --output is rejected as usage before any API call', (t) => {
  const workspaceRoot = createWorkspace(t);
  const result = runCli(workspaceRoot, ['id-1', '--format', 'markdown', '--output', 'data/x.md']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /output_must_end_with_meeting_export_json/);
  assert.doesNotMatch(result.stderr, /missing_secrets_file/);
});

test('cli: a record output without a trusted lease is rejected before any API call', (t) => {
  const workspaceRoot = createWorkspace(t);
  const result = runCli(workspaceRoot, ['id-1', '--output', 'data/x.meeting-export.json']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /output_requires_lease_id/);
  assert.doesNotMatch(result.stderr, /missing_secrets_file/);
});

test('cli: an outside record output is rejected before the lease or API is touched', (t) => {
  const workspaceRoot = createWorkspace(t);
  const result = runCli(workspaceRoot, [
    'id-1',
    '--output', '../x.meeting-export.json',
    '--lease-id', 'lease-1',
    '--workspace-lock-root', path.join(workspaceRoot, 'missing-lock-root')
  ]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /output_outside_workspace_data_zone/);
  assert.doesNotMatch(result.stderr, /missing_secrets_file/);
});
