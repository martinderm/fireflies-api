import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProbeQuery,
  buildProbeCapabilities
} from '../scripts/_fireflies-meetings.mjs';

const PAID_FIELDS = ['audio_url', 'video_url', 'analytics'];
const SUMMARY_BLOCK = /^\s*summary \{/m;

test('probe query: the default query never requests paid fields', () => {
  const query = buildProbeQuery();
  for (const field of PAID_FIELDS) {
    assert.ok(!query.includes(field), `default query must not include ${field}`);
  }
});

test('probe query: the default query equals the explicit non-paid, non-summary variant', () => {
  assert.equal(buildProbeQuery(), buildProbeQuery(false, false));
});

test('probe query: the default query still requests the non-paid core fields', () => {
  const query = buildProbeQuery();
  for (const field of ['transcript_url', 'meeting_link', 'participants', 'speakers', 'channels', 'meeting_info', 'is_live']) {
    assert.ok(query.includes(field), `default query must include ${field}`);
  }
  assert.ok(!SUMMARY_BLOCK.test(query));
});

test('probe query: --include-paid-fields appends all three paid fields', () => {
  const query = buildProbeQuery(true, false);
  for (const field of PAID_FIELDS) {
    assert.ok(query.includes(field), `paid query must include ${field}`);
  }
  assert.ok(!SUMMARY_BLOCK.test(query));
});

test('probe query: --include-summary appends the summary block but keeps paid fields out', () => {
  const query = buildProbeQuery(false, true);
  assert.ok(query.includes('summary {'));
  for (const field of ['keywords', 'action_items', 'outline', 'short_summary', 'topics_discussed']) {
    assert.ok(query.includes(field), `summary query must include ${field}`);
  }
  for (const field of PAID_FIELDS) {
    assert.ok(!query.includes(field), `summary-only query must not include ${field}`);
  }
});

test('probe query: both opt-ins compose paid fields and the summary block', () => {
  const query = buildProbeQuery(true, true);
  for (const field of PAID_FIELDS) {
    assert.ok(query.includes(field));
  }
  assert.ok(query.includes('summary {'));
});

const FULL_MEETING = {
  id: 'm1',
  title: 'Titel',
  transcript_url: 'https://example.invalid/t',
  meeting_link: 'https://example.invalid/m',
  organizer_email: 'a@example.invalid',
  participants: ['A', 'B'],
  speakers: [{ id: '0', name: 'A' }],
  meeting_attendees: [{ email: 'a@example.invalid' }],
  meeting_attendance: [],
  channels: [{ id: 'c1', title: 'Support' }],
  user: { user_id: 'u1' },
  meeting_info: { fred_joined: true },
  shared_with: [{ email: 's@example.invalid' }],
  apps_preview: { outputs: [{ title: 'p' }] },
  is_live: true,
  audio_url: 'https://example.invalid/a.mp3',
  video_url: null,
  analytics: { __typename: 'Analytics' },
  summary: { keywords: ['k'] }
};

test('probe capabilities: unrequested paid and summary fields are labeled null, not false', () => {
  const capabilities = buildProbeCapabilities(FULL_MEETING, { paidRequested: false, summaryRequested: false });
  assert.equal(capabilities.audio_url_present, null);
  assert.equal(capabilities.video_url_present, null);
  assert.equal(capabilities.analytics_present, null);
  assert.equal(capabilities.summary_present, null);
});

test('probe capabilities: requested but missing paid fields report false', () => {
  const capabilities = buildProbeCapabilities(FULL_MEETING, { paidRequested: true, summaryRequested: false });
  assert.equal(capabilities.audio_url_present, true);
  assert.equal(capabilities.video_url_present, false);
  assert.equal(capabilities.analytics_present, true);
});

test('probe capabilities: requested and present paid fields report true', () => {
  const meeting = { ...FULL_MEETING, video_url: 'https://example.invalid/v.mp4' };
  const capabilities = buildProbeCapabilities(meeting, { paidRequested: true, summaryRequested: false });
  assert.equal(capabilities.audio_url_present, true);
  assert.equal(capabilities.video_url_present, true);
  assert.equal(capabilities.analytics_present, true);
});

test('probe capabilities: requested summary reports presence, unrequested stays null', () => {
  assert.equal(buildProbeCapabilities(FULL_MEETING, { paidRequested: false, summaryRequested: true }).summary_present, true);
  assert.equal(buildProbeCapabilities({}, { paidRequested: false, summaryRequested: true }).summary_present, false);
});

test('probe capabilities: an empty meeting keeps null counts for absent arrays', () => {
  const capabilities = buildProbeCapabilities({}, { paidRequested: false, summaryRequested: false });
  assert.equal(capabilities.participants_count, null);
  assert.equal(capabilities.speakers_count, null);
  assert.equal(capabilities.channels_count, null);
  assert.equal(capabilities.user_present, false);
  assert.equal(capabilities.is_live, false);
});

test('probe capabilities: non-paid presence flags and counts mirror the meeting', () => {
  const capabilities = buildProbeCapabilities(FULL_MEETING, { paidRequested: false, summaryRequested: false });
  assert.equal(capabilities.transcript_url, true);
  assert.equal(capabilities.meeting_link, true);
  assert.equal(capabilities.organizer_email, true);
  assert.equal(capabilities.participants_count, 2);
  assert.equal(capabilities.speakers_count, 1);
  assert.equal(capabilities.meeting_attendees_count, 1);
  assert.equal(capabilities.meeting_attendance_count, 0);
  assert.equal(capabilities.channels_count, 1);
  assert.equal(capabilities.user_present, true);
  assert.equal(capabilities.meeting_info_present, true);
  assert.equal(capabilities.shared_with_count, 1);
  assert.equal(capabilities.apps_preview_count, 1);
  assert.equal(capabilities.is_live, true);
});
