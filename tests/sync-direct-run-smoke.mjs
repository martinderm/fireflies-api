import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SYNC_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-meetings-to-memory.mjs');
const USAGE_ERROR = 'limit_must_be_between_1_and_50';

function createWorkspace(t) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-direct-run-'));
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  return workspaceRoot;
}

function createJunction(t, workspaceRoot) {
  const junctionRoot = path.join(workspaceRoot, 'junction');
  fs.symlinkSync(REPO_ROOT, junctionRoot, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => fs.rmSync(junctionRoot, { recursive: true, force: true }));
  return junctionRoot;
}

function runCli(scriptPath, workspaceRoot) {
  return spawnSync(process.execPath, [scriptPath, '--limit', '0'], {
    cwd: workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot, PWD: workspaceRoot },
    encoding: 'utf8',
    timeout: 30000
  });
}

function writeImportHarness(workspaceRoot) {
  const harnessPath = path.join(workspaceRoot, 'import-harness.mjs');
  fs.writeFileSync(harnessPath, `
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [normalPath, junctionPath, resultPath] = process.argv.slice(2);
const exitCodeBefore = process.exitCode ?? null;
const junctionModule = await import(pathToFileURL(junctionPath).href);
const normalModule = await import(pathToFileURL(normalPath).href);
await new Promise((resolve) => setImmediate(resolve));
fs.writeFileSync(resultPath, JSON.stringify({
  exitCodeBefore,
  exitCodeAfter: process.exitCode ?? null,
  junction: { runSync: typeof junctionModule.runSync, isDirectRun: junctionModule.isDirectRun() },
  normal: { runSync: typeof normalModule.runSync, isDirectRun: normalModule.isDirectRun() }
}));
`, 'utf8');
  return harnessPath;
}

test('direct run: the normal script path runs the CLI and rejects --limit 0 with exit 2', (t) => {
  const workspaceRoot = createWorkspace(t);
  const result = runCli(SYNC_SCRIPT, workspaceRoot);

  assert.equal(result.status, 2, `expected exit 2, got ${result.status}; stderr: ${result.stderr}`);
  assert.equal(result.stdout, '');
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error, USAGE_ERROR);
  assert.equal(envelope.exit_code, 2);
});

test('direct run: the same script through a junction runs the CLI with the same exit code and error', (t) => {
  const workspaceRoot = createWorkspace(t);
  const junctionRoot = createJunction(t, workspaceRoot);
  const junctionScript = path.join(junctionRoot, 'scripts', 'sync-meetings-to-memory.mjs');

  assert.notEqual(
    fs.realpathSync(junctionScript),
    junctionScript,
    'the fixture must really exercise a resolved junction/symlink path'
  );

  const result = runCli(junctionScript, workspaceRoot);

  assert.equal(
    result.status,
    2,
    `junction run must fail like the normal path, got exit ${result.status}; stderr: ${result.stderr}`
  );
  assert.equal(result.stdout, '');
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error, USAGE_ERROR);
  assert.equal(envelope.exit_code, 2);
});

test('module import: importing through the normal or junction path writes nothing and runs no CLI', (t) => {
  const workspaceRoot = createWorkspace(t);
  const junctionRoot = createJunction(t, workspaceRoot);
  const junctionScript = path.join(junctionRoot, 'scripts', 'sync-meetings-to-memory.mjs');
  const resultPath = path.join(workspaceRoot, 'import-result.json');
  const harnessPath = writeImportHarness(workspaceRoot);

  const child = spawnSync(process.execPath, [harnessPath, SYNC_SCRIPT, junctionScript, resultPath], {
    cwd: workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot, PWD: workspaceRoot },
    encoding: 'utf8',
    timeout: 30000
  });

  assert.equal(child.status, 0, `import harness failed: ${child.stderr}`);
  assert.equal(child.stdout, '', 'importing the module must not write to stdout');
  assert.equal(child.stderr, '', 'importing the module must not write to stderr');

  const observed = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  assert.equal(observed.exitCodeBefore, null);
  assert.equal(observed.exitCodeAfter, null, 'importing the module must not set an exit code');
  for (const side of ['normal', 'junction']) {
    assert.equal(observed[side].runSync, 'function', `${side} import must expose runSync`);
    assert.equal(observed[side].isDirectRun, false, `${side} import is not a direct run`);
  }
});

test('direct-run guard: the test runner is not a direct run and unreadable entry paths never throw', async () => {
  const module = await import(pathToFileURL(SYNC_SCRIPT).href);

  assert.equal(typeof module.isDirectRun, 'function');
  assert.equal(module.isDirectRun(), false, 'the test runner must never be treated as the sync CLI');
  assert.equal(module.isDirectRun(['node']), false);
  assert.equal(module.isDirectRun([]), false);
  assert.equal(
    module.isDirectRun(['node', path.join(os.tmpdir(), 'missing-fireflies-entry.mjs')]),
    false,
    'a missing entry path is not a direct run'
  );
});
