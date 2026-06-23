import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://api.fireflies.ai/graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rawRoot = path.resolve(__dirname, '..', '..', '..');
const scriptRoot = path.basename(rawRoot) === '.agents' ? path.dirname(rawRoot) : rawRoot;

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((entry) => path.resolve(entry)))];
}

function collectAncestors(startPath) {
  if (!startPath) {
    return [];
  }

  const resolved = path.resolve(startPath);
  const ancestors = [];
  let current = resolved;

  while (true) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return ancestors;
}

function looksLikeWorkspaceRoot(dirPath) {
  return [
    path.join(dirPath, 'settings.json'),
    path.join(dirPath, 'AGENTS.md'),
    path.join(dirPath, '.agents'),
    path.join(dirPath, 'secrets.json')
  ].some((candidate) => fs.existsSync(candidate));
}

function candidateWorkspaceRoots() {
  const envRoot = process.env.WORKSPACE_ROOT;
  const logicalPwd = process.env.PWD;
  const cwdAncestors = collectAncestors(process.cwd());
  const logicalPwdAncestors = collectAncestors(logicalPwd);
  const argvScriptRoot = process.argv[1]
    ? path.resolve(path.dirname(path.resolve(process.argv[1])), '..', '..', '..')
    : null;
  const derivedRoots = [
    envRoot,
    logicalPwd,
    process.cwd(),
    argvScriptRoot,
    scriptRoot
  ];

  const discovered = [];
  for (const candidate of uniquePaths([...derivedRoots, ...cwdAncestors, ...logicalPwdAncestors])) {
    if (looksLikeWorkspaceRoot(candidate)) {
      discovered.push(candidate);
    }
  }

  return uniquePaths(discovered);
}

export function resolveWorkspaceRoot() {
  const roots = candidateWorkspaceRoots();
  return roots[0] || scriptRoot;
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();

function candidateSecretsPaths() {
  const workspaceCandidates = candidateWorkspaceRoots().flatMap((root) => [
    path.join(root, '.agents', 'secrets.json'),
    path.join(root, 'secrets.json')
  ]);

  return uniquePaths([
    ...workspaceCandidates,
    path.join(os.homedir(), '.openclaw', 'secrets.json')
  ]);
}

function loadSecretsJson() {
  const tried = [];

  for (const secretsPath of candidateSecretsPaths()) {
    tried.push(secretsPath);
    if (!fs.existsSync(secretsPath)) {
      continue;
    }

    const raw = fs.readFileSync(secretsPath, 'utf8');
    return JSON.parse(raw);
  }

  throw new Error(`missing_secrets_file:${tried.join('|')}`);
}

export function loadSettingsJson() {
  const candidates = uniquePaths(candidateWorkspaceRoots().map((root) => path.join(root, 'settings.json')));
  for (const settingsPath of candidates) {
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        return JSON.parse(raw);
      } catch {
        // ignore parsing errors
      }
    }
  }
  return {};
}

function resolveAccount(secrets, requestedAccount) {
  if (requestedAccount) {
    return requestedAccount;
  }

  const settings = loadSettingsJson();
  const settingsAccount = settings?.['fireflies-api']?.account || settings?.fireflies?.account;
  if (settingsAccount) {
    return settingsAccount;
  }

  const accounts = secrets?.integrations?.fireflies?.accounts;
  if (!accounts || typeof accounts !== 'object') {
    return null;
  }

  const firstAccount = Object.keys(accounts).find((key) => Boolean(key));
  return firstAccount ?? null;
}

export function loadApiKey(account) {
  const secrets = loadSecretsJson();
  const resolvedAccount = resolveAccount(secrets, account);
  if (!resolvedAccount) {
    throw new Error('missing_account_ref');
  }

  const apiKey = secrets?.integrations?.fireflies?.accounts?.[resolvedAccount]?.apiKey;

  if (!apiKey) {
    throw new Error(`missing_api_key:${resolvedAccount}`);
  }

  return apiKey;
}

export async function firefliesGraphQL({ query, variables = {}, account } = {}) {
  const apiKey = loadApiKey(account);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const error = new Error(`http_${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  if (body?.errors?.length) {
    const error = new Error('graphql_error');
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body?.data ?? {};
}

export function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}
`);
}

export function printError(error) {
  const payload = {
    ok: false,
    error: error?.message ?? 'unknown_error',
    status: error?.status ?? null,
    body: error?.body ?? null
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}
`);
}
