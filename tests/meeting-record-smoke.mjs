import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECORD_ROOT_KEYS,
  RECORD_SCHEMA,
  buildMeetingRecord,
  validateMeetingRecord
} from '../scripts/_meeting-record.mjs';

function baseMeeting(overrides = {}) {
  return {
    id: '01J8Z5M4T3K2Q1P0N9B8A7C6D5',
    title: 'Kickoff (syncd)',
    date: 1776757200000,
    dateString: '2026-04-21T07:40:00.000Z',
    duration: 42,
    transcript_url: 'https://app.fireflies.ai/view/01J8Z5M4T3K2Q1P0N9B8A7C6D5',
    meeting_link: 'https://meet.example.com/kickoff',
    organizer_email: 'owner@example.com',
    host_email: null,
    calendar_id: 'cal-1',
    cal_id: null,
    calendar_type: 'google',
    participants: ['a@example.com', 'b@example.com'],
    speakers: [
      { id: 's1', name: 'Alice' },
      { id: 's2', name: 'Bob' }
    ],
    meeting_attendees: [],
    meeting_attendance: [],
    channels: [{ id: 'c1', title: 'Ops', is_private: false }],
    user: { email: 'owner@example.com' },
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
        text: 'Line one\r\nLine two',
        raw_text: 'Line one\r\nLine two',
        start_time: 0,
        end_time: 3
      },
      {
        index: 1,
        speaker_name: 'Bob',
        speaker_id: 's2',
        text: 'Grüße 🙌',
        raw_text: 'Grüße 🙌',
        start_time: 3,
        end_time: 7
      }
    ],
    ...overrides
  };
}

test('record: a Fireflies meeting maps to the exact meeting-record/1 root contract', () => {
  const record = buildMeetingRecord(baseMeeting(), { accountRef: 'owner@example.com' });

  assert.deepEqual(Object.keys(record).sort(), [...RECORD_ROOT_KEYS].sort());
  assert.equal(record.schema, RECORD_SCHEMA);
  assert.deepEqual(record.source, {
    system: 'fireflies',
    account_ref: 'owner@example.com',
    external_id: '01J8Z5M4T3K2Q1P0N9B8A7C6D5'
  });
  assert.equal(record.meeting_id, '01J8Z5M4T3K2Q1P0N9B8A7C6D5');
  assert.equal(record.title, 'Kickoff');
  assert.deepEqual(record.start, {
    utc: '2026-04-21T07:40:00.000Z',
    calendar_date: '2026-04-21',
    estimated: false,
    basis: ['provider-epoch-ms']
  });
  assert.equal(record.duration_minutes, 42);
  assert.deepEqual(record.participants, ['a@example.com', 'b@example.com']);
  assert.deepEqual(record.classification_hint, {
    topic_slug: null,
    project_slug: null,
    event_slug: null,
    basis: []
  });
  assert.deepEqual(record.review, {
    recommended: true,
    reason: 'fireflies-asr-and-name-check'
  });
  assert.ok(record.artifacts.summary_md.includes('## Summary'));
  assert.ok(record.artifacts.summary_md.includes('Baseline overview'));
  assert.ok(record.artifacts.transcript_md.includes('#### 00:00 Alice'));
  assert.ok(record.artifacts.transcript_md.includes('Grüße 🙌'));
  assert.equal(
    record.artifacts.transcript_raw_md,
    'Line one\r\nLine two\nGrüße 🙌',
    'raw sentence bytes are preserved, only the structural join is LF'
  );
  assert.equal(record.source_metadata.provider, 'fireflies');
  assert.equal(record.source_metadata.provider_meeting_id, '01J8Z5M4T3K2Q1P0N9B8A7C6D5');
  assert.equal(record.source_metadata.provider_date, 1776757200000);
  assert.equal(record.source_metadata.provider_date_string, '2026-04-21T07:40:00.000Z');
  assert.equal(record.source_metadata.provider_duration_minutes, 42);
  assert.equal(record.source_metadata.channel_slug, 'ops');
  assert.equal(record.source_metadata.channel_title, 'Ops');
  assert.equal(record.source_metadata.transcript_url, baseMeeting().transcript_url);
  assert.deepEqual(record.source_metadata.summary_keywords, ['launch']);
  assert.equal(record.source_metadata.meeting_info_summary_status, 'processed');
  assert.equal(record.source_metadata.is_live, false);
  validateMeetingRecord(record);
});

test('record: Data Completeness names only the artifacts actually present', () => {
  const summaryOnly = buildMeetingRecord(baseMeeting({ sentences: [] }));
  assert.match(summaryOnly.artifacts.summary_md, /Data Completeness: Summary lokal gespiegelt/);
  assert.doesNotMatch(summaryOnly.artifacts.summary_md, /Volltranskript/);

  const withTranscript = buildMeetingRecord(baseMeeting());
  assert.match(
    withTranscript.artifacts.summary_md,
    /Data Completeness: Summary \+ Volltranskript \+ Rohtranskript lokal gespiegelt/
  );
});

test('record: summary metadata alone is not a summary artifact', () => {
  const record = buildMeetingRecord(baseMeeting({
    summary: { keywords: ['launch'], meeting_type: 'standup' }
  }));
  assert.equal(record.artifacts.summary_md, null);
  assert.ok(record.artifacts.transcript_md);
});

test('record: raw and rendered transcripts stay distinct and raw is byte-exact', () => {
  const raw = '  leading\r\nmiddle\ttab\r\ntrailing  ';
  const record = buildMeetingRecord(baseMeeting({
    summary: null,
    sentences: [{ index: 0, speaker_name: 'Ada', text: 'rendered text', raw_text: raw, start_time: 0 }]
  }));

  assert.equal(record.artifacts.transcript_raw_md, raw);
  assert.notEqual(record.artifacts.transcript_md, raw);
  assert.ok(record.artifacts.transcript_md.includes('rendered text'));
  assert.equal(record.artifacts.summary_md, null);
});

test('record: missing time never invents an instant or a noon fallback', () => {
  const record = buildMeetingRecord(baseMeeting({ date: null, dateString: '2026-04-21' }));
  assert.deepEqual(record.start, {
    utc: null,
    calendar_date: '2026-04-21',
    estimated: true,
    basis: ['date-only']
  });
});

test('record: a zoned dateString yields a real UTC instant and keeps its local calendar date', () => {
  const record = buildMeetingRecord(baseMeeting({
    date: null,
    dateString: '2026-04-21T07:40:00.000+02:00'
  }));
  assert.deepEqual(record.start, {
    utc: '2026-04-21T05:40:00.000Z',
    calendar_date: '2026-04-21',
    estimated: false,
    basis: ['provider-datestring-zone']
  });
});

test('record: a naive local timeString stays unparsed and visibly estimated', () => {
  const record = buildMeetingRecord(baseMeeting({
    date: null,
    dateString: '2026-04-21T07:40:00'
  }));
  assert.deepEqual(record.start, {
    utc: null,
    calendar_date: '2026-04-21',
    estimated: true,
    basis: ['local-time-without-zone']
  });
});

test('record: absent provider time stays fully unknown', () => {
  const record = buildMeetingRecord(baseMeeting({ date: null, dateString: null }));
  assert.deepEqual(record.start, {
    utc: null,
    calendar_date: null,
    estimated: true,
    basis: ['unknown']
  });
});

test('record: an impossible zoned date is not normalized into a different real day', () => {
  const record = buildMeetingRecord(baseMeeting({
    date: null,
    dateString: '2026-02-30T07:40:00.000Z'
  }));
  assert.deepEqual(record.start, {
    utc: null,
    calendar_date: null,
    estimated: true,
    basis: ['invalid-provider-date']
  });
});

test('record: duration keeps a known zero and preserves invalid/missing provider provenance', () => {
  assert.equal(buildMeetingRecord(baseMeeting({ duration: 0 })).duration_minutes, 0);
  assert.equal(buildMeetingRecord(baseMeeting({ duration: 12.5 })).duration_minutes, 12.5);

  const numericString = buildMeetingRecord(baseMeeting({ duration: '30' }));
  assert.equal(numericString.duration_minutes, null);
  assert.equal(numericString.source_metadata.provider_duration_raw, '30');
  assert.equal(numericString.source_metadata.provider_duration_raw_type, 'string');
  assert.equal(numericString.source_metadata.provider_duration_status, 'invalid');

  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, true, 'nope']) {
    const record = buildMeetingRecord(baseMeeting({ duration: value }));
    assert.equal(record.duration_minutes, null, `duration ${String(value)} must stay null`);
    assert.equal(record.source_metadata.provider_duration_status, 'invalid');
    if (typeof value === 'number' && !Number.isFinite(value)) {
      assert.equal(record.source_metadata.provider_duration_raw, null);
      assert.equal(record.source_metadata.provider_duration_raw_type, 'nonfinite-number');
      assert.equal(record.source_metadata.provider_duration_raw_repr, String(value));
    } else {
      assert.equal(record.source_metadata.provider_duration_raw, value);
    }
  }

  const missing = buildMeetingRecord(baseMeeting({ duration: null }));
  assert.equal(missing.duration_minutes, null);
  assert.equal(missing.source_metadata.provider_duration_raw, null);
  assert.equal(missing.source_metadata.provider_duration_raw_type, 'null');
  assert.equal(missing.source_metadata.provider_duration_status, 'missing');
});

test('record: provider-only metadata stays inert under source_metadata and never leaks into root extras', () => {
  const record = buildMeetingRecord(baseMeeting({
    provider_specific_secret_sauce: { nested: true }
  }));
  assert.equal(record.provider_specific_secret_sauce, undefined);
  assert.deepEqual(Object.keys(record.source_metadata).includes('provider_specific_secret_sauce'), false);
  assert.deepEqual(Object.keys(record).sort(), [...RECORD_ROOT_KEYS].sort());
});

test('record: opaque IDs with spaces, slashes and backslashes are preserved verbatim', () => {
  for (const id of ['UUID with spaces#42', '../opaque/meeting\\id', 'opaque:id/with space']) {
    const record = buildMeetingRecord(baseMeeting({ id, title: 'Opaque id' }));
    assert.equal(record.meeting_id, id);
    assert.equal(record.source.external_id, id);
    assert.equal(record.source_metadata.provider_meeting_id, id);
    validateMeetingRecord(record);
  }
});

test('record: empty, control, overlong or surrogate IDs are rejected without filename sanitization', () => {
  assert.throws(
    () => buildMeetingRecord(baseMeeting({ id: 'bad\u0001id' })),
    (error) => ['invalid_meeting_id', 'invalid_external_id'].includes(error.code)
  );
  const valid = buildMeetingRecord(baseMeeting());
  assert.throws(
    () => validateMeetingRecord({
      ...valid,
      source: { ...valid.source, external_id: 'bad\u0001id' }
    }),
    (error) => error.code === 'invalid_external_id'
  );
  assert.throws(
    () => buildMeetingRecord(baseMeeting({ id: 'x'.repeat(513) })),
    (error) => ['invalid_meeting_id', 'invalid_external_id'].includes(error.code)
  );
});

test('record: an empty transcript and empty summary is rejected at the adapter boundary', () => {
  assert.throws(
    () => buildMeetingRecord(baseMeeting({ summary: null, sentences: [] })),
    (error) => {
      assert.equal(error.code, 'record_empty_artifacts');
      return true;
    }
  );
});

test('record: the validator rejects unknown root keys and versions but preserves inert review truth', () => {
  const record = buildMeetingRecord(baseMeeting());
  assert.throws(() => validateMeetingRecord({ ...record, extra: true }), /unknown_root_key/);

  const wrongVersion = { ...record, schema: 'meeting-record/2' };
  assert.throws(() => validateMeetingRecord(wrongVersion), /unsupported_schema/);

  const falseApproval = {
    ...record,
    review: { recommended: false, reason: null },
    source_metadata: { ...record.source_metadata, content_status: 'accepted' }
  };
  assert.doesNotThrow(() => validateMeetingRecord(falseApproval));
  assert.equal(falseApproval.review.recommended, false);
});

test('record: source_metadata accepts inert provider extras but not arrays or non-finite numbers', () => {
  const record = buildMeetingRecord(baseMeeting());
  assert.throws(
    () => validateMeetingRecord({ ...record, source_metadata: [] }),
    /source_metadata_must_be_object/
  );
  assert.throws(
    () => validateMeetingRecord({ ...record, source_metadata: { bad: Number.NaN } }),
    /non_finite_number/
  );
});

test('record: an estimated or date-only start must expose its basis and estimate flag', () => {
  const record = buildMeetingRecord(baseMeeting());
  assert.throws(
    () => validateMeetingRecord({ ...record, start: { ...record.start, estimated: true, basis: [] } }),
    /estimated_start_requires_basis/
  );
  assert.throws(
    () => validateMeetingRecord({
      ...record,
      start: { utc: null, calendar_date: '2026-04-21', estimated: false, basis: [] }
    }),
    /null_start_requires_estimate/
  );
});

test('record: a rendered transcript without its raw source is rejected', () => {
  const record = buildMeetingRecord(baseMeeting());
  assert.throws(
    () => validateMeetingRecord({
      ...record,
      artifacts: { ...record.artifacts, transcript_raw_md: null }
    }),
    /transcript_requires_raw/
  );
});

test('record: writer-aligned size bounds fail closed before transport', () => {
  assert.throws(
    () => buildMeetingRecord(baseMeeting(), { providerState: { huge: 'x'.repeat(70_000) } }),
    (error) => error.code === 'source_metadata_too_large'
  );
  assert.throws(
    () => buildMeetingRecord(baseMeeting({
      summary: { overview: 'x'.repeat(530_000) },
      sentences: []
    })),
    (error) => error.code === 'string_too_large'
  );
});

test('record: control characters and unpaired surrogates are rejected, never silently normalized', () => {
  const record = buildMeetingRecord(baseMeeting());
  assert.throws(
    () => validateMeetingRecord({ ...record, title: 'Bad\u0001title' }),
    /invalid_title/
  );
  assert.throws(
    () => validateMeetingRecord({ ...record, source_metadata: { bad: '\uD800' } }),
    /unpaired_surrogate/
  );
});
