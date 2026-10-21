import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { validateMeetingRecord } from './_meeting-record.mjs';

export const WRITER_RECORD_SCHEMA = 'meeting-record/1';
export const WRITER_VERSION = 'meeting-desk/1';
export const WRITER_ENVELOPE_FIELDS = Object.freeze(['action', 'success', 'state', 'message', 'data', 'error']);
export const DEFAULT_WRITER_TIMEOUT_MS = 120000;

const MAX_CHILD_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_STDIN_BYTES = 1024 * 1024;
const INGEST_ACTION = 'ingest_meeting';

export class WriterTransportError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'WriterTransportError';
    this.kind = options.kind ?? 'writer_error';
    this.reason = options.reason ?? null;
    this.exitCode = options.exitCode ?? null;
    this.envelope = options.envelope ?? null;
    this.stdout = options.stdout ?? '';
    this.stderr = options.stderr ?? '';
    this.recoveryRequired = options.recoveryRequired === true;
    this.outcomeUnknown = options.outcomeUnknown === true;
  }
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveWriterConfig({ cli = {}, env = process.env } = {}) {
  const timeout = Number(cli.timeoutMs);
  return {
    python: nonEmptyString(cli.python) ?? nonEmptyString(env.MEETING_DESK_PYTHON),
    writer: nonEmptyString(cli.meetingWriter) ?? nonEmptyString(env.MEETING_DESK_WRITER),
    workspaceRoot: nonEmptyString(cli.workspaceRoot),
    workspaceLockRoot: nonEmptyString(cli.workspaceLockRoot),
    leaseId: nonEmptyString(cli.leaseId),
    conversationId: nonEmptyString(cli.conversationId),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_WRITER_TIMEOUT_MS
  };
}

export function assertWriterConfig(config) {
  const missing = [];
  if (!config?.python) missing.push('python');
  if (!config?.writer) missing.push('meeting_writer');
  if (!config?.workspaceRoot) missing.push('workspace');
  if (!config?.workspaceLockRoot) missing.push('workspace_lock_root');
  if (!config?.leaseId) missing.push('lease_id');
  if (missing.length) {
    throw new WriterTransportError(`missing_writer_config:${missing.join(',')}`, { kind: 'configuration' });
  }

  for (const [name, value] of [
    ['meeting_writer', config.writer],
    ['workspace', config.workspaceRoot],
    ['workspace_lock_root', config.workspaceLockRoot]
  ]) {
    if (!path.isAbsolute(value)) {
      throw new WriterTransportError(`writer_config_not_absolute:${name}`, { kind: 'configuration' });
    }
  }
  if (!fs.existsSync(config.writer) || !fs.statSync(config.writer).isFile()) {
    throw new WriterTransportError('writer_file_missing', { kind: 'configuration' });
  }
  if (!fs.existsSync(config.workspaceLockRoot) || !fs.statSync(config.workspaceLockRoot).isDirectory()) {
    throw new WriterTransportError('workspace_lock_root_missing', { kind: 'configuration' });
  }
  return config;
}

function routeValue(name, value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new WriterTransportError(`invalid_${name}_route`, { kind: 'configuration' });
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new WriterTransportError(`invalid_${name}_route`, { kind: 'configuration' });
  }
  if (/[\u0000\r\n]/.test(trimmed)) {
    throw new WriterTransportError(`invalid_${name}_route`, { kind: 'configuration' });
  }
  return trimmed;
}

function buildIngestArgs(config, route, dryRun) {
  const args = [
    config.writer,
    '--record', '-',
    '--workspace', config.workspaceRoot,
    '--lease-id', config.leaseId,
    '--workspace-lock-root', config.workspaceLockRoot
  ];
  if (config.conversationId) {
    args.push('--conversation-id', config.conversationId);
  }
  const topic = routeValue('topic', route.topic);
  const project = routeValue('project', route.project);
  const event = routeValue('event', route.event);
  if (topic) args.push('--topic', topic);
  if (project) args.push('--project', project);
  if (event) args.push('--event', event);
  if (dryRun) args.push('--dry-run');
  args.push('--json');
  return args;
}

export function runWriterProcess({ config, args, stdin = null, timeoutMs = DEFAULT_WRITER_TIMEOUT_MS, env = process.env }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(config.python, args, {
        shell: false,
        cwd: config.workspaceRoot,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });
    } catch (error) {
      reject(new WriterTransportError(`writer_spawn_failed:${error?.message ?? 'unknown'}`, { kind: 'writer_error' }));
      return;
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    let outputBytes = 0;
    let timedOut = false;
    let settled = false;
    let overflow = false;
    let timer = null;

    const finish = (payload, failure) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (failure) reject(failure);
      else resolve(payload);
    };

    const collect = (chunks) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_CHILD_OUTPUT_BYTES) {
        overflow = true;
        child.kill();
        return;
      }
      chunks.push(chunk);
    };

    child.stdout.on('data', collect(stdoutChunks));
    child.stderr.on('data', collect(stderrChunks));
    child.stdin.on('error', () => {
      // EPIPE is expected when the child rejects before consuming the record.
    });
    child.on('error', (error) => {
      finish(null, new WriterTransportError(`writer_spawn_failed:${error?.message ?? 'unknown'}`, { kind: 'writer_error' }));
    });

    timer = timeoutMs > 0
      ? setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs)
      : null;

    child.on('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (overflow) {
        finish(null, new WriterTransportError('writer_output_too_large', {
          kind: 'output_overflow', stdout, stderr
        }));
        return;
      }
      finish({ code, signal, timedOut, stdout, stderr });
    });

    if (stdin === null) {
      child.stdin.end();
    } else {
      child.stdin.end(Buffer.from(stdin, 'utf8'));
    }
  });
}

export function parseWriterEnvelope(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) {
    throw new WriterTransportError('writer_envelope_missing', { kind: 'malformed_envelope', stdout });
  }

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new WriterTransportError('writer_envelope_malformed_json', { kind: 'malformed_envelope', stdout });
  }

  if (!isPlainObject(envelope)) {
    throw new WriterTransportError('writer_envelope_not_object', { kind: 'malformed_envelope', stdout });
  }
  const keys = Object.keys(envelope).sort();
  const expected = [...WRITER_ENVELOPE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new WriterTransportError('writer_envelope_field_set', { kind: 'malformed_envelope', stdout });
  }
  if (typeof envelope.action !== 'string' || typeof envelope.success !== 'boolean' || typeof envelope.state !== 'string' || typeof envelope.message !== 'string') {
    throw new WriterTransportError('writer_envelope_types', { kind: 'malformed_envelope', stdout });
  }
  if (envelope.data !== null && !isPlainObject(envelope.data)) {
    throw new WriterTransportError('writer_envelope_data', { kind: 'malformed_envelope', stdout });
  }
  if (envelope.error !== null && !isPlainObject(envelope.error)) {
    throw new WriterTransportError('writer_envelope_error', { kind: 'malformed_envelope', stdout });
  }
  return envelope;
}

function envelopeMessage(envelope, stderr) {
  if (envelope?.error && typeof envelope.error.message === 'string' && envelope.error.message.trim()) {
    return envelope.error.message.trim();
  }
  if (typeof envelope?.message === 'string' && envelope.message.trim()) {
    return envelope.message.trim();
  }
  const diagnostics = String(stderr ?? '').trim();
  return diagnostics || 'writer_rejected_without_message';
}

function successData(envelope, stdout) {
  const data = envelope.data;
  if (!isPlainObject(data)) {
    throw new WriterTransportError('writer_success_without_data', { kind: 'malformed_envelope', stdout, envelope });
  }
  if (typeof data.meeting_id !== 'string' || data.meeting_id.trim() === '') {
    throw new WriterTransportError('writer_success_without_meeting_id', { kind: 'malformed_envelope', stdout, envelope });
  }
  if (typeof data.changed !== 'boolean') {
    throw new WriterTransportError('writer_success_without_changed_flag', { kind: 'malformed_envelope', stdout, envelope });
  }
  if (!isPlainObject(data.paths)) {
    throw new WriterTransportError('writer_success_without_paths', { kind: 'malformed_envelope', stdout, envelope });
  }
  if (!isPlainObject(data.entry)) {
    throw new WriterTransportError('writer_success_without_entry', { kind: 'malformed_envelope', stdout, envelope });
  }
  return data;
}

export async function checkWriterCapabilities(config, { run = runWriterProcess } = {}) {
  assertWriterConfig(config);
  let result;
  try {
    result = await run({ config, args: [config.writer, '--capabilities', '--json'], stdin: null, timeoutMs: config.timeoutMs });
  } catch (error) {
    if (error instanceof WriterTransportError && error.kind !== 'output_overflow') throw error;
    throw new WriterTransportError(`writer_capabilities_failed:${error?.message ?? 'unknown'}`, {
      kind: 'capabilities',
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? ''
    });
  }

  if (result.timedOut || result.signal) {
    throw new WriterTransportError('writer_capabilities_interrupted', {
      kind: 'capabilities', stdout: result.stdout, stderr: result.stderr
    });
  }
  if (result.code !== 0) {
    throw new WriterTransportError(`writer_capabilities_exit_${result.code}`, {
      kind: 'capabilities', exitCode: result.code, stdout: result.stdout, stderr: result.stderr
    });
  }

  let envelope;
  try {
    envelope = parseWriterEnvelope(result.stdout);
  } catch (error) {
    throw new WriterTransportError(`writer_capabilities_envelope:${error.message}`, {
      kind: 'capabilities', stdout: result.stdout, stderr: result.stderr
    });
  }
  if (!envelope.success) {
    throw new WriterTransportError('writer_capabilities_rejected', {
      kind: 'capabilities', envelope, stdout: result.stdout, stderr: result.stderr
    });
  }
  const data = envelope.data;
  if (!isPlainObject(data)
    || data.record_schema !== WRITER_RECORD_SCHEMA
    || data.writer_version !== WRITER_VERSION) {
    throw new WriterTransportError(
      `writer_capabilities_contract_mismatch:${data?.record_schema ?? 'missing'}/${data?.writer_version ?? 'missing'}`,
      { kind: 'capabilities', envelope, stdout: result.stdout, stderr: result.stderr }
    );
  }
  return data;
}

function ambiguousIngest(message, reason, details = {}) {
  return new WriterTransportError(message, {
    kind: 'outcome_unknown',
    reason,
    exitCode: details.exitCode ?? null,
    envelope: details.envelope ?? null,
    stdout: details.stdout ?? '',
    stderr: details.stderr ?? '',
    recoveryRequired: true,
    outcomeUnknown: true
  });
}

export async function ingestRecord(record, { config, route = {}, dryRun = false, timeoutMs = null, run = runWriterProcess } = {}) {
  try {
    validateMeetingRecord(record);
  } catch (error) {
    throw new WriterTransportError(`record_invalid:${error.message}`, { kind: 'record_invalid' });
  }

  assertWriterConfig(config);
  const args = buildIngestArgs(config, route, dryRun);
  const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : config.timeoutMs;
  const stdin = JSON.stringify(record);
  if (Buffer.byteLength(stdin, 'utf8') > MAX_STDIN_BYTES) {
    throw new WriterTransportError('record_too_large_for_writer_stdin', { kind: 'record_invalid' });
  }

  let result;
  try {
    result = await run({
      config,
      args,
      stdin,
      timeoutMs: effectiveTimeout
    });
  } catch (error) {
    if (error instanceof WriterTransportError && error.kind === 'output_overflow') {
      throw ambiguousIngest('writer output exceeded the transport bound after a possible apply', 'output_overflow', {
        stdout: error.stdout,
        stderr: error.stderr
      });
    }
    if (error instanceof WriterTransportError) throw error;
    throw new WriterTransportError(`writer_process_failed:${error?.message ?? 'unknown'}`, { kind: 'writer_error' });
  }

  if (result.timedOut || result.signal) {
    throw ambiguousIngest(
      result.timedOut ? 'writer timeout after a possible apply' : 'writer signal after a possible apply',
      result.timedOut ? 'timeout' : 'signal',
      { stdout: result.stdout, stderr: result.stderr }
    );
  }

  let envelope = null;
  let envelopeFailure = null;
  try {
    envelope = parseWriterEnvelope(result.stdout);
  } catch (error) {
    envelopeFailure = error;
  }

  if (result.code === 2) {
    throw new WriterTransportError(`writer_rejected:${envelopeMessage(envelope, result.stderr)}`, {
      kind: 'rejected',
      reason: 'rejected',
      exitCode: 2,
      envelope,
      stdout: result.stdout,
      stderr: result.stderr
    });
  }
  if (result.code === 3) {
    throw new WriterTransportError(`writer_recovery_required:${envelopeMessage(envelope, result.stderr)}`, {
      kind: 'recovery_required',
      reason: 'recovery_required',
      exitCode: 3,
      envelope,
      stdout: result.stdout,
      stderr: result.stderr,
      recoveryRequired: true
    });
  }
  if (result.code !== 0) {
    throw ambiguousIngest(
      `writer exited ${result.code} after a possible apply: ${envelopeMessage(envelope, result.stderr)}`,
      envelope?.success === true ? 'contradictory_exit' : 'nonzero_exit',
      {
        exitCode: result.code,
        envelope,
        stdout: result.stdout,
        stderr: result.stderr
      }
    );
  }
  if (envelopeFailure) {
    throw ambiguousIngest(
      `writer success could not be verified after a possible apply: ${envelopeFailure.message}`,
      'malformed_envelope',
      { stdout: result.stdout, stderr: result.stderr }
    );
  }
  if (!envelope.success) {
    throw ambiguousIngest(
      'writer exited zero without a success envelope after a possible apply',
      'contradictory_envelope',
      { envelope, stdout: result.stdout, stderr: result.stderr }
    );
  }
  if (envelope.action !== INGEST_ACTION) {
    throw ambiguousIngest(
      `writer success reported unexpected action ${JSON.stringify(envelope.action)}`,
      'unexpected_action',
      { envelope, stdout: result.stdout, stderr: result.stderr }
    );
  }

  try {
    return successData(envelope, result.stdout);
  } catch (error) {
    throw ambiguousIngest(
      `writer success data could not be verified after a possible apply: ${error.message}`,
      'malformed_success_data',
      { envelope, stdout: result.stdout, stderr: result.stderr }
    );
  }
}

export function createWriterAdapter(config) {
  return {
    checkCapabilities: () => checkWriterCapabilities(config),
    ingestRecord: (record, options = {}) => ingestRecord(record, { config, ...options })
  };
}
