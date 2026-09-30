import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadSecretsJson } from '../scripts/_fireflies-client.mjs';

const FIREFLIES_DOC = {
  integrations: {
    fireflies: {
      accounts: {
        'primary@example.com': { apiKey: 'fireflies-primary-key' }
      }
    }
  }
};

const LATER_FIREFLIES_DOC = {
  integrations: {
    fireflies: {
      accounts: {
        'later@example.com': { apiKey: 'fireflies-later-key' }
      }
    }
  }
};

const FOREIGN_DOC = {
  integrations: {
    sumup: {
      accounts: {
        'shop@example.com': { apiKey: 'sumup-key' }
      }
    }
  }
};

const OTHER_FOREIGN_DOC = {
  integrations: {
    clockify: {
      workspace: 'clockify-workspace'
    }
  }
};

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-client-'));
}

function writeJson(dir, name, document) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, JSON.stringify(document), 'utf8');
  return filePath;
}

test('fallback: skip existing candidate without fireflies and take later fireflies candidate', () => {
  const dir = makeTempDir();
  const foreignPath = writeJson(dir, 'secrets.json', FOREIGN_DOC);
  const firefliesPath = writeJson(dir, 'openclaw-secrets.json', FIREFLIES_DOC);

  const result = loadSecretsJson([foreignPath, firefliesPath]);

  assert.deepEqual(result, FIREFLIES_DOC);
});

test('priority: first existing candidate with fireflies wins over later candidates', () => {
  const dir = makeTempDir();
  const localPath = writeJson(dir, 'local.json', FIREFLIES_DOC);
  const laterPath = writeJson(dir, 'later.json', LATER_FIREFLIES_DOC);

  const result = loadSecretsJson([localPath, laterPath]);

  assert.deepEqual(result, FIREFLIES_DOC);
});

test('no candidate with fireflies: first existing document is returned', () => {
  const dir = makeTempDir();
  const firstPath = writeJson(dir, 'first.json', FOREIGN_DOC);
  const secondPath = writeJson(dir, 'second.json', OTHER_FOREIGN_DOC);

  const result = loadSecretsJson([firstPath, secondPath]);

  assert.deepEqual(result, FOREIGN_DOC);
});

test('no existing candidate: missing_secrets_file lists every tried path', () => {
  const dir = makeTempDir();
  const missingA = path.join(dir, 'missing-a.json');
  const missingB = path.join(dir, 'missing-b.json');

  assert.throws(
    () => loadSecretsJson([missingA, missingB]),
    (error) => {
      assert.match(error.message, /^missing_secrets_file:/);
      assert.ok(error.message.includes(missingA), 'tried list contains first path');
      assert.ok(error.message.includes(missingB), 'tried list contains second path');
      return true;
    }
  );
});

test('invalid JSON still throws', () => {
  const dir = makeTempDir();
  const brokenPath = path.join(dir, 'broken.json');
  fs.writeFileSync(brokenPath, '{ "integrations": ', 'utf8');

  assert.throws(() => loadSecretsJson([brokenPath]), SyntaxError);
});

test('lazy scan: a later invalid candidate does not break an earlier fireflies match', () => {
  const dir = makeTempDir();
  const firefliesPath = writeJson(dir, 'fireflies.json', FIREFLIES_DOC);
  const brokenPath = path.join(dir, 'broken.json');
  fs.writeFileSync(brokenPath, '{ "integrations": ', 'utf8');

  const result = loadSecretsJson([firefliesPath, brokenPath]);

  assert.deepEqual(result, FIREFLIES_DOC);
});
