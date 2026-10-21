import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runMeetingsIntake, computeMeetingFingerprint } from '../scripts/sync-meetings-to-memory.mjs';
import { WriterTransportError } from '../scripts/_meeting-writer.mjs';

function createWorkspace(t, meetings = []) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-intake-'));
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  const meetingsRoot = path.join(workspaceRoot, 'memory', 'evidence', 'meetings');
  fs.mkdirSync(meetingsRoot, { recursive: true });
  const registryDocument = { channel_mappings: {}, meetings };
  const registryPath = path.join(meetingsRoot, 'meetings.json');
  fs.writeFileSync(registryPath, `${JSON.stringify(registryDocument, null, 2)}\n`, 'utf8');
  return { workspaceRoot, meetingsRoot, registryPath, registryDocument };
}

function baseMeeting(overrides = {}) {
  return {
    id: 'meet-1',
    title: 'Kickoff',
    date: 1776757200000,
    dateString: '2026-04-21T07:40:00.000Z',
    duration: 30,
    transcript_url: 'https://app.fireflies.ai/view/meet-1',
    meeting_link: null,
    organizer_email: 'owner@example.com',
    host_email: null,
    calendar_id: null,
    cal_id: null,
    calendar_type: null,
    participants: ['a@example.com', 'b@example.com'],
    speakers: [{ id: 's1', name: 'Alice' }],
    meeting_attendees: [],
    meeting_attendance: [],
    channels: [{ id: 'c1', title: 'Ops', is_private: false }],
    user: null,
    meeting_info: { fred_joined: true, silent_meeting: false, summary_status: 'processed' },
    summary: {
      keywords: ['launch'],
      overview: 'Baseline overview',
      short_summary: 'Short',
      action_items: 'Do X',
      bullet_gist: 'Point one\nPoint two',
      notes: 'Notes',
      extended_sections: [{ title: 'Sec', content: 'Body' }]
    },
    shared_with: [],
    apps_preview: { outputs: [] },
    is_live: false,
    sentences: [
      {
        index: 0,
        speaker_name: 'Alice',
        speaker_id: 's1',
        text: 'Hello',
        raw_text: 'Hello',
        start_time: 0,
        end_time: 3
      }
    ],
    ...overrides
  };
}

function makeArgs(overrides = {}) {
  return {
    limit: 10,
    skip: 0,
    mode: 'new',
    refreshChanged: false,
    dryRun: false,
    route: { topic: null, project: null, event: null },
    meetingId: undefined,
    ...overrides
  };
}

function makeWriter(handler) {
  const calls = [];
  return {
    calls,
    async ingestRecord(record, options) {
      calls.push({ record, options });
      return handler(record, options, calls.length - 1);
    }
  };
}

function success(record, overrides = {}) {
  return {
    entry: { meeting_id: record.meeting_id },
    meeting_id: record.meeting_id,
    paths: {
      summary: 'memory/evidence/meetings/ops/2026-04-21-kickoff.summary.md',
      transcript: 'memory/evidence/meetings/ops/2026-04-21-kickoff.transcript.md'
    },
    changed: true,
    ...overrides
  };
}

async function runIntake(workspace, options) {
  const detailMeetings = new Map(
    (Array.isArray(options.detailMeeting) ? options.detailMeeting : [options.detailMeeting])
      .map((meeting) => [meeting.id, meeting])
  );
  const graphDetail = async ({ variables }) => ({ transcript: detailMeetings.get(variables.transcriptId) ?? null });
  return runMeetingsIntake({
    registry: options.registry,
    candidates: options.candidates,
    graphDetail,
    writer: options.writer,
    args: makeArgs(options.args),
    context: {
      meetingsRoot: workspace.meetingsRoot,
      workspaceRoot: workspace.workspaceRoot,
      accountRef: options.accountRef ?? null,
      listedCount: options.listedCount ?? options.candidates.length
    }
  });
}

function assertWorkspaceUnchanged(workspace) {
  const onDisk = fs.readFileSync(workspace.registryPath, 'utf8');
  assert.equal(onDisk, `${JSON.stringify(workspace.registryDocument, null, 2)}\n`);
  assert.deepEqual(fs.readdirSync(workspace.meetingsRoot), ['meetings.json']);
}

test('sync intake: a new meeting becomes one record delegation with no adapter file or registry write', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting,
    writer
  });

  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0].record.schema, 'meeting-record/1');
  assert.equal(writer.calls[0].record.source.system, 'fireflies');
  assert.equal(writer.calls[0].record.source.external_id, meeting.id);
  assert.equal(writer.calls[0].record.meeting_id, meeting.id);
  assert.equal(writer.calls[0].record.source_metadata.server_change_status, 'new');
  assert.deepEqual(writer.calls[0].options.route, { topic: null, project: null, event: null });

  assert.equal(result.processed.length, 1);
  assert.equal(result.processed[0].ok, true);
  assert.equal(result.processed[0].server_change_status, 'new');
  assert.match(result.processed[0].server_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.failures.length, 0);
  assert.equal(result.envelope.ok, true);
  assertWorkspaceUnchanged(workspace);
});

test('sync intake: an unchanged fingerprint is read from the register without rewriting it', async (t) => {
  const meeting = baseMeeting();
  const fingerprint = computeMeetingFingerprint(meeting);
  const existing = {
    meeting_id: meeting.id,
    title: meeting.title,
    source: { system: 'fireflies', external_id: meeting.id, account_ref: null },
    source_metadata: { server_fingerprint: fingerprint },
    first_synced_at: '2026-04-21T07:40:00.000Z'
  };
  const workspace = createWorkspace(t, [existing]);
  const writer = makeWriter((record) => success(record, { changed: false }));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [existing] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting,
    writer
  });

  assert.equal(writer.calls[0].record.source_metadata.server_change_status, 'unchanged');
  assert.equal(writer.calls[0].record.source_metadata.server_changed_since_last_sync, false);
  assert.equal(result.processed[0].server_change_status, 'unchanged');
  assertWorkspaceUnchanged(workspace);
});

test('sync intake: changed provider content flags changed and requests review without approving itself', async (t) => {
  const baseline = baseMeeting();
  const existing = {
    meeting_id: baseline.id,
    title: baseline.title,
    source: { system: 'fireflies', external_id: baseline.id, account_ref: null },
    source_metadata: { server_fingerprint: 'stale-fingerprint-0000' },
    first_synced_at: '2026-04-21T07:40:00.000Z'
  };
  const workspace = createWorkspace(t, [existing]);
  const changed = baseMeeting({ summary: { ...baseline.summary, overview: 'Changed overview' } });
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [existing] },
    candidates: [{ id: changed.id, title: changed.title }],
    detailMeeting: changed,
    writer
  });

  assert.equal(writer.calls[0].record.source_metadata.server_change_status, 'changed');
  assert.equal(writer.calls[0].record.source_metadata.server_changed_since_last_sync, true);
  assert.equal(writer.calls[0].record.review.recommended, true);
  assert.equal(writer.calls[0].record.review.reason, 'fireflies-asr-and-name-check');
  assert.equal(Object.hasOwn(writer.calls[0].record, 'content_status'), false);
  assert.equal(result.processed[0].server_change_status, 'changed');
  assertWorkspaceUnchanged(workspace);
});

test('sync intake: the envelope keeps the sync CLI shape and reports zero adapter failures', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting,
    writer
  });

  const { envelope } = result;
  assert.equal(envelope.ok, true);
  assert.equal(envelope.state, 'success');
  assert.equal(envelope.mode, 'new');
  assert.equal(envelope.listed, 1);
  assert.equal(envelope.synced, 1);
  assert.equal(envelope.failed, 0);
  assert.deepEqual(envelope.failures, []);
  assert.equal(envelope.skipped_existing, 0);
  assert.equal(envelope.meetings.length, 1);
  assert.equal(envelope.meetings_json, 'memory/evidence/meetings/meetings.json');
  assert.equal(envelope.record_schema, 'meeting-record/1');
});

test('sync intake: an explicit project route reaches the writer while no route stays a valid unmapped intake', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const routed = makeWriter((record) => success(record));

  await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting,
    writer: routed,
    args: { route: { topic: null, project: 'pjr-relaunch', event: null } }
  });
  assert.deepEqual(routed.calls[0].options.route, { topic: null, project: 'pjr-relaunch', event: null });

  const unmapped = makeWriter((record) => success(record));
  await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting,
    writer: unmapped
  });
  assert.deepEqual(unmapped.calls[0].options.route, { topic: null, project: null, event: null });
  assert.deepEqual(unmapped.calls[0].record.classification_hint, {
    topic_slug: null,
    project_slug: null,
    event_slug: null,
    basis: []
  });
});

test('sync intake: a partial writer error stays per-meeting instead of claiming a full sync', async (t) => {
  const workspace = createWorkspace(t);
  const first = baseMeeting({ id: 'meet-1', title: 'First' });
  const second = baseMeeting({ id: 'meet-2', title: 'Second' });
  const writer = makeWriter((record) => {
    if (record.meeting_id === 'meet-1') {
      throw new WriterTransportError('record rejected', { kind: 'rejected', exitCode: 2 });
    }
    return success(record);
  });

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: first.id }, { id: second.id }],
    detailMeeting: [first, second],
    writer
  });

  assert.equal(result.envelope.ok, false);
  assert.equal(result.envelope.state, 'partial_error');
  assert.equal(result.envelope.synced, 1);
  assert.equal(result.envelope.failed, 1);
  assert.equal(result.envelope.meetings[0].meeting_id, 'meet-2');
  assert.equal(result.envelope.failures[0].meeting_id, 'meet-1');
  assert.equal(result.envelope.failures[0].error.kind, 'rejected');
  assert.equal(result.envelope.failures[0].error.exit_code, 2);
  assertWorkspaceUnchanged(workspace);
});

test('sync intake: recovery_required stops the batch and never retries blindly', async (t) => {
  const workspace = createWorkspace(t);
  const first = baseMeeting({ id: 'meet-1', title: 'First' });
  const second = baseMeeting({ id: 'meet-2', title: 'Second' });
  const writer = makeWriter(() => {
    throw new WriterTransportError('open journal', {
      kind: 'recovery_required',
      exitCode: 3,
      recoveryRequired: true
    });
  });

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: first.id }, { id: second.id }],
    detailMeeting: [first, second],
    writer
  });

  assert.equal(writer.calls.length, 1, 'no second record is attempted after recovery_required');
  assert.equal(result.envelope.ok, false);
  assert.equal(result.envelope.state, 'recovery_required');
  assert.equal(result.envelope.stopped, true);
  assert.equal(result.envelope.failed, 1);
  assert.equal(result.envelope.failures[0].error.recovery_required, true);
  assertWorkspaceUnchanged(workspace);
});

test('sync intake: an ambiguous writer outcome escalates to recovery_required and stops', async (t) => {
  const workspace = createWorkspace(t);
  const first = baseMeeting({ id: 'meet-1', title: 'First' });
  const second = baseMeeting({ id: 'meet-2', title: 'Second' });
  const writer = makeWriter(() => {
    throw new WriterTransportError('writer output was malformed after a possible apply', {
      kind: 'outcome_unknown',
      reason: 'malformed_envelope',
      recoveryRequired: true,
      outcomeUnknown: true
    });
  });

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: first.id }, { id: second.id }],
    detailMeeting: [first, second],
    writer
  });

  assert.equal(writer.calls.length, 1);
  assert.equal(result.envelope.ok, false);
  assert.equal(result.envelope.state, 'recovery_required');
  assert.equal(result.envelope.stopped, true);
  assert.equal(result.envelope.failures[0].error.kind, 'outcome_unknown');
  assert.equal(result.envelope.failures[0].error.reason, 'malformed_envelope');
  assert.equal(result.envelope.failures[0].error.recovery_required, true);
});

test('sync intake: ambiguous registry identities fail per meeting instead of guessing', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const matching = {
    meeting_id: meeting.id,
    source: { system: 'fireflies', external_id: meeting.id }
  };
  const alsoMatching = {
    meeting_id: `fireflies_${meeting.id}`,
    source: { system: 'fireflies', external_id: meeting.id }
  };
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [matching, alsoMatching] },
    candidates: [{ id: meeting.id }],
    detailMeeting: meeting,
    writer
  });

  assert.equal(writer.calls.length, 0);
  assert.equal(result.envelope.ok, false);
  assert.equal(result.envelope.failed, 1);
  assert.match(result.envelope.failures[0].error.message, /ambiguous_registry_identity/);
});

test('sync intake: contradictory bound and alias identities stop instead of creating a duplicate', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const contradictory = {
    meeting_id: `fireflies_${meeting.id}`,
    source: { system: 'fireflies', external_id: 'some-other-provider-id' }
  };
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [contradictory] },
    candidates: [{ id: meeting.id }],
    detailMeeting: meeting,
    writer
  });

  assert.equal(writer.calls.length, 0);
  assert.equal(result.envelope.ok, false);
  assert.match(result.envelope.failures[0].error.message, /contradictory_registry_identity/);
});

test('sync intake: an unbound legacy entry stays matchable by source identity and carries the current account', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const existing = {
    meeting_id: meeting.id,
    source: { system: 'fireflies', external_id: meeting.id }
  };
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [existing] },
    candidates: [{ id: meeting.id }],
    detailMeeting: meeting,
    writer,
    accountRef: 'owner@example.com'
  });

  assert.equal(result.envelope.ok, true);
  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0].record.source.account_ref, 'owner@example.com');
  assert.equal(writer.calls[0].record.source_metadata.registry_account_binding, null);
  assert.equal(writer.calls[0].record.source_metadata.current_account_ref, 'owner@example.com');
});

test('sync intake: a changed account binding fails instead of writing into a foreign account entry', async (t) => {
  const workspace = createWorkspace(t);
  const meeting = baseMeeting();
  const existing = {
    meeting_id: meeting.id,
    source: { system: 'fireflies', external_id: meeting.id, account_ref: 'other@example.com' }
  };
  const writer = makeWriter((record) => success(record));

  const result = await runIntake(workspace, {
    registry: { channel_mappings: {}, meetings: [existing] },
    candidates: [{ id: meeting.id }],
    detailMeeting: meeting,
    writer,
    accountRef: 'owner@example.com'
  });

  assert.equal(writer.calls.length, 0);
  assert.equal(result.envelope.ok, false);
  assert.match(result.envelope.failures[0].error.message, /ambiguous_account_binding/);
});
