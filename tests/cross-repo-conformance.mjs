import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { findOiMeetingDeskRoot } from './helpers/canonical-installations.mjs';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/meeting-record-v1.json', import.meta.url));
const EXPECTED_DIGEST = '6f54ab761d451289ba90f98e0a7b50859f30d209239a6f893201d373f62c955d';

function python() {
  return process.env.MEETING_DESK_PYTHON || 'python';
}

test('cross-repo conformance: the canonical OI verifier accepts the vendored pack', () => {
  const meetingDeskRoot = findOiMeetingDeskRoot();
  const verifier = path.join(meetingDeskRoot, 'scripts', 'verify_meeting_fixtures.py');
  assert.ok(verifier, 'canonical verifier path must resolve');

  const result = spawnSync(
    python(),
    [verifier, '--fixtures', FIXTURE_PATH, '--json'],
    {
      shell: false,
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      cwd: meetingDeskRoot
    }
  );

  assert.equal(result.error, undefined, `python_missing: ${result.error?.message ?? ''}`);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  let envelope;
  try {
    envelope = JSON.parse(String(result.stdout ?? '').trim());
  } catch {
    assert.fail('canonical verifier returned non-JSON output');
  }
  assert.equal(envelope.action, 'verify_meeting_fixtures');
  assert.equal(envelope.success, true);
  assert.equal(envelope.state, 'Verified');
  assert.equal(envelope.data.record_schema, 'meeting-record/1');
  assert.equal(envelope.data.writer_version, 'meeting-desk/1');
  assert.equal(envelope.data.digest, EXPECTED_DIGEST);
  assert.equal(envelope.data.valid, 11);
  assert.equal(envelope.data.invalid, 19);
  assert.equal(envelope.data.raw_invalid, 5);
});
