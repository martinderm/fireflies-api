import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Issue #16: the migration utility is the only registry write path. It performs
// exactly one bounded transition, legacy array root -> canonical object root.
// Expected public seams:
//   migrateLegacyRegistryDocument(document) -> { state, document }
//   migrateMeetingsRegistryFile(registryPath, { fs, dryRun }) -> { state, document }
//   writeJsonAtomic(filePath, document, { fs }) -> void
//   isDirectRun -> boolean
// The `fs` option is a test seam for injected write/rename failures and must
// default to node:fs.
import {
  migrateLegacyRegistryDocument,
  migrateMeetingsRegistryFile,
  writeJsonAtomic,
  isDirectRun
} from '../scripts/migrate-meetings-registry.mjs';

const MIGRATE_SCRIPT = fileURLToPath(new URL('../scripts/migrate-meetings-registry.mjs', import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(MIGRATE_SCRIPT), '..');
const MEETINGS_JSON = 'meetings.json';

const DEFAULT_CHANNEL_STRATEGY = Object.freeze({
  mode: 'scarce_channels',
  max_channels: 3,
  channels_are_taxonomy: false,
  classification_source_of_truth: 'chat_review_classification'
});

function createWorkspace(t) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-migrate-'));
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workspaceRoot, '.agents'), { recursive: true });
  const meetingsRoot = path.join(workspaceRoot, 'memory', 'evidence', 'meetings');
  fs.mkdirSync(meetingsRoot, { recursive: true });
  return { workspaceRoot, meetingsRoot, registryPath: path.join(meetingsRoot, MEETINGS_JSON) };
}

function writeRaw(filePath, raw) {
  fs.writeFileSync(filePath, raw, 'utf8');
}

function readRaw(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listDir(dirPath) {
  return fs.readdirSync(dirPath).sort();
}

function legacyEntry(index, overrides = {}) {
  return {
    id: `legacy-${index}`,
    title: `Legacy meeting ${index}`,
    summary_path: `memory/evidence/meetings/legacy-${index}.summary.md`,
    transcript_path: `memory/evidence/meetings/legacy-${index}.transcript.md`,
    participants: ['owner@example.com', `participant-${index}@example.com`],
    customer_id: `customer-${index}`,
    synced_at: `2026-04-0${index + 1}T08:00:00.000Z`,
    classification_status: ['unmapped', 'reviewed', 'accepted', 'review_required'][index],
    provider_payload: { index, nested: { keep: `payload-${index}` } },
    ...overrides
  };
}

function legacyEntries() {
  return [
    legacyEntry(0, {
      meeting_id: 'meeting-0',
      source: { system: 'fireflies', external_id: 'meeting-0' }
    }),
    legacyEntry(1, {
      source: { system: 'fireflies', external_id: 'ext-1' }
    }),
    legacyEntry(2, {
      source: { system: 'zoom', external_id: 'ext-2' }
    }),
    legacyEntry(3)
  ];
}

function expectedMeetings(entries) {
  return entries.map((entry) => {
    const copy = structuredClone(entry);
    if (copy.meeting_id === undefined) {
      copy.meeting_id = copy.source?.external_id ?? copy.id;
    }
    return copy;
  });
}

function expectedDocument(entries) {
  return {
    channel_strategy: structuredClone(DEFAULT_CHANNEL_STRATEGY),
    channel_mappings: {},
    meetings: expectedMeetings(entries)
  };
}

function fsWithFailingRename(message = 'injected rename failure') {
  return new Proxy(fs, {
    get(target, property) {
      if (property === 'renameSync') {
        return () => {
          throw Object.assign(new Error(message), { code: 'EIO' });
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

function runMigrationCli(cwd, args) {
  return spawnSync(process.execPath, [MIGRATE_SCRIPT, ...args], {
    cwd,
    env: { ...process.env, WORKSPACE_ROOT: cwd, PWD: cwd },
    encoding: 'utf8',
    timeout: 30000
  });
}

function envelopeMeetingCount(envelope) {
  return Array.isArray(envelope.meetings) ? envelope.meetings.length : envelope.meetings;
}

test('document: a legacy array migrates losslessly in original order with unknown fields intact', () => {
  const entries = legacyEntries();
  const result = migrateLegacyRegistryDocument(entries);

  assert.equal(result.state, 'migrated');
  assert.equal(result.document.meetings.length, 4);
  assert.deepEqual(
    result.document.meetings.map((meeting) => meeting.meeting_id),
    ['meeting-0', 'ext-1', 'ext-2', 'legacy-3']
  );
  assert.deepEqual(result.document.channel_strategy, DEFAULT_CHANNEL_STRATEGY);
  assert.deepEqual(result.document.channel_mappings, {});
  assert.deepEqual(result.document, expectedDocument(entries));

  for (let index = 0; index < entries.length; index += 1) {
    const migrated = result.document.meetings[index];
    assert.equal(migrated.summary_path, entries[index].summary_path);
    assert.equal(migrated.transcript_path, entries[index].transcript_path);
    assert.deepEqual(migrated.participants, entries[index].participants);
    assert.equal(migrated.customer_id, entries[index].customer_id);
    assert.equal(migrated.synced_at, entries[index].synced_at);
    assert.equal(migrated.classification_status, entries[index].classification_status);
    assert.deepEqual(migrated.provider_payload, entries[index].provider_payload);
    if (entries[index].source) {
      assert.equal(migrated.source.external_id, entries[index].source.external_id);
    }
  }
});

test('document: source.external_id maps to meeting_id only when meeting_id is absent', () => {
  const withExternalId = migrateLegacyRegistryDocument([
    { id: 'legacy-id-1', source: { system: 'fireflies', external_id: 'external-1' } }
  ]);
  assert.equal(withExternalId.document.meetings[0].meeting_id, 'external-1');

  const withMeetingId = migrateLegacyRegistryDocument([
    { meeting_id: 'kept-id', id: 'legacy-id-2', source: { system: 'fireflies', external_id: 'kept-id' } }
  ]);
  assert.equal(withMeetingId.document.meetings[0].meeting_id, 'kept-id');

  const legacyIdOnly = migrateLegacyRegistryDocument([{ id: 'legacy-id-3' }]);
  assert.equal(legacyIdOnly.document.meetings[0].meeting_id, 'legacy-id-3');
});

test('document: the result is a deep copy and never mutates the legacy input', () => {
  const entries = legacyEntries();
  const participantsBefore = [...entries[0].participants];
  const result = migrateLegacyRegistryDocument(entries);

  assert.notEqual(result.document.meetings[0], entries[0]);
  result.document.meetings[0].participants.push('mutated@example.com');
  result.document.meetings[0].provider_payload.nested.keep = 'mutated';

  assert.deepEqual(entries[0].participants, participantsBefore);
  assert.equal(entries[0].provider_payload.nested.keep, 'payload-0');
  assert.equal(Object.hasOwn(entries[1], 'meeting_id'), false, 'input entry must not gain meeting_id');
});

test('document: the documented fireflies_<id> alias is accepted, not a conflict', () => {
  assert.doesNotThrow(() => migrateLegacyRegistryDocument([
    { meeting_id: 'fireflies-alias-1', source: { system: 'fireflies', external_id: 'fireflies-alias-1' } }
  ]));
  assert.doesNotThrow(() => migrateLegacyRegistryDocument([
    { meeting_id: 'fireflies_alias-1', source: { system: 'fireflies', external_id: 'alias-1' } }
  ]));
});

test('document: contradictory meeting_id and source.external_id fail with the indexed error', () => {
  assert.throws(
    () => migrateLegacyRegistryDocument([
      { meeting_id: 'meeting-1', source: { system: 'fireflies', external_id: 'other-1' } }
    ]),
    /legacy_entry_identity_conflict:0/
  );
});

test('document: duplicate identities fail, including the fireflies_<id> alias', () => {
  assert.throws(
    () => migrateLegacyRegistryDocument([
      { meeting_id: 'duplicate-1' },
      { meeting_id: 'duplicate-1' }
    ]),
    /legacy_duplicate_identity:duplicate-1/
  );

  assert.throws(
    () => migrateLegacyRegistryDocument([
      { id: 'first', source: { system: 'fireflies', external_id: 'alias-dup' } },
      { meeting_id: 'fireflies_alias-dup' }
    ]),
    /legacy_duplicate_identity:(alias-dup|fireflies_alias-dup)/
  );
});

test('document: a cross-entry legacy id colliding with another meeting_id is a duplicate', () => {
  assert.throws(
    () => migrateLegacyRegistryDocument([
      { meeting_id: 'm1', id: 'shared' },
      { meeting_id: 'shared' }
    ]),
    /legacy_duplicate_identity:shared/
  );
});

test('document: a duplicate source.external_id across entries is a duplicate even with distinct meeting_ids', () => {
  assert.throws(
    () => migrateLegacyRegistryDocument([
      { meeting_id: 'fireflies_fireflies-q', source: { system: 'fireflies', external_id: 'fireflies-q' } },
      { meeting_id: 'fireflies-q', source: { system: 'fireflies', external_id: 'fireflies-q' } }
    ]),
    /legacy_duplicate_identity:fireflies-q/
  );
});

test('file: a legacy array is written as the canonical object root with canonical bytes', (t) => {
  const workspace = createWorkspace(t);
  const entries = legacyEntries();
  writeRaw(workspace.registryPath, JSON.stringify(entries));

  const result = migrateMeetingsRegistryFile(workspace.registryPath);

  assert.equal(result.state, 'migrated');
  assert.equal(result.document.meetings.length, 4);
  const content = readRaw(workspace.registryPath);
  assert.equal(content.endsWith('\n'), true);
  assert.equal(content.includes('\r'), false);
  assert.equal(content, `${JSON.stringify(JSON.parse(content), null, 2)}\n`);
  assert.deepEqual(JSON.parse(content), expectedDocument(entries));
  assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON]);
});

test('file: an existing canonical object root is a byte-identical no-op with unchanged mtime', (t) => {
  const workspace = createWorkspace(t);
  const document = {
    channel_strategy: structuredClone(DEFAULT_CHANNEL_STRATEGY),
    channel_mappings: { ops: { channel_id: 'c1' } },
    future_root: { keep: true },
    meetings: [
      {
        meeting_id: 'm-1',
        source: { system: 'fireflies', external_id: 'm-1' },
        future_entry: { keep: true }
      }
    ]
  };
  const originalBytes = `${JSON.stringify(document, null, 2)}\n`;
  writeRaw(workspace.registryPath, originalBytes);
  const before = fs.statSync(workspace.registryPath);

  const result = migrateMeetingsRegistryFile(workspace.registryPath);

  assert.equal(result.state, 'already_current');
  assert.equal(readRaw(workspace.registryPath), originalBytes);
  assert.equal(fs.statSync(workspace.registryPath).mtimeMs, before.mtimeMs);
  assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON]);
});

test('file: repeated migration is idempotent and reports already_current', (t) => {
  const workspace = createWorkspace(t);
  writeRaw(workspace.registryPath, JSON.stringify(legacyEntries()));

  const first = migrateMeetingsRegistryFile(workspace.registryPath);
  const afterFirst = readRaw(workspace.registryPath);
  const firstStat = fs.statSync(workspace.registryPath);

  const second = migrateMeetingsRegistryFile(workspace.registryPath);
  const secondStat = fs.statSync(workspace.registryPath);

  assert.equal(first.state, 'migrated');
  assert.equal(second.state, 'already_current');
  assert.equal(readRaw(workspace.registryPath), afterFirst);
  assert.equal(secondStat.mtimeMs, firstStat.mtimeMs);
  assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON]);
});

test('file: a symlink/junction meetings.json target is rejected and left unchanged', (t) => {
  const workspace = createWorkspace(t);
  const targetDir = path.join(workspace.workspaceRoot, 'linked-meetings');
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, MEETINGS_JSON);
  const originalBytes = JSON.stringify(legacyEntries());
  writeRaw(targetFile, originalBytes);

  try {
    fs.symlinkSync(targetDir, workspace.registryPath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) {
      t.skip(`symlink/junction creation denied by the platform: ${error?.code ?? 'unknown'}`);
      return;
    }
    throw error;
  }

  assert.throws(
    () => migrateMeetingsRegistryFile(workspace.registryPath),
    /registry_symlink_unsupported/
  );
  assert.equal(fs.lstatSync(workspace.registryPath).isSymbolicLink(), true, 'the link must remain a link');
  assert.equal(readRaw(targetFile), originalBytes, 'the link target must stay byte-identical');
  assert.deepEqual(listDir(targetDir), [MEETINGS_JSON], 'no temporary file may remain in the target');
  assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON]);
});

test('file: an explicit empty array migrates to an empty canonical root', (t) => {
  const workspace = createWorkspace(t);
  writeRaw(workspace.registryPath, '[]');

  const result = migrateMeetingsRegistryFile(workspace.registryPath);

  assert.equal(result.state, 'migrated');
  assert.equal(result.document.meetings.length, 0);
  assert.deepEqual(result.document.channel_strategy, DEFAULT_CHANNEL_STRATEGY);
  assert.deepEqual(result.document.channel_mappings, {});
  assert.deepEqual(JSON.parse(readRaw(workspace.registryPath)), {
    channel_strategy: structuredClone(DEFAULT_CHANNEL_STRATEGY),
    channel_mappings: {},
    meetings: []
  });
});

const rejectionCases = [
  { name: 'invalid JSON', raw: '{ "meetings": ', pattern: /registry_invalid_json/ },
  { name: 'a non-object root', raw: JSON.stringify('not-a-registry'), pattern: /registry_invalid_root/ },
  { name: 'a non-array meetings field', raw: JSON.stringify({ meetings: {} }), pattern: /registry_meetings_not_array/ },
  { name: 'a non-object channel_mappings field', raw: JSON.stringify({ channel_mappings: [], meetings: [] }), pattern: /registry_channel_mappings_invalid/ },
  { name: 'a non-object entry', raw: JSON.stringify([{ meeting_id: 'ok-1' }, 'not-an-entry']), pattern: /legacy_entry_not_object:1/ },
  { name: 'a missing identity', raw: JSON.stringify([{ title: 'no identity' }]), pattern: /legacy_entry_missing_identity:0/ },
  { name: 'a control-character identity', raw: JSON.stringify([{ meeting_id: 'bad\u0001identity' }]), pattern: /legacy_entry_invalid_identity:0/ },
  { name: 'an unpaired surrogate identity', raw: JSON.stringify([{ meeting_id: '\uD800' }]), pattern: /legacy_entry_invalid_identity:0/ },
  { name: 'an oversized identity', raw: JSON.stringify([{ meeting_id: 'x'.repeat(513) }]), pattern: /legacy_entry_invalid_identity:0/ },
  { name: 'a non-object source', raw: JSON.stringify([{ meeting_id: 'ok-2', source: 'fireflies' }]), pattern: /legacy_entry_invalid_source:0/ },
  { name: 'an unsupported source system', raw: JSON.stringify([{ meeting_id: 'ok-3', source: { system: 'carrier-pigeon', external_id: 'ok-3' } }]), pattern: /legacy_entry_invalid_source_system:0/ },
  { name: 'an invalid source.external_id', raw: JSON.stringify([{ meeting_id: 'ok-4', source: { system: 'fireflies', external_id: 'bad\u0007id' } }]), pattern: /legacy_entry_invalid_source_external_id:0/ }
];

for (const rejection of rejectionCases) {
  test(`file: ${rejection.name} fails before mutation with the original bytes unchanged`, (t) => {
    const workspace = createWorkspace(t);
    writeRaw(workspace.registryPath, rejection.raw);

    assert.throws(
      () => migrateMeetingsRegistryFile(workspace.registryPath),
      rejection.pattern
    );
    assert.equal(readRaw(workspace.registryPath), rejection.raw);
    assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON], 'no temporary file may remain');
  });
}

test('write: writeJsonAtomic serializes canonical bytes and leaves no temporary file', (t) => {
  const workspace = createWorkspace(t);
  const target = path.join(workspace.meetingsRoot, 'atomic.json');
  writeRaw(target, 'stale');

  writeJsonAtomic(target, { channel_mappings: {}, meetings: [] });

  const content = readRaw(target);
  assert.equal(content, '{\n  "channel_mappings": {},\n  "meetings": []\n}\n');
  assert.deepEqual(listDir(workspace.meetingsRoot), ['atomic.json']);
});

test('write: an injected rename failure aborts a direct write and removes the temporary file', (t) => {
  const workspace = createWorkspace(t);
  const target = path.join(workspace.meetingsRoot, 'atomic.json');
  const originalBytes = '{"original":true}\n';
  writeRaw(target, originalBytes);

  assert.throws(
    () => writeJsonAtomic(target, { channel_mappings: {}, meetings: [] }, { fs: fsWithFailingRename() }),
    /injected rename failure/
  );
  assert.equal(readRaw(target), originalBytes);
  assert.deepEqual(listDir(workspace.meetingsRoot), ['atomic.json'], 'the temporary file must be removed');
});

test('file: an injected rename failure leaves the legacy registry byte-identical and removes the temporary file', (t) => {
  const workspace = createWorkspace(t);
  const originalBytes = JSON.stringify(legacyEntries());
  writeRaw(workspace.registryPath, originalBytes);

  assert.throws(
    () => migrateMeetingsRegistryFile(workspace.registryPath, { fs: fsWithFailingRename() }),
    /injected rename failure/
  );
  assert.equal(readRaw(workspace.registryPath), originalBytes);
  assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON], 'the temporary file must be removed');
});

test('import: isDirectRun is a boolean and importing the module does not run the CLI', () => {
  assert.equal(typeof isDirectRun, 'boolean');
  assert.equal(isDirectRun, false, 'the test runner is not a direct CLI invocation');
});

test('cli: a normal direct run migrates and prints the documented JSON envelope', (t) => {
  const workspace = createWorkspace(t);
  writeRaw(workspace.registryPath, JSON.stringify(legacyEntries()));

  const result = runMigrationCli(workspace.workspaceRoot, [
    '--meetings-root', 'memory/evidence/meetings',
    '--json'
  ]);

  assert.equal(result.status, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.state, 'migrated');
  assert.equal(envelopeMeetingCount(envelope), 4);
  assert.equal(envelope.path, 'memory/evidence/meetings/meetings.json');
  assert.equal(envelope.dry_run, false);
  assert.equal(JSON.parse(readRaw(workspace.registryPath)).meetings.length, 4);
});

test('cli: a rejection exits 2 with a stderr envelope and leaves the register untouched', (t) => {
  const workspace = createWorkspace(t);
  const originalBytes = '{ "meetings": ';
  writeRaw(workspace.registryPath, originalBytes);

  const result = runMigrationCli(workspace.workspaceRoot, [
    '--meetings-root', 'memory/evidence/meetings',
    '--json'
  ]);

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /registry_invalid_json/);
  assert.equal(readRaw(workspace.registryPath), originalBytes);
  assert.deepEqual(listDir(workspace.meetingsRoot), [MEETINGS_JSON]);
});

test('cli: direct execution through a junction path runs the same migration', (t) => {
  const workspace = createWorkspace(t);
  writeRaw(workspace.registryPath, JSON.stringify(legacyEntries()));

  const linkParent = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-migrate-link-'));
  t.after(() => fs.rmSync(linkParent, { recursive: true, force: true }));
  const linkPath = path.join(linkParent, 'repo-link');
  try {
    fs.symlinkSync(REPO_ROOT, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error?.code)) {
      t.skip(`junction creation denied by the platform: ${error?.code ?? 'unknown'}`);
      return;
    }
    throw error;
  }

  const linkedScript = path.join(linkPath, 'scripts', 'migrate-meetings-registry.mjs');
  const result = spawnSync(process.execPath, [
    linkedScript,
    '--meetings-root', 'memory/evidence/meetings',
    '--json'
  ], {
    cwd: workspace.workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspace.workspaceRoot, PWD: workspace.workspaceRoot },
    encoding: 'utf8',
    timeout: 30000
  });

  assert.equal(result.status, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.state, 'migrated');
  assert.equal(envelopeMeetingCount(envelope), 4);
  assert.equal(JSON.parse(readRaw(workspace.registryPath)).meetings.length, 4);
});
