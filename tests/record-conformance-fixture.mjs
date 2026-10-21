import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateMeetingRecord } from '../scripts/_meeting-record.mjs';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/meeting-record-v1.json', import.meta.url));
const FIXTURE_SCHEMA = 'meeting-record-fixtures/1';
const EXPECTED_FIXTURE_DIGEST = '6f54ab761d451289ba90f98e0a7b50859f30d209239a6f893201d373f62c955d';
const EXPECTED_SOURCE_FILE_SHA256 = '48bbe533b83b46eaf792156ae2fbbd82e1fe56171139d8b768d39e3da1599295';
const EXPECTED_COUNTS = { valid: 11, invalid: 19, raw_invalid: 5 };

function python() {
  return process.env.MEETING_DESK_PYTHON || 'python';
}

function loadFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    assert.fail(
      `fixture_missing: ${path.relative(process.cwd(), FIXTURE_PATH)} must be vendored byte-identically from the OI meeting-desk SSOT`
    );
  }
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function canonicalDigest() {
  const script = [
    'import hashlib, json, sys',
    'pack = json.loads(open(sys.argv[1], encoding="utf-8").read())',
    'covered = {key: pack[key] for key in ("valid_records", "invalid_records", "raw_invalid_json")}',
    'canonical = json.dumps(covered, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)',
    'print(hashlib.sha256(canonical.encode("utf-8")).hexdigest())'
  ].join('\n');
  const result = spawnSync(python(), ['-c', script, FIXTURE_PATH], {
    shell: false,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `python_missing: ${result.error?.message ?? ''}`);
  assert.equal(result.status, 0, result.stderr);
  return String(result.stdout).trim();
}

test('conformance fixture: byte identity, canonical digest, schema and counts are pinned', () => {
  const fixture = loadFixture();
  assert.equal(fixture.schema, FIXTURE_SCHEMA);
  assert.equal(fixture.record_schema, 'meeting-record/1');
  assert.equal(fixture.writer_version, 'meeting-desk/1');
  assert.equal(fixture.manifest.algorithm, 'sha256');
  assert.equal(fixture.manifest.digest, EXPECTED_FIXTURE_DIGEST);
  assert.equal(canonicalDigest(), EXPECTED_FIXTURE_DIGEST);

  const fileSha = crypto.createHash('sha256').update(fs.readFileSync(FIXTURE_PATH)).digest('hex');
  assert.equal(fileSha, EXPECTED_SOURCE_FILE_SHA256);
  assert.equal(fixture.valid_records.length, EXPECTED_COUNTS.valid);
  assert.equal(fixture.invalid_records.length, EXPECTED_COUNTS.invalid);
  assert.equal(fixture.raw_invalid_json.length, EXPECTED_COUNTS.raw_invalid);
});

test('conformance fixture: every valid record satisfies the adapter record shape', () => {
  const fixture = loadFixture();
  for (const record of fixture.valid_records) {
    assert.doesNotThrow(
      () => validateMeetingRecord(record),
      `valid fixture record ${record?.meeting_id ?? '<no id>'} must validate`
    );
  }
});

test('conformance fixture: every invalid record is rejected by the adapter contract', () => {
  const fixture = loadFixture();
  for (const entry of fixture.invalid_records) {
    assert.equal(typeof entry, 'object');
    assert.equal(typeof entry.reason, 'string');
    assert.ok(Object.hasOwn(entry, 'record'));
    assert.throws(
      () => validateMeetingRecord(entry.record),
      (error) => typeof error?.code === 'string' && error.code.length > 0,
      `invalid fixture record must be rejected: ${entry.reason}`
    );
  }
});

test('conformance fixture: raw-invalid JSON cases stay canonical-writer-owned', () => {
  const fixture = loadFixture();
  for (const entry of fixture.raw_invalid_json) {
    assert.equal(typeof entry, 'object');
    assert.equal(typeof entry.reason, 'string');
    assert.equal(typeof entry.raw, 'string');
  }
  // The adapter transforms typed records. Raw JSON parsing authority (duplicate
  // keys, NaN, overflow, surrogates, depth) stays with the OI writer and is
  // verified cross-repo; no duplicate JS parser is created just for the fixture.
});

test('conformance fixture: valid records keep unique meeting identities', () => {
  const fixture = loadFixture();
  const seen = new Set();
  for (const record of fixture.valid_records) {
    const key = record.meeting_id;
    assert.equal(seen.has(key), false, `duplicate fixture meeting_id ${key}`);
    seen.add(key);
  }
});
