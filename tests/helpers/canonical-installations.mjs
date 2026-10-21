import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function hasMeetingDesk(root) {
  return fs.existsSync(path.join(root, 'scripts', 'verify_meeting_fixtures.py'))
    && fs.existsSync(path.join(root, 'scripts', 'ingest_meeting.py'));
}

function hasWorkspaceLock(root) {
  return fs.existsSync(path.join(root, 'scripts', 'workspace_lock_guard.py'))
    && fs.existsSync(path.join(root, 'scripts', 'invoke_workspace_lock.py'));
}

function ancestors(start) {
  const result = [];
  let current = path.resolve(start);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return result;
}

function worktreeCandidates() {
  const candidates = [];
  for (const ancestor of ancestors(process.cwd())) {
    if (path.basename(ancestor) !== 'worktree') continue;
    let children;
    try {
      children = fs.readdirSync(ancestor, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!child.isDirectory()) continue;
      const childPath = path.join(ancestor, child.name);
      candidates.push(path.join(childPath, 'oi35-canonical-meeting-writer', 'skills', 'meeting-desk'));
      let grandChildren;
      try {
        grandChildren = fs.readdirSync(childPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const grandChild of grandChildren) {
        if (!grandChild.isDirectory()) continue;
        candidates.push(path.join(childPath, grandChild.name, 'skills', 'meeting-desk'));
      }
    }
  }
  return candidates;
}

function conventionalCandidates() {
  const candidates = [];
  for (const ancestor of ancestors(process.cwd())) {
    if (path.basename(ancestor) === '.opencode') {
      const userRoot = path.dirname(ancestor);
      candidates.push(path.join(userRoot, 'agents', 'skills', 'office-intelligence', 'skills', 'meeting-desk'));
      candidates.push(path.join(userRoot, 'agents', 'skills', 'workspace-lock'));
    }
  }
  candidates.push(path.join(os.homedir(), 'agents', 'skills', 'office-intelligence', 'skills', 'meeting-desk'));
  candidates.push(path.join(os.homedir(), 'agents', 'skills', 'workspace-lock'));
  candidates.push(path.resolve('..', 'office-intelligence', 'skills', 'meeting-desk'));
  candidates.push(path.resolve('..', '..', 'office-intelligence', 'skills', 'meeting-desk'));
  candidates.push(path.resolve('..', 'workspace-lock'));
  candidates.push(path.resolve('..', '..', 'workspace-lock'));
  return candidates;
}

function firstMatching(candidates, predicate) {
  const seen = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue;
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (predicate(resolved)) return resolved;
  }
  return null;
}

export function findOiMeetingDeskRoot() {
  const root = firstMatching([
    process.env.OI_MEETING_DESK_ROOT,
    process.env.MEETING_DESK_SKILL_ROOT,
    ...conventionalCandidates(),
    ...worktreeCandidates()
  ], hasMeetingDesk);
  if (!root) {
    throw new Error(
      'canonical OI meeting-desk verifier not found. Set OI_MEETING_DESK_ROOT to a checkout containing scripts/verify_meeting_fixtures.py; this cross-repo dependency is required and is never skipped.'
    );
  }
  return root;
}

export function findWorkspaceLockRoot() {
  const root = firstMatching([
    process.env.WORKSPACE_LOCK_ROOT,
    ...conventionalCandidates(),
    ...worktreeCandidates().flatMap((candidate) => [
      path.join(candidate, '..', 'workspace-lock'),
      path.join(candidate, '..', '..', 'workspace-lock')
    ])
  ], hasWorkspaceLock);
  if (!root) {
    throw new Error(
      'trusted workspace-lock installation not found. Set WORKSPACE_LOCK_ROOT; the canonical guard is required and is never copied or skipped.'
    );
  }
  return root;
}
