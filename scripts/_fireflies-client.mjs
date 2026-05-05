import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://api.fireflies.ai/graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

function candidateSecretsPaths() {
  return [
    path.join(os.homedir(), '.openclaw', 'secrets.json'),
    path.join(WORKSPACE_ROOT, 'secrets.json')
  ];
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

function resolveAccount(secrets, requestedAccount) {
  if (requestedAccount) {
    return requestedAccount;
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
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

export function printError(error) {
  const payload = {
    ok: false,
    error: error?.message ?? 'unknown_error',
    status: error?.status ?? null,
    body: error?.body ?? null
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
}
