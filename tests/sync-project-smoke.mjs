import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildMeetingDestinationPaths,
  buildProjectRelocatePlan,
  slugify
} from '../scripts/_fireflies-meetings.mjs';

const RELOCATE_SCRIPT = fileURLToPath(new URL('../scripts/relocate-local-meeting.mjs', import.meta.url));
const SYNC_SCRIPT = fileURLToPath(new URL('../scripts/sync-meetings-to-memory.mjs', import.meta.url));

function createWorkspaceFixture(meetings) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fireflies-project-'));
  fs.mkdirSync(path.join(workspaceRoot, '.agents'), { recursive: true });
  const meetingsRoot = path.join(workspaceRoot, 'memory', 'evidence', 'meetings');
  fs.mkdirSync(meetingsRoot, { recursive: true });
  fs.writeFileSync(
    path.join(meetingsRoot, 'meetings.json'),
    `${JSON.stringify({ channel_mappings: {}, meetings }, null, 2)}\n`,
    'utf8'
  );
  return { workspaceRoot, meetingsRoot };
}

function writeMeetingFiles(workspaceRoot, meeting) {
  for (const kind of ['summary', 'transcript']) {
    const relative = meeting[`${kind}_path`];
    const absolute = path.join(workspaceRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const content = [
      '---',
      `meeting_id: "${meeting.meeting_id}"`,
      `slug: "${meeting.slug}"`,
      `dateString: "${meeting.dateString}"`,
      `channel_slug: "${meeting.channel_slug}"`,
      `project_slug: ${meeting.project_slug === null ? 'null' : JSON.stringify(meeting.project_slug)}`,
      `summary_path: "${meeting.summary_path}"`,
      `transcript_path: "${meeting.transcript_path}"`,
      '---',
      `# ${meeting.title}`,
      ''
    ].join('\n');
    fs.writeFileSync(absolute, content, 'utf8');
  }
}

function runRelocate(workspaceRoot, args) {
  return spawnSync(process.execPath, [RELOCATE_SCRIPT, ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot, PWD: workspaceRoot },
    encoding: 'utf8'
  });
}

function runSync(workspaceRoot, args) {
  return spawnSync(process.execPath, [SYNC_SCRIPT, ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot, PWD: workspaceRoot },
    encoding: 'utf8'
  });
}

test('destination paths: without a project slug the layout is byte-identical to the pool layout', () => {
  const meetingsRoot = path.join(path.resolve('virtual-ws'), 'memory', 'evidence', 'meetings');
  const result = buildMeetingDestinationPaths({
    meetingsRoot,
    channelSlug: 'ops',
    datePrefix: '2026-02-03',
    meetingSlug: 'kickoff'
  });
  assert.deepEqual(result, {
    folderPath: path.join(meetingsRoot, 'ops'),
    summaryFileName: '2026-02-03-kickoff.summary.md',
    transcriptFileName: '2026-02-03-kickoff.transcript.md'
  });
});

test('destination paths: a missing channel falls back to ohne-channel in the pool layout', () => {
  const meetingsRoot = path.join(path.resolve('virtual-ws'), 'memory', 'evidence', 'meetings');
  const result = buildMeetingDestinationPaths({
    meetingsRoot,
    channelSlug: null,
    datePrefix: '2026-02-03',
    meetingSlug: 'kickoff'
  });
  assert.equal(result.folderPath, path.join(meetingsRoot, 'ohne-channel'));
});

test('destination paths: a project slug nests the channel folder under the project meetings tree', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const result = buildMeetingDestinationPaths({
    meetingsRoot: path.join(workspaceRoot, 'memory', 'evidence', 'meetings'),
    projectSlug: 'pjr-relaunch',
    channelSlug: 'ops',
    datePrefix: '2026-02-03',
    meetingSlug: 'kickoff',
    workspaceRoot
  });
  assert.deepEqual(result, {
    folderPath: path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ops'),
    summaryFileName: '2026-02-03-kickoff.summary.md',
    transcriptFileName: '2026-02-03-kickoff.transcript.md'
  });
});

test('destination paths: a project slug with a missing channel keeps the ohne-channel folder', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const result = buildMeetingDestinationPaths({
    meetingsRoot: path.join(workspaceRoot, 'memory', 'evidence', 'meetings'),
    projectSlug: 'pjr-relaunch',
    channelSlug: null,
    datePrefix: '2026-02-03',
    meetingSlug: 'kickoff',
    workspaceRoot
  });
  assert.equal(
    result.folderPath,
    path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ohne-channel')
  );
});

test('relocate plan: derives every path, frontmatter and entry delta from the meeting fields', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm1',
    title: 'Kickoff',
    slug: 'kickoff',
    dateString: '2026-02-03T10:00:00.000Z',
    channel_slug: 'ops',
    project_slugs: ['alpha'],
    summary_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.transcript.md'
  };

  const plan = buildProjectRelocatePlan(meeting, { projectSlug: 'pjr-relaunch', workspaceRoot });
  const projectFolder = path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ops');

  assert.deepEqual(plan.fromPaths, {
    summary: path.join(workspaceRoot, 'memory/evidence/meetings/ops/2026-02-03-kickoff.summary.md'),
    transcript: path.join(workspaceRoot, 'memory/evidence/meetings/ops/2026-02-03-kickoff.transcript.md')
  });
  assert.deepEqual(plan.toPaths, {
    summary: path.join(projectFolder, '2026-02-03-kickoff.summary.md'),
    transcript: path.join(projectFolder, '2026-02-03-kickoff.transcript.md')
  });
  assert.deepEqual(plan.frontmatterUpdates, {
    project_slug: 'pjr-relaunch',
    summary_path: 'memory/evidence/projects/pjr-relaunch/meetings/ops/2026-02-03-kickoff.summary.md',
    transcript_path: 'memory/evidence/projects/pjr-relaunch/meetings/ops/2026-02-03-kickoff.transcript.md'
  });
  assert.deepEqual(plan.entryUpdates, {
    project_slug: 'pjr-relaunch',
    project_slugs: ['alpha', 'pjr-relaunch'],
    project_scoped: true,
    summary_path: 'memory/evidence/projects/pjr-relaunch/meetings/ops/2026-02-03-kickoff.summary.md',
    transcript_path: 'memory/evidence/projects/pjr-relaunch/meetings/ops/2026-02-03-kickoff.transcript.md',
    review_input: {
      project_slug: 'pjr-relaunch',
      project_scoped: true
    }
  });
});

test('relocate plan: a missing channel slug lands in the ohne-channel project folder', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm2',
    slug: 'lunch',
    dateString: '2026-02-04',
    channel_slug: null,
    summary_path: 'memory/evidence/meetings/ohne-channel/2026-02-04-lunch.summary.md',
    transcript_path: 'memory/evidence/meetings/ohne-channel/2026-02-04-lunch.transcript.md'
  };
  const plan = buildProjectRelocatePlan(meeting, { projectSlug: 'pjr-relaunch', workspaceRoot });
  assert.equal(
    plan.toPaths.summary,
    path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ohne-channel', '2026-02-04-lunch.summary.md')
  );
  assert.deepEqual(plan.entryUpdates.project_slugs, ['pjr-relaunch']);
});

test('relocate cli: moves a pool meeting into the project tree without orphans', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  const poolMeeting = {
    meeting_id: 'pool-1',
    title: 'Kickoff',
    slug: 'kickoff',
    dateString: '2026-02-03T10:00:00.000Z',
    channel: 'Ops',
    channel_slug: 'ops',
    channels: ['Ops'],
    project_slug: null,
    project_slugs: [],
    classification_status: 'unmapped',
    review_recommended: true,
    llm_review_status: 'pending',
    summary_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.transcript.md',
    review_input: { channel: 'Ops', channel_slug: 'ops', project_slug: null, review_recommended: true },
    server_change_status: 'unchanged',
    server_changed_since_last_sync: false,
    first_synced_at: '2026-02-03T10:00:00.000Z',
    last_synced_at: '2026-02-03T10:00:00.000Z'
  };
  const projectMeeting = {
    meeting_id: 'proj-1',
    title: 'Standup',
    slug: 'standup',
    dateString: '2026-02-02T09:00:00.000Z',
    channel: 'Ops',
    channel_slug: 'ops',
    channels: ['Ops'],
    project_slug: 'alpha',
    project_slugs: ['alpha'],
    project_scoped: true,
    classification_status: 'unmapped',
    review_recommended: true,
    llm_review_status: 'pending',
    summary_path: 'memory/evidence/projects/alpha/meetings/ops/2026-02-02-standup.summary.md',
    transcript_path: 'memory/evidence/projects/alpha/meetings/ops/2026-02-02-standup.transcript.md',
    review_input: { channel: 'Ops', channel_slug: 'ops', project_slug: 'alpha', review_recommended: true }
  };
  fs.writeFileSync(
    path.join(workspaceRoot, 'memory', 'evidence', 'meetings', 'meetings.json'),
    `${JSON.stringify({ channel_mappings: {}, meetings: [poolMeeting, projectMeeting] }, null, 2)}\n`,
    'utf8'
  );
  writeMeetingFiles(workspaceRoot, poolMeeting);
  writeMeetingFiles(workspaceRoot, projectMeeting);

  const result = runRelocate(workspaceRoot, ['--meeting-id', 'pool-1', '--to-project', 'pjr-relaunch']);
  assert.equal(result.status, 0, result.stderr);

  const projectFolder = path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ops');
  const summaryTarget = path.join(projectFolder, '2026-02-03-kickoff.summary.md');
  const transcriptTarget = path.join(projectFolder, '2026-02-03-kickoff.transcript.md');
  assert.ok(fs.existsSync(summaryTarget), 'summary moved to project tree');
  assert.ok(fs.existsSync(transcriptTarget), 'transcript moved to project tree');
  assert.ok(!fs.existsSync(path.join(workspaceRoot, poolMeeting.summary_path)), 'pool summary is gone');
  assert.ok(!fs.existsSync(path.join(workspaceRoot, poolMeeting.transcript_path)), 'pool transcript is gone');

  const movedSummary = fs.readFileSync(summaryTarget, 'utf8');
  assert.match(movedSummary, /summary_path: "memory\/evidence\/projects\/pjr-relaunch\/meetings\/ops\/2026-02-03-kickoff\.summary\.md"/);
  assert.match(movedSummary, /project_slug: "pjr-relaunch"/);

  const state = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'memory', 'evidence', 'meetings', 'meetings.json'), 'utf8'));
  const moved = state.meetings.find((item) => item.meeting_id === 'pool-1');
  const untouched = state.meetings.find((item) => item.meeting_id === 'proj-1');
  assert.equal(moved.summary_path, 'memory/evidence/projects/pjr-relaunch/meetings/ops/2026-02-03-kickoff.summary.md');
  assert.equal(moved.transcript_path, 'memory/evidence/projects/pjr-relaunch/meetings/ops/2026-02-03-kickoff.transcript.md');
  assert.equal(moved.project_slug, 'pjr-relaunch');
  assert.deepEqual(moved.project_slugs, ['pjr-relaunch']);
  assert.equal(moved.project_scoped, true);
  assert.equal(moved.channel_slug, 'ops');
  assert.equal(moved.classification_status, 'unmapped');
  assert.equal(moved.llm_review_status, 'pending');
  assert.equal(moved.review_input.project_slug, 'pjr-relaunch');
  assert.equal(moved.review_input.project_scoped, true);
  assert.deepEqual(untouched, projectMeeting);
});

test('relocate cli: an existing target file fails loud and leaves the source in place', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  const poolMeeting = {
    meeting_id: 'pool-1',
    title: 'Kickoff',
    slug: 'kickoff',
    dateString: '2026-02-03T10:00:00.000Z',
    channel: 'Ops',
    channel_slug: 'ops',
    channels: ['Ops'],
    project_slug: null,
    project_slugs: [],
    classification_status: 'unmapped',
    review_recommended: true,
    llm_review_status: 'pending',
    summary_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.transcript.md',
    review_input: { project_slug: null }
  };
  fs.writeFileSync(
    path.join(workspaceRoot, 'memory', 'evidence', 'meetings', 'meetings.json'),
    `${JSON.stringify({ channel_mappings: {}, meetings: [poolMeeting] }, null, 2)}\n`,
    'utf8'
  );
  writeMeetingFiles(workspaceRoot, poolMeeting);
  const projectFolder = path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ops');
  fs.mkdirSync(projectFolder, { recursive: true });
  const collidingTarget = path.join(projectFolder, '2026-02-03-kickoff.summary.md');
  fs.writeFileSync(collidingTarget, 'occupied', 'utf8');

  const result = runRelocate(workspaceRoot, ['--meeting-id', 'pool-1', '--to-project', 'pjr-relaunch']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /target_file_exists:/);
  assert.ok(fs.existsSync(path.join(workspaceRoot, poolMeeting.summary_path)), 'source summary stays');
  assert.ok(fs.existsSync(path.join(workspaceRoot, poolMeeting.transcript_path)), 'source transcript stays');
  assert.equal(fs.readFileSync(collidingTarget, 'utf8'), 'occupied');
  const state = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'memory', 'evidence', 'meetings', 'meetings.json'), 'utf8'));
  assert.equal(state.meetings[0].summary_path, 'memory/evidence/meetings/ops/2026-02-03-kickoff.summary.md');
});

test('relocate cli: --to-project alone satisfies usage while the classic path still does too', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const projectOnly = runRelocate(workspaceRoot, ['--meeting-id', 'missing', '--to-project', 'pjr-relaunch']);
  assert.equal(projectOnly.status, 1);
  assert.match(projectOnly.stderr, /meeting_not_found/);

  const classic = runRelocate(workspaceRoot, [
    '--meeting-id', 'missing',
    '--from-slug', 'ops',
    '--to-slug', 'ops-2',
    '--to-title', 'Ops 2',
    '--topic-slug', 'topic',
    '--resolved-at', '2026-02-03T10:00:00.000Z'
  ]);
  assert.equal(classic.status, 1);
  assert.match(classic.stderr, /meeting_not_found/);

  const neither = runRelocate(workspaceRoot, ['--meeting-id', 'missing']);
  assert.equal(neither.status, 2);
  assert.match(neither.stderr, /usage:/);

  const noMeetingId = runRelocate(workspaceRoot, ['--to-project', 'pjr-relaunch']);
  assert.equal(noMeetingId.status, 2);
  assert.match(noMeetingId.stderr, /usage:/);
});

test('relocate plan: a raw path-escape project slug is slugified under projects/ and cannot leave the tree', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm4',
    slug: 'kickoff',
    dateString: '2026-02-06',
    channel_slug: 'ops',
    summary_path: 'memory/evidence/meetings/ops/2026-02-06-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-06-kickoff.transcript.md'
  };
  const plan = buildProjectRelocatePlan(meeting, { projectSlug: '../posed-target', workspaceRoot });
  const projectFolder = path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'posed-target', 'meetings', 'ops');
  assert.equal(plan.entryUpdates.project_slug, 'posed-target');
  assert.equal(plan.toPaths.summary, path.join(projectFolder, '2026-02-06-kickoff.summary.md'));
  assert.equal(plan.toPaths.transcript, path.join(projectFolder, '2026-02-06-kickoff.transcript.md'));
  assert.ok(plan.entryUpdates.summary_path.startsWith('memory/evidence/projects/posed-target/'));
  assert.equal(plan.entryUpdates.project_slugs.includes('..'), false);
});

test('relocate plan: project slug normalization matches the sync slugify convention', () => {
  assert.equal(slugify('PJR Relaunch'), 'pjr-relaunch');
  assert.equal(slugify('---'), 'ohne-channel');
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm5',
    slug: 'kickoff',
    dateString: '2026-02-07',
    channel_slug: 'ops',
    summary_path: 'memory/evidence/meetings/ops/2026-02-07-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-07-kickoff.transcript.md'
  };
  const plan = buildProjectRelocatePlan(meeting, { projectSlug: 'PJR Relaunch', workspaceRoot });
  assert.equal(plan.entryUpdates.project_slug, 'pjr-relaunch');
  assert.deepEqual(plan.entryUpdates.project_slugs, ['pjr-relaunch']);
  assert.equal(
    plan.toPaths.summary,
    path.join(workspaceRoot, 'memory', 'evidence', 'projects', 'pjr-relaunch', 'meetings', 'ops', '2026-02-07-kickoff.summary.md')
  );
});

test('relocate plan: re-relocating drops the previous project tree while keeping sibling memberships', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm6',
    slug: 'standup',
    dateString: '2026-02-08',
    channel_slug: 'ops',
    project_slug: 'alpha',
    project_scoped: true,
    project_slugs: ['alpha', 'beta'],
    summary_path: 'memory/evidence/projects/alpha/meetings/ops/2026-02-08-standup.summary.md',
    transcript_path: 'memory/evidence/projects/alpha/meetings/ops/2026-02-08-standup.transcript.md'
  };
  const plan = buildProjectRelocatePlan(meeting, { projectSlug: 'pjr', workspaceRoot });
  assert.equal(plan.entryUpdates.project_slug, 'pjr');
  assert.deepEqual(plan.entryUpdates.project_slugs, ['beta', 'pjr']);
});

test('relocate plan: empty or empty-normalizing project slugs fail loud as empty_project_slug', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm7',
    slug: 'kickoff',
    dateString: '2026-02-09',
    channel_slug: 'ops',
    summary_path: 'memory/evidence/meetings/ops/2026-02-09-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-09-kickoff.transcript.md'
  };
  for (const rawSlug of ['', '---', '   ', '&&&']) {
    assert.throws(
      () => buildProjectRelocatePlan(meeting, { projectSlug: rawSlug, workspaceRoot }),
      /empty_project_slug:/,
      `expected empty_project_slug for ${JSON.stringify(rawSlug)}`
    );
  }
});

test('relocate plan: a valid project slug is still accepted unchanged', () => {
  const workspaceRoot = path.resolve('virtual-ws');
  const meeting = {
    meeting_id: 'm8',
    slug: 'kickoff',
    dateString: '2026-02-10',
    channel_slug: 'ops',
    summary_path: 'memory/evidence/meetings/ops/2026-02-10-kickoff.summary.md',
    transcript_path: 'memory/evidence/meetings/ops/2026-02-10-kickoff.transcript.md'
  };
  const plan = buildProjectRelocatePlan(meeting, { projectSlug: 'pjr-relaunch', workspaceRoot });
  assert.equal(plan.entryUpdates.project_slug, 'pjr-relaunch');
});

test('relocate cli: --to-project combined with the classic flags fails loud', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = runRelocate(workspaceRoot, [
    '--meeting-id', 'pool-1',
    '--to-project', 'pjr-relaunch',
    '--from-slug', 'ops',
    '--to-slug', 'ops-2',
    '--to-title', 'Ops 2',
    '--topic-slug', 'topic',
    '--resolved-at', '2026-02-03T10:00:00.000Z'
  ]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /mutually_exclusive_flags:project_and_channel_relocation/);
});

test('sync cli: an empty-normalizing project slug fails loud before any request', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = runSync(workspaceRoot, ['--project-slug', '---', '--limit', '1']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /empty_project_slug:---/);
});

test('sync cli: an empty project slug value fails loud before any request', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = runSync(workspaceRoot, ['--project-slug', '', '--limit', '1']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /empty_project_slug:/);
});

test('sync cli: a flag following --project-slug is rejected as a missing value', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = runSync(workspaceRoot, ['--project-slug', '--limit']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /missing value for --project-slug/);
});

test('relocate cli: an empty-normalizing target project exits 2 as a usage error', (t) => {
  const { workspaceRoot } = createWorkspaceFixture([
    {
      meeting_id: 'pool-1',
      title: 'Kickoff',
      slug: 'kickoff',
      dateString: '2026-02-03T10:00:00.000Z',
      channel_slug: 'ops',
      summary_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.summary.md',
      transcript_path: 'memory/evidence/meetings/ops/2026-02-03-kickoff.transcript.md'
    }
  ]);
  t.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = runRelocate(workspaceRoot, ['--meeting-id', 'pool-1', '--to-project', 'ohne-channel']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /empty_project_slug:ohne-channel/);
});
