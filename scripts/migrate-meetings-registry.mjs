import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSettingsJson, printError, printJson, resolveWorkspaceRoot } from './_fireflies-client.mjs';
import { resolveMeetingsRoot } from './sync-meetings-to-memory.mjs';
import { relativeWorkspacePath } from './_path-helpers.mjs';

// Issue #16: bounded one-time transition legacy array root -> canonical object
// root. This utility is the only registry write path in this repository; sync
// stays read-only and never invokes it. It touches no meeting files and never
// reads secrets or calls the Fireflies API.

const REGISTRY_FILE_NAME = 'meetings.json';
const MAX_IDENTITY_LENGTH = 512;
const FIREFLIES_ALIAS_PREFIX = 'fireflies_';
const SUPPORTED_SOURCE_SYSTEMS = new Set(['fireflies', 'ticnote', 'zoom', 'manual', 'vimeo-webvtt']);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

export const DEFAULT_CHANNEL_STRATEGY = Object.freeze({
  mode: 'scarce_channels',
  max_channels: 3,
  channels_are_taxonomy: false,
  classification_source_of_truth: 'chat_review_classification'
});

function migrationError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function isValidOpaqueIdentity(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_IDENTITY_LENGTH
    && !CONTROL_CHARACTER_PATTERN.test(value)
    && !hasUnpairedSurrogate(value);
}

function isPresentIdentity(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeIdentityKey(identity) {
  if (identity.startsWith(FIREFLIES_ALIAS_PREFIX)
    && identity.length > FIREFLIES_ALIAS_PREFIX.length) {
    return identity.slice(FIREFLIES_ALIAS_PREFIX.length);
  }
  return identity;
}

/**
 * Every present identity token an entry claims: the effective meeting_id, the
 * legacy id, and source.external_id, each raw and fireflies_-normalized. Tokens
 * within one entry may legitimately overlap; only a token owned by another entry
 * is a duplicate. Legacy ids and external ids are only registered, not validated
 * as effective identities, so previously accepted entries stay accepted.
 */
function collectIdentityTokens({ meetingId, legacyId, externalId }) {
  const tokens = [];
  for (const value of [meetingId, legacyId, externalId]) {
    if (typeof value !== 'string' || value === '') continue;
    for (const token of [value, normalizeIdentityKey(value)]) {
      if (!tokens.includes(token)) tokens.push(token);
    }
  }
  return tokens;
}

function validateEntrySource(entry, index) {
  if (!Object.hasOwn(entry, 'source')) return;
  const source = entry.source;
  if (!isPlainObject(source)) {
    throw migrationError(`legacy_entry_invalid_source:${index}`);
  }
  if (Object.hasOwn(source, 'system')) {
    if (typeof source.system !== 'string'
      || source.system === ''
      || !SUPPORTED_SOURCE_SYSTEMS.has(source.system)) {
      throw migrationError(`legacy_entry_invalid_source_system:${index}`);
    }
  }
  if (Object.hasOwn(source, 'external_id') && !isValidOpaqueIdentity(source.external_id)) {
    throw migrationError(`legacy_entry_invalid_source_external_id:${index}`);
  }
}

function migrateLegacyEntry(entry, index) {
  if (!isPlainObject(entry)) {
    throw migrationError(`legacy_entry_not_object:${index}`);
  }
  validateEntrySource(entry, index);

  const migrated = structuredClone(entry);
  const externalId = isPresentIdentity(entry.source?.external_id) ? entry.source.external_id : null;
  const legacyId = isPresentIdentity(entry.id) ? entry.id : null;

  let meetingId;
  if (isPresentIdentity(entry.meeting_id)) {
    if (!isValidOpaqueIdentity(entry.meeting_id)) {
      throw migrationError(`legacy_entry_invalid_identity:${index}`);
    }
    meetingId = entry.meeting_id;
    if (externalId !== null
      && externalId !== meetingId
      && meetingId !== `${FIREFLIES_ALIAS_PREFIX}${externalId}`) {
      throw migrationError(`legacy_entry_identity_conflict:${index}`);
    }
  } else {
    const candidate = externalId ?? legacyId;
    if (candidate === null) {
      throw migrationError(`legacy_entry_missing_identity:${index}`);
    }
    if (!isValidOpaqueIdentity(candidate)) {
      throw migrationError(`legacy_entry_invalid_identity:${index}`);
    }
    meetingId = candidate;
    migrated.meeting_id = candidate;
  }

  return {
    identity: normalizeIdentityKey(meetingId),
    tokens: collectIdentityTokens({ meetingId, legacyId, externalId }),
    entry: migrated
  };
}

function buildCanonicalRoot(meetings) {
  return {
    channel_strategy: {
      mode: DEFAULT_CHANNEL_STRATEGY.mode,
      max_channels: DEFAULT_CHANNEL_STRATEGY.max_channels,
      channels_are_taxonomy: DEFAULT_CHANNEL_STRATEGY.channels_are_taxonomy,
      classification_source_of_truth: DEFAULT_CHANNEL_STRATEGY.classification_source_of_truth
    },
    channel_mappings: {},
    meetings
  };
}

function validateCanonicalDocument(document) {
  if (!isPlainObject(document)) {
    throw migrationError('registry_invalid_root');
  }
  if (Object.hasOwn(document, 'meetings') && !Array.isArray(document.meetings)) {
    throw migrationError('registry_meetings_not_array');
  }
  if (Object.hasOwn(document, 'channel_mappings') && !isPlainObject(document.channel_mappings)) {
    throw migrationError('registry_channel_mappings_invalid');
  }
  if (Object.hasOwn(document, 'channel_strategy') && !isPlainObject(document.channel_strategy)) {
    throw migrationError('registry_channel_strategy_invalid');
  }
}

/**
 * Bounded document transition. Accepts a parsed registry root: a legacy array
 * migrates to the canonical object root, a canonical object is a no-op. Never
 * mutates the input.
 */
export function migrateLegacyRegistryDocument(document) {
  if (Array.isArray(document)) {
    const seen = new Map();
    const meetings = [];
    for (let index = 0; index < document.length; index += 1) {
      const { tokens, entry } = migrateLegacyEntry(document[index], index);
      for (const token of tokens) {
        if (seen.has(token)) {
          throw migrationError(`legacy_duplicate_identity:${token}`);
        }
      }
      for (const token of tokens) {
        seen.set(token, index);
      }
      meetings.push(entry);
    }
    return { state: 'migrated', document: buildCanonicalRoot(meetings) };
  }

  validateCanonicalDocument(document);
  return { state: 'already_current', document: structuredClone(document) };
}

function readRegistryRaw(registryPath, fsImpl) {
  let stats;
  try {
    stats = fsImpl.lstatSync(registryPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw migrationError('registry_not_found');
    }
    throw migrationError(`registry_read_failed:${error?.code ?? 'unknown'}`);
  }
  if (stats.isSymbolicLink()) {
    throw migrationError('registry_symlink_unsupported');
  }
  let raw;
  try {
    raw = fsImpl.readFileSync(registryPath, 'utf8');
  } catch (error) {
    throw migrationError(`registry_read_failed:${error?.code ?? 'unknown'}`);
  }
  return { raw, stats };
}

/**
 * Migrates `registryPath` in place. All validation happens before any mutation;
 * failures leave the original bytes and create no temporary file.
 */
export function migrateMeetingsRegistryFile(registryPath, { fs: fsImpl = fs, dryRun = false } = {}) {
  const { raw, stats: before } = readRegistryRaw(registryPath, fsImpl);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw migrationError('registry_invalid_json');
  }

  const result = migrateLegacyRegistryDocument(parsed);
  if (result.state !== 'migrated') {
    return { state: result.state, document: result.document };
  }
  if (dryRun) {
    return { state: 'dry_run', document: result.document };
  }

  let after;
  try {
    after = fsImpl.statSync(registryPath);
  } catch (error) {
    throw migrationError(`registry_read_failed:${error?.code ?? 'unknown'}`);
  }
  if (after.mtimeMs !== before.mtimeMs || after.size !== before.size) {
    throw migrationError('registry_concurrent_change');
  }

  writeJsonAtomic(registryPath, result.document, { fs: fsImpl });
  return { state: 'migrated', document: result.document };
}

function isTransientRenameError(error) {
  return error?.code === 'EPERM' || error?.code === 'EBUSY' || error?.code === 'EACCES';
}

function delaySync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * Canonical JSON write: UTF-8, 2-space indent, LF, trailing newline. Writes a
 * unique temporary file next to the target, fsyncs it, renames it over the
 * target, and removes the temporary file on any failure. A bounded retry covers
 * transient Windows share locks (scanner/indexer) on the replace; the injected
 * non-transient errors fail immediately.
 */
export function writeJsonAtomic(filePath, document, { fs: fsImpl = fs } = {}) {
  const directory = path.dirname(filePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`
  );
  const payload = `${JSON.stringify(document, null, 2)}\n`;
  const renameAttempts = 5;
  let descriptor;

  try {
    descriptor = fsImpl.openSync(tempPath, 'wx', 0o600);
    fsImpl.writeFileSync(descriptor, payload, 'utf8');
    fsImpl.fsyncSync(descriptor);
    fsImpl.closeSync(descriptor);
    descriptor = undefined;
    for (let attempt = 0; ; attempt += 1) {
      try {
        fsImpl.renameSync(tempPath, filePath);
        break;
      } catch (error) {
        if (attempt + 1 >= renameAttempts || !isTransientRenameError(error)) {
          throw error;
        }
        delaySync(15);
      }
    }
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fsImpl.closeSync(descriptor);
      } catch {
        // keep the original error
      }
    }
    try {
      fsImpl.unlinkSync(tempPath);
    } catch {
      // the temporary file may never have been created
    }
    throw error;
  }
}

function sameResolvedPath(left, right) {
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    try {
      return path.resolve(left) === path.resolve(right);
    } catch {
      return false;
    }
  }
}

export const isDirectRun = Boolean(process.argv[1])
  && sameResolvedPath(process.argv[1], fileURLToPath(import.meta.url));

function parseMigrationArgs(argv) {
  const args = { meetingsRoot: undefined, dryRun: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--meetings-root') {
      const next = argv[index + 1];
      if (next === undefined || /^--[A-Za-z]/.test(next)) {
        throw migrationError('missing_value_for_--meetings-root');
      }
      args.meetingsRoot = next;
      index += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--')) {
      throw migrationError(`unknown_option:${arg}`);
    } else {
      throw migrationError(`unexpected_positional_argument:${arg}`);
    }
  }
  return args;
}

function resolveRegistryPath(args) {
  const workspaceRoot = resolveWorkspaceRoot();
  let meetingsRoot;
  if (args.meetingsRoot !== undefined) {
    meetingsRoot = path.isAbsolute(args.meetingsRoot)
      ? args.meetingsRoot
      : path.join(workspaceRoot, args.meetingsRoot);
  } else {
    meetingsRoot = resolveMeetingsRoot(workspaceRoot, loadSettingsJson());
  }
  return {
    workspaceRoot,
    registryPath: path.join(meetingsRoot, REGISTRY_FILE_NAME)
  };
}

function runMigrationCli() {
  try {
    const args = parseMigrationArgs(process.argv.slice(2));
    const { workspaceRoot, registryPath } = resolveRegistryPath(args);
    const result = migrateMeetingsRegistryFile(registryPath, { dryRun: args.dryRun });
    const meetings = Array.isArray(result.document?.meetings) ? result.document.meetings.length : 0;
    const envelope = {
      ok: true,
      state: result.state,
      meetings,
      path: relativeWorkspacePath(workspaceRoot, registryPath),
      dry_run: result.state === 'dry_run'
    };
    if (args.json) {
      printJson(envelope);
    } else {
      process.stdout.write(`${result.state}: ${envelope.path} (${envelope.meetings} meetings)\n`);
    }
    process.exitCode = 0;
  } catch (error) {
    printError(error);
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 2;
  }
}

if (isDirectRun) {
  runMigrationCli();
}
