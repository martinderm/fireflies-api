import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { relativeWorkspacePath } from '../scripts/_path-helpers.mjs';

const workspaceRoot = path.resolve(path.parse(process.cwd()).root, 'ws-root');

test('relativeWorkspacePath normalizes native separators to forward slashes', () => {
  const absolutePath = path.join(workspaceRoot, 'memory', 'x.md');
  const result = relativeWorkspacePath(workspaceRoot, absolutePath);
  assert.equal(result, 'memory/x.md');
  assert.equal(result.includes('\\'), false);
});

test('relativeWorkspacePath keeps forward-slash paths without separator churn', () => {
  const absolutePath = `${workspaceRoot}/memory/evidence/meetings/meetings.json`;
  const result = relativeWorkspacePath(workspaceRoot, absolutePath);
  assert.equal(result, 'memory/evidence/meetings/meetings.json');
  assert.equal(result.includes('//'), false);
});

test('relativeWorkspacePath resolves paths under the workspace root relative to it', () => {
  const absolutePath = path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'acme', 'meetings.json');
  assert.equal(relativeWorkspacePath(workspaceRoot, absolutePath), 'memory/evidence/projects/acme/meetings.json');
});

test('relativeWorkspacePath keeps ../ semantics for paths outside the workspace root', () => {
  const absolutePath = path.join(workspaceRoot, '..', 'outside-root', 'x.md');
  assert.equal(relativeWorkspacePath(workspaceRoot, absolutePath), '../outside-root/x.md');
});

test('relativeWorkspacePath returns an empty string for the workspace root itself', () => {
  assert.equal(relativeWorkspacePath(workspaceRoot, workspaceRoot), '');
});
