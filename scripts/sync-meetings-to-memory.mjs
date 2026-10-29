import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  firefliesGraphQL,
  printError,
  printJson,
  loadSettingsJson,
  resolveWorkspaceRoot
} from './_fireflies-client.mjs';
import {
  LIST_MEETINGS_FIELDS,
  buildGetMeetingQuery,
  buildListMeetingsRequest,
  slugify
} from './_fireflies-meetings.mjs';
import { buildMeetingRecord } from './_meeting-record.mjs';
import {
  WRITER_RECORD_SCHEMA,
  WRITER_VERSION,
  assertWriterConfig,
  createWriterAdapter,
  resolveWriterConfig
} from './_meeting-writer.mjs';
import { relativeWorkspacePath } from './_path-helpers.mjs';

const RECORD_SCHEMA = WRITER_RECORD_SCHEMA;

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function stripCloudSuffix(title, suffix = ' (syncd)') {
  const baseTitle = String(title ?? '').trim();
  if (!baseTitle) return baseTitle;
  return baseTitle.endsWith(suffix) ? baseTitle.slice(0, -suffix.length).trimEnd() : baseTitle;
}

export function resolveMeetingsRoot(wsRoot, settingsObj) {
  const custom = settingsObj?.['fireflies-api']?.meetingsRoot || settingsObj?.fireflies?.meetingsRoot;
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(wsRoot, custom);
  }
  const evidenceMeetings = path.join(wsRoot, 'memory', 'evidence', 'meetings');
  const evidenceRoot = path.join(wsRoot, 'memory', 'evidence');
  if (fs.existsSync(evidenceMeetings) || fs.existsSync(evidenceRoot)) {
    return evidenceMeetings;
  }
  const legacyMeetings = path.join(wsRoot, 'memory', 'references', 'meetings');
  if (fs.existsSync(legacyMeetings)) {
    return legacyMeetings;
  }
  return evidenceMeetings;
}

function takeValue(flag, argv, index) {
  const next = argv[index + 1];
  if (next === undefined || /^--[A-Za-z]/.test(next)) {
    throw usageError(`missing value for ${flag}`);
  }
  return next;
}

export function parseSyncArgs(argv) {
  const args = {
    limit: 10,
    skip: 0,
    mode: 'new',
    refreshChanged: false,
    dryRun: false,
    route: { topic: undefined, project: undefined, event: undefined },
    projectSlugRaw: undefined,
    meetingId: undefined
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') {
      args.limit = Number(takeValue(arg, argv, i));
      i += 1;
    } else if (arg === '--skip') {
      args.skip = Number(takeValue(arg, argv, i));
      i += 1;
    } else if (arg === '--mode') {
      args.mode = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--meeting-id') {
      args.meetingId = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--context-channel-slug') {
      args.contextChannelSlug = slugify(takeValue(arg, argv, i));
      i += 1;
    } else if (arg === '--context-channel-title') {
      args.contextChannelTitle = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--project') {
      args.route.project = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--project-slug') {
      args.route.project = takeValue(arg, argv, i);
      args.projectSlugRaw = args.route.project;
      i += 1;
    } else if (arg === '--topic') {
      args.route.topic = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--topic-slug') {
      args.route.topic = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--event') {
      args.route.event = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--event-slug') {
      args.route.event = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--refresh-changed') {
      args.refreshChanged = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--meeting-writer') {
      args.meetingWriter = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--python') {
      args.python = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--workspace-lock-root') {
      args.workspaceLockRoot = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--lease-id') {
      args.leaseId = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--conversation-id') {
      args.conversationId = takeValue(arg, argv, i);
      i += 1;
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(takeValue(arg, argv, i));
      i += 1;
    } else if (arg.startsWith('--')) {
      throw usageError(`unknown_option:${arg}`);
    } else {
      throw usageError(`unexpected_positional_argument:${arg}`);
    }
  }

  return args;
}

function normalizeRouteValue(raw, name) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw usageError(`invalid_${name}_slug`);
  }
  const value = raw.trim();
  if (!value || slugify(value) === 'ohne-channel') {
    throw usageError(`empty_${name}_slug:${raw}`);
  }
  if (/[\u0000\r\n]/.test(value)) {
    throw usageError(`invalid_${name}_slug`);
  }
  return value;
}

export function resolveRouting(args = {}) {
  const route = args.route ?? {};
  return {
    topic: normalizeRouteValue(route.topic ?? args.topic ?? args.topicSlugRaw, 'topic'),
    project: normalizeRouteValue(route.project ?? args.project ?? args.projectSlugRaw, 'project'),
    event: normalizeRouteValue(route.event ?? args.event ?? args.eventSlugRaw, 'event')
  };
}

export function readRegistryFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { exists: false, document: { meetings: [] } };
    }
    throw usageError(`registry_read_failed:${error?.code ?? 'unknown'}`);
  }

  let document;
  try {
    document = JSON.parse(raw);
  } catch {
    throw usageError('registry_invalid_json');
  }

  if (Array.isArray(document)) {
    throw usageError('registry_legacy_array_unsupported');
  }
  if (document === null || typeof document !== 'object') {
    throw usageError('registry_invalid_root');
  }
  if (Object.hasOwn(document, 'meetings') && !Array.isArray(document.meetings)) {
    throw usageError('registry_meetings_not_array');
  }
  if (Object.hasOwn(document, 'channel_mappings')
    && (document.channel_mappings === null || typeof document.channel_mappings !== 'object' || Array.isArray(document.channel_mappings))) {
    throw usageError('registry_channel_mappings_invalid');
  }
  if (!Object.hasOwn(document, 'meetings')) {
    document.meetings = [];
  }
  return { exists: true, document };
}

export function computeMeetingFingerprint(meeting) {
  const payload = {
    title: meeting.title ?? null,
    dateString: meeting.dateString ?? null,
    duration: meeting.duration ?? null,
    channels: (meeting.channels ?? []).map((channel) => ({ id: channel.id, title: channel.title, is_private: channel.is_private ?? null })),
    speakers: (meeting.speakers ?? []).map((speaker) => ({ id: speaker.id, name: speaker.name })),
    summary: meeting.summary ?? null,
    sentences: (meeting.sentences ?? []).map((sentence) => ({
      index: sentence.index,
      speaker_name: sentence.speaker_name,
      speaker_id: sentence.speaker_id,
      text: sentence.text,
      raw_text: sentence.raw_text,
      start_time: sentence.start_time,
      end_time: sentence.end_time
    })),
    apps_preview: meeting.apps_preview ?? null,
    shared_with: meeting.shared_with ?? []
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function entryExternalId(entry, { strictFireflies = false } = {}) {
  if (entry === null || typeof entry !== 'object') return null;
  const system = entry.source?.system;
  if (system !== 'fireflies') {
    if (strictFireflies || typeof system === 'string') return null;
  }
  if (typeof entry.source?.external_id === 'string' && entry.source.external_id.trim() !== '') {
    return entry.source.external_id;
  }
  if (typeof entry.meeting_id !== 'string') return null;
  if (entry.meeting_id.startsWith('fireflies_') && entry.meeting_id.length > 'fireflies_'.length) {
    return entry.meeting_id.slice('fireflies_'.length);
  }
  return entry.meeting_id;
}

function knownExternalIds(entries) {
  const ids = new Set();
  for (const entry of entries) {
    const id = entryExternalId(entry);
    if (id) ids.add(id);
  }
  return ids;
}

function matchesFirefliesIdentity(entry, externalId) {
  if (entry === null || typeof entry !== 'object') return false;
  const system = entry.source?.system;
  if (typeof system === 'string' && system !== 'fireflies') return false;

  const boundExternalId = entry.source?.external_id;
  if (typeof boundExternalId === 'string' && boundExternalId.trim() !== '') {
    if (boundExternalId !== externalId
      && (entry.meeting_id === externalId || entry.meeting_id === `fireflies_${externalId}`)) {
      throw new Error(`contradictory_registry_identity:${externalId}`);
    }
    return boundExternalId === externalId;
  }
  if (entry.meeting_id === externalId) return true;
  if (entry.meeting_id === `fireflies_${externalId}`) return true;
  return false;
}

function findRegistryEntry(entries, externalId, accountRef) {
  const matches = entries.filter((entry) => matchesFirefliesIdentity(entry, externalId));
  if (matches.length > 1) {
    throw new Error(`ambiguous_registry_identity:${externalId}`);
  }
  if (matches.length === 0) return null;
  const entry = matches[0];
  const boundAccount = entry.source?.account_ref;
  const bound = typeof boundAccount === 'string' && boundAccount.trim() !== '';
  const current = typeof accountRef === 'string' && accountRef.trim() !== '';
  if (bound && current && boundAccount !== accountRef) {
    throw new Error(`ambiguous_account_binding:${externalId}`);
  }
  if (bound && !current) {
    throw new Error(`unresolved_account_binding:${externalId}`);
  }
  return entry;
}

function failureFor(meetingId, error) {
  return {
    meeting_id: meetingId ?? null,
    ok: false,
    error: {
      kind: error?.kind ?? 'writer_error',
      reason: error?.reason ?? null,
      message: error?.message ?? 'unknown_error',
      exit_code: error?.exitCode ?? null,
      recovery_required: error?.recoveryRequired === true,
      outcome_unknown: error?.outcomeUnknown === true
    }
  };
}

function pathFromWriter(data, ...keys) {
  for (const key of keys) {
    const value = data?.paths?.[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

function assertReadableRegistry(registry) {
  if (registry === undefined || registry === null) return;
  if (typeof registry !== 'object' || Array.isArray(registry)) {
    throw usageError('registry_invalid_root');
  }
  if (Object.hasOwn(registry, 'meetings') && !Array.isArray(registry.meetings)) {
    throw usageError('registry_meetings_not_array');
  }
}

export async function runMeetingsIntake({ registry, candidates = [], graphDetail, writer, args = {}, context = {} }) {
  if (!writer || typeof writer.ingestRecord !== 'function') {
    throw new Error('writer_adapter_required');
  }
  assertReadableRegistry(registry);
  const entries = Array.isArray(registry?.meetings) ? registry.meetings : [];
  const route = resolveRouting(args);
  const accountRef = context.accountRef ?? null;
  const detailQuery = buildGetMeetingQuery('full');
  const processed = [];
  const failures = [];
  let stopped = false;

  for (const candidate of candidates) {
    if (stopped) break;

    if (typeof candidate?.id !== 'string' || candidate.id.trim() === '') {
      failures.push(failureFor(null, Object.assign(new Error('candidate_identity_missing'), { kind: 'registry_identity' })));
      continue;
    }

    let existingEntry;
    try {
      existingEntry = findRegistryEntry(entries, candidate.id, accountRef);
    } catch (error) {
      failures.push(failureFor(candidate.id, Object.assign(error, { kind: 'registry_identity' })));
      continue;
    }

    let detailData;
    try {
      detailData = await graphDetail({
        query: detailQuery,
        variables: { transcriptId: candidate.id }
      });
    } catch (error) {
      error.exitCode = error.exitCode ?? 1;
      throw error;
    }

    const meeting = detailData?.transcript;
    if (!meeting) {
      failures.push(failureFor(candidate.id, Object.assign(new Error('detail_missing'), { kind: 'detail_missing' })));
      continue;
    }

    if (meeting.id !== candidate.id) {
      failures.push(failureFor(candidate.id, Object.assign(new Error('detail_identity_mismatch'), { kind: 'registry_identity' })));
      continue;
    }

    const localMeeting = {
      ...meeting,
      title: stripCloudSuffix(meeting.title)
    };

    const fingerprint = computeMeetingFingerprint(localMeeting);
    const previousFingerprint = existingEntry?.source_metadata?.server_fingerprint
      ?? existingEntry?.server_fingerprint
      ?? null;
    const serverChangeStatus = !existingEntry
      ? 'new'
      : !previousFingerprint
        ? 'unknown'
        : previousFingerprint === fingerprint
          ? 'unchanged'
          : 'changed';
    const serverChanged = serverChangeStatus === 'changed';

    let record;
    try {
      record = buildMeetingRecord(localMeeting, {
        accountRef,
        providerState: {
          server_fingerprint: fingerprint,
          previous_server_fingerprint: previousFingerprint,
          server_change_status: serverChangeStatus,
          server_changed_since_last_sync: serverChanged,
          registry_match: existingEntry ? 'matched' : 'none',
          registry_account_binding: existingEntry?.source?.account_ref ?? null,
          current_account_ref: accountRef
        }
      });
    } catch (error) {
      failures.push(failureFor(localMeeting.id, Object.assign(error, { kind: 'record_invalid' })));
      continue;
    }

    try {
      const data = await writer.ingestRecord(record, {
        route,
        dryRun: args.dryRun === true
      });
      processed.push({
        meeting_id: record.meeting_id,
        source_external_id: record.source.external_id,
        title: record.title,
        ok: true,
        changed: data.changed,
        paths: data.paths ?? null,
        summary_path: pathFromWriter(data, 'summary', 'summary_path'),
        transcript_path: pathFromWriter(data, 'transcript', 'transcript_path'),
        transcript_raw_path: pathFromWriter(data, 'transcript_raw', 'transcript_raw_path'),
        source_account_ref: record.source.account_ref,
        server_fingerprint: fingerprint,
        server_change_status: serverChangeStatus,
        server_changed_since_last_sync: serverChanged,
        routing: route
      });
    } catch (error) {
      failures.push(failureFor(record.meeting_id, error));
      if (error?.recoveryRequired === true || error?.kind === 'outcome_unknown') {
        stopped = true;
      }
    }
  }

  const listedCount = context.listedCount ?? candidates.length;
  const skippedExisting = args.mode === 'new' && !args.meetingId && !args.refreshChanged
    ? Math.max(0, listedCount - candidates.length)
    : 0;

  const envelope = {
    ok: failures.length === 0 && !stopped,
    state: stopped ? 'recovery_required' : failures.length ? 'partial_error' : 'success',
    mode: args.mode ?? 'new',
    refresh_changed: Boolean(args.refreshChanged),
    dry_run: Boolean(args.dryRun),
    meeting_id: args.meetingId ?? null,
    project_slug: route.project,
    routing: route,
    listed: listedCount,
    synced: processed.length,
    failed: failures.length,
    stopped,
    skipped_existing: skippedExisting,
    meetings: processed,
    failures,
    meetings_json: context.workspaceRoot && context.meetingsRoot
      ? relativeWorkspacePath(context.workspaceRoot, path.join(context.meetingsRoot, 'meetings.json'))
      : null,
    record_schema: RECORD_SCHEMA,
    writer_contract: {
      record_schema: RECORD_SCHEMA,
      writer_version: WRITER_VERSION
    }
  };

  return { processed, failures, envelope };
}

function validateSyncArgs(args) {
  if (!Number.isFinite(args.limit) || args.limit < 1 || args.limit > 50) {
    throw usageError('limit_must_be_between_1_and_50');
  }
  if (!['new', 'all'].includes(args.mode)) {
    throw usageError('mode_must_be_new_or_all');
  }
  if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    throw usageError('timeout_must_be_positive');
  }
}

function resolveAccountRef(settings, env = process.env) {
  return env.FIREFLIES_ACCOUNT
    || settings?.['fireflies-api']?.account
    || settings?.fireflies?.account
    || null;
}

async function listCandidates({ args, graph, registryEntries, meetingsRoot }) {
  if (args.meetingId) {
    return { listed: [{ id: args.meetingId, title: null }], listedCount: 1 };
  }
  if (args.refreshChanged) {
    const listed = registryEntries
      .map((entry) => entryExternalId(entry, { strictFireflies: true }))
      .filter((id) => typeof id === 'string' && id !== '')
      .map((id) => ({ id, title: null }));
    return { listed, listedCount: listed.length };
  }

  const channelMapping = args.contextChannelSlug
    ? readOnlyChannelMapping(meetingsRoot, args.contextChannelSlug)
    : null;
  const listOptions = {
    limit: args.limit,
    skip: args.skip,
    ...(channelMapping?.channel_id ? { channel_id: channelMapping.channel_id } : {})
  };
  const { query, variables } = buildListMeetingsRequest(listOptions, LIST_MEETINGS_FIELDS);
  let data;
  try {
    data = await graph({ query, variables });
  } catch (error) {
    error.exitCode = error.exitCode ?? 1;
    throw error;
  }
  if (!Array.isArray(data?.transcripts)) {
    throw new Error('list_transcripts_not_array');
  }
  return { listed: data.transcripts, listedCount: data.transcripts.length };
}

function readOnlyChannelMapping(meetingsRoot, channelSlug) {
  const registryPath = path.join(meetingsRoot, 'meetings.json');
  const { document } = readRegistryFile(registryPath);
  const mapping = document.channel_mappings?.[channelSlug];
  return mapping && typeof mapping === 'object' ? mapping : null;
}

export async function runSync({
  argv = process.argv.slice(2),
  env = process.env,
  graph = firefliesGraphQL,
  writer = null,
  workspaceRoot = null,
  settings = null
} = {}) {
  try {
    const args = parseSyncArgs(argv);
    validateSyncArgs(args);
    const route = resolveRouting(args);
    const root = workspaceRoot ?? resolveWorkspaceRoot();
    const resolvedSettings = settings ?? loadSettingsJson();
    const meetingsRoot = resolveMeetingsRoot(root, resolvedSettings);
    const accountRef = resolveAccountRef(resolvedSettings, env);

    const writerConfig = resolveWriterConfig({
      cli: {
        python: args.python,
        meetingWriter: args.meetingWriter,
        workspaceRoot: root,
        workspaceLockRoot: args.workspaceLockRoot,
        leaseId: args.leaseId,
        conversationId: args.conversationId,
        timeoutMs: args.timeoutMs
      },
      env
    });
    assertWriterConfig(writerConfig);

    const writerAdapter = writer ?? createWriterAdapter(writerConfig);
    if (typeof writerAdapter.checkCapabilities === 'function') {
      await writerAdapter.checkCapabilities();
    }

    const { document: registry } = readRegistryFile(path.join(meetingsRoot, 'meetings.json'));
    const registryEntries = Array.isArray(registry.meetings) ? registry.meetings : [];
    const knownIds = knownExternalIds(registryEntries);
    const { listed, listedCount } = await listCandidates({ args, graph, registryEntries, meetingsRoot });
    const candidates = listed.filter((meeting) => (
      args.mode === 'all'
      || Boolean(args.meetingId)
      || args.refreshChanged
      || !knownIds.has(meeting?.id)
    ));

    const { envelope } = await runMeetingsIntake({
      registry,
      candidates,
      graphDetail: graph,
      writer: writerAdapter,
      args,
      context: {
        workspaceRoot: root,
        meetingsRoot,
        accountRef,
        listedCount
      }
    });

    return {
      exitCode: envelope.ok ? 0 : envelope.state === 'recovery_required' ? 3 : 2,
      envelope,
      routing: route
    };
  } catch (error) {
    return {
      exitCode: error?.exitCode ?? 2,
      error
    };
  }
}

async function runSyncCli() {
  const result = await runSync();
  if (result.envelope) {
    printJson(result.envelope);
  } else {
    printError(result.error);
  }
  process.exitCode = result.exitCode;
}

function safeRealPath(candidate) {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return null;
  }
}

export function isDirectRun(argv = process.argv, moduleUrl = import.meta.url) {
  const entry = argv?.[1];
  if (typeof entry !== 'string' || entry === '') return false;
  const entryRealPath = safeRealPath(path.resolve(entry));
  if (!entryRealPath) return false;
  const moduleRealPath = safeRealPath(fileURLToPath(moduleUrl));
  return moduleRealPath !== null && entryRealPath === moduleRealPath;
}

if (isDirectRun()) {
  runSyncCli();
}
