import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  computeMeetingFingerprint,
  runMeetingsIntake
} from '../scripts/sync-meetings-to-memory.mjs';

function createIntakeWorkspace(meetings = []) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-intake-'));
  const meetingsRoot = path.join(workspaceRoot, 'memory', 'evidence', 'meetings');
  fs.mkdirSync(meetingsRoot, { recursive: true });
  fs.writeFileSync(
    path.join(meetingsRoot, 'meetings.json'),
    `${JSON.stringify({ channel_mappings: {}, meetings }, null, 2)}\n`,
    'utf8'
  );
  return { workspaceRoot, meetingsRoot };
}

function baseMeeting(overrides = {}) {
  return {
    id: 'meet-1',
    title: 'Kickoff',
    date: '2026-02-03T10:00:00.000Z',
    dateString: '2026-02-03T10:00:00.000Z',
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
    projectSlug: null,
    projectSlugRaw: '',
    meetingId: undefined,
    ...overrides
  };
}

async function runIntake(workspaceRoot, meetingsRoot, options) {
  const detailMeetings = new Map(
    (Array.isArray(options.detailMeeting) ? options.detailMeeting : [options.detailMeeting])
      .map((meeting) => [meeting.id, meeting])
  );
  const graphDetail = async ({ variables }) => ({ transcript: detailMeetings.get(variables.transcriptId) ?? null });
  const graphList = async () => ({ transcripts: options.candidates });
  return runMeetingsIntake({
    meetingsState: options.meetingsState,
    candidates: options.candidates,
    graphList,
    graphDetail,
    args: makeArgs(options.args),
    context: {
      meetingsRoot,
      workspaceRoot,
      settings: {},
      accountRef: null,
      listedCount: options.listedCount ?? options.candidates.length
    }
  });
}

test('sync intake: a new meeting is persisted with pending review and registry paths', async (t) => {
  const { workspaceRoot, meetingsRoot } = createIntakeWorkspace([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const meeting = baseMeeting();
  const result = await runIntake(workspaceRoot, meetingsRoot, {
    meetingsState: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting
  });

  assert.equal(result.processed.length, 1);
  assert.equal(result.processed[0].server_change_status, 'new');
  const entry = result.meetingsState.meetings.find((item) => item.meeting_id === meeting.id);
  assert.equal(entry.llm_review_status, 'pending');
  assert.equal(entry.review_recommended, true);
  assert.equal(entry.server_change_status, 'new');
  assert.ok(fs.existsSync(path.join(workspaceRoot, entry.summary_path)));
  assert.ok(fs.existsSync(path.join(workspaceRoot, entry.transcript_path)));
  assert.ok(fs.existsSync(path.join(meetingsRoot, 'ops', '2026-02-03-kickoff.summary.md')));
  const onDisk = JSON.parse(fs.readFileSync(path.join(meetingsRoot, 'meetings.json'), 'utf8'));
  assert.equal(onDisk.meetings[0].summary_path, entry.summary_path);
  assert.equal(onDisk.meetings[0].transcript_path, entry.transcript_path);
});

test('sync intake: an unchanged fingerprint keeps the resolved review state and rewrites files', async (t) => {
  const meeting = baseMeeting();
  const fingerprint = computeMeetingFingerprint(meeting);
  const existing = {
    meeting_id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    dateString: meeting.dateString,
    server_fingerprint: fingerprint,
    llm_review_status: 'resolved',
    first_synced_at: '2026-02-03T10:00:00.000Z'
  };
  const { workspaceRoot, meetingsRoot } = createIntakeWorkspace([existing]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = await runIntake(workspaceRoot, meetingsRoot, {
    meetingsState: { channel_mappings: {}, meetings: [{ ...existing }] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting
  });

  assert.equal(result.processed.length, 1);
  assert.equal(result.processed[0].server_change_status, 'unchanged');
  const entry = result.meetingsState.meetings.find((item) => item.meeting_id === meeting.id);
  assert.equal(entry.llm_review_status, 'resolved');
  assert.equal(entry.server_changed_since_last_sync, false);
  assert.ok(fs.existsSync(path.join(workspaceRoot, entry.summary_path)));
});

test('sync intake: changed content flags changed and moves a resolved review back to pending', async (t) => {
  const baseline = baseMeeting();
  const existing = {
    meeting_id: baseline.id,
    title: baseline.title,
    date: baseline.date,
    dateString: baseline.dateString,
    server_fingerprint: 'stale-fingerprint-0000',
    llm_review_status: 'resolved',
    review_input: { stale: true },
    first_synced_at: '2026-02-03T10:00:00.000Z'
  };
  const { workspaceRoot, meetingsRoot } = createIntakeWorkspace([existing]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const changed = baseMeeting({ summary: { ...baseline.summary, overview: 'Changed overview' } });
  const result = await runIntake(workspaceRoot, meetingsRoot, {
    meetingsState: { channel_mappings: {}, meetings: [{ ...existing }] },
    candidates: [{ id: changed.id, title: changed.title }],
    detailMeeting: changed
  });

  assert.equal(result.processed[0].server_change_status, 'changed');
  const entry = result.meetingsState.meetings.find((item) => item.meeting_id === changed.id);
  assert.equal(entry.llm_review_status, 'pending');
  assert.equal(entry.server_changed_since_last_sync, true);
  assert.equal(entry.review_input.stale, undefined);
  assert.equal(entry.review_input.source, 'sync-intake');
  assert.equal(entry.review_input.review_recommended, true);
});

test('sync intake: the envelope keeps the sync CLI shape', async (t) => {
  const { workspaceRoot, meetingsRoot } = createIntakeWorkspace([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const meeting = baseMeeting();
  const result = await runIntake(workspaceRoot, meetingsRoot, {
    meetingsState: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting
  });

  const { envelope } = result;
  assert.equal(envelope.ok, true);
  assert.equal(envelope.mode, 'new');
  assert.equal(envelope.listed, 1);
  assert.equal(envelope.synced, 1);
  assert.equal(envelope.skipped_existing, 0);
  assert.equal(envelope.meetings.length, 1);
  assert.equal(envelope.meetings_json, 'memory/evidence/meetings/meetings.json');
});

test('sync intake: a project slug nests entry paths under projects/<slug>/meetings/<channel>', async (t) => {
  const { workspaceRoot, meetingsRoot } = createIntakeWorkspace([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const meeting = baseMeeting();
  const result = await runIntake(workspaceRoot, meetingsRoot, {
    meetingsState: { channel_mappings: {}, meetings: [] },
    candidates: [{ id: meeting.id, title: meeting.title }],
    detailMeeting: meeting,
    args: { projectSlug: 'pjr-relaunch', projectSlugRaw: 'pjr-relaunch' }
  });

  const entry = result.meetingsState.meetings.find((item) => item.meeting_id === meeting.id);
  assert.ok(entry.summary_path.startsWith('memory/evidence/projects/pjr-relaunch/meetings/ops/'));
  assert.ok(entry.transcript_path.startsWith('memory/evidence/projects/pjr-relaunch/meetings/ops/'));
  assert.equal(entry.project_slug, 'pjr-relaunch');
  assert.equal(entry.project_scoped, true);
  assert.ok(fs.existsSync(path.join(workspaceRoot, entry.summary_path)));
});
