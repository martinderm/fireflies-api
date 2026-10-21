import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_GUARD_OUTPUT_BYTES = 64 * 1024;

const GUARD_SCRIPT = `
import json
import sys

try:
    from workspace_lock_guard import WorkspaceLockError, require_workspace_lock
    receipt = require_workspace_lock(
        sys.argv[1],
        lease_id=sys.argv[2],
        conversation_id=None,
        allow_legacy=False,
    )
    print(json.dumps({
        "ok": True,
        "state": receipt.state,
        "lease_id": receipt.lease_id,
        "workspace": str(receipt.workspace),
    }))
except WorkspaceLockError as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
    sys.exit(2)
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
    sys.exit(3)
`.trim();

export class WorkspaceLeaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'WorkspaceLeaseError';
    this.code = options.code ?? 'workspace-lock';
    this.exitCode = 2;
    this.state = options.state ?? null;
  }
}

function sanitize(value, max = 400) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function sameWorkspace(expected, actual) {
  if (process.platform === 'win32') {
    return expected.toLowerCase() === actual.toLowerCase();
  }
  return expected === actual;
}

export function resolveWorkspaceLockGuard(workspaceLockRoot) {
  if (typeof workspaceLockRoot !== 'string' || workspaceLockRoot.trim() === '') {
    throw new WorkspaceLeaseError('workspace-lock root is required for record publication', {
      code: 'workspace-lock-config'
    });
  }
  const scripts = path.join(path.resolve(workspaceLockRoot), 'scripts');
  const guard = path.join(scripts, 'workspace_lock_guard.py');
  const invoke = path.join(scripts, 'invoke_workspace_lock.py');
  if (!fs.existsSync(guard) || !fs.existsSync(invoke)) {
    throw new WorkspaceLeaseError(
      'trusted workspace-lock installation is incomplete: expected scripts/workspace_lock_guard.py and scripts/invoke_workspace_lock.py',
      { code: 'workspace-lock-config' }
    );
  }
  return { scripts, guard, invoke };
}

export function requireWorkspaceLease({
  python,
  workspaceLockRoot,
  workspace,
  leaseId,
  timeoutMs = 15000,
  env = process.env
} = {}) {
  if (typeof python !== 'string' || python.trim() === '') {
    throw new WorkspaceLeaseError('operator Python interpreter is required for the workspace-lock guard', {
      code: 'workspace-lock-config'
    });
  }
  if (typeof leaseId !== 'string' || leaseId.trim() === '') {
    throw new WorkspaceLeaseError('--lease-id is required for record publication', {
      code: 'workspace-lock-config'
    });
  }
  if (typeof workspace !== 'string' || workspace.trim() === '') {
    throw new WorkspaceLeaseError('--workspace is required for record publication', {
      code: 'workspace-lock-config'
    });
  }

  const resolved = resolveWorkspaceLockGuard(workspaceLockRoot);
  const pythonPath = [resolved.scripts, env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  const result = spawnSync(
    python,
    ['-c', GUARD_SCRIPT, path.resolve(workspace), leaseId],
    {
      cwd: resolved.scripts,
      env: { ...env, PYTHONPATH: pythonPath },
      shell: false,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: MAX_GUARD_OUTPUT_BYTES,
      windowsHide: true
    }
  );

  if (result.error) {
    const timedOut = result.error.code === 'ETIMEDOUT';
    throw new WorkspaceLeaseError(
      timedOut
        ? 'workspace-lock guard timed out'
        : `cannot start the workspace-lock guard: ${sanitize(result.error.message)}`,
      { code: timedOut ? 'workspace-lock-timeout' : 'workspace-lock-spawn' }
    );
  }
  if (result.signal) {
    throw new WorkspaceLeaseError(`workspace-lock guard was terminated by ${result.signal}`, {
      code: 'workspace-lock-signal'
    });
  }
  if (result.status !== 0) {
    let detail = sanitize(result.stderr);
    try {
      const parsed = JSON.parse(String(result.stdout ?? '').trim());
      if (parsed && typeof parsed.error === 'string') detail = sanitize(parsed.error);
    } catch {
      // Keep stderr detail.
    }
    throw new WorkspaceLeaseError(
      `workspace lease is not owned or is not active: ${detail || `guard exit ${result.status}`}`,
      { code: 'workspace-lock-denied', state: 'Denied' }
    );
  }

  let payload;
  try {
    payload = JSON.parse(String(result.stdout ?? '').trim());
  } catch {
    throw new WorkspaceLeaseError('workspace-lock guard returned malformed JSON', {
      code: 'workspace-lock-malformed'
    });
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload) || payload.ok !== true) {
    throw new WorkspaceLeaseError('workspace-lock guard did not confirm ownership', {
      code: 'workspace-lock-denied'
    });
  }
  if (payload.state !== 'Active') {
    throw new WorkspaceLeaseError(`workspace lease is not active (${sanitize(payload.state, 40) || 'unknown'})`, {
      code: 'workspace-lock-inactive',
      state: payload.state
    });
  }
  if (payload.lease_id !== leaseId) {
    throw new WorkspaceLeaseError('workspace lease is owned by a different lease', {
      code: 'workspace-lock-foreign',
      state: payload.state
    });
  }

  const expectedWorkspace = fs.realpathSync.native(path.resolve(workspace));
  let actualWorkspace;
  try {
    actualWorkspace = fs.realpathSync.native(path.resolve(String(payload.workspace ?? '')));
  } catch {
    actualWorkspace = path.resolve(String(payload.workspace ?? ''));
  }
  if (!sameWorkspace(expectedWorkspace, actualWorkspace)) {
    throw new WorkspaceLeaseError('workspace-lock guard confirmed a different workspace', {
      code: 'workspace-lock-workspace-mismatch',
      state: payload.state
    });
  }

  return {
    state: payload.state,
    leaseId,
    workspace: expectedWorkspace
  };
}
