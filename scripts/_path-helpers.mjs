import path from 'node:path';

export function relativeWorkspacePath(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
}
