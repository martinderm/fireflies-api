---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_fireflies-meetings.mjs
verified_at: 2026-09-30
revision: a73fc6b6e937a718510e173e41d379465f5d5993
---

# Meetings-Schema

Gemeinsame GraphQL-Feldkataloge und Query-Builder für Transcript- und Transcripts-Queries.

## Why this shape
Feldkataloge werden geteilt statt pro Skript kopiert; Query-Aufbau ist reine Funktion ohne I/O.

## Shape
`LIST_MEETINGS_FIELDS` ist das schlanke Listenfeldkatalog-Set (id, title, date, dateString, duration, transcript_url, organizer_email, host_email, channels). `MINIMAL_MEETING_FIELDS` umfasst zusätzlich Teilnehmer, Speakers, Attendance, User, meeting_info, das volle `summary`-Objekt, shared_with und apps_preview. `FULL_ONLY_MEETING_FIELDS` ergänzt `sentences` (inkl. `raw_text` und `ai_filters`) und wird nur vom `full`-Modus des `buildGetMeetingQuery` eingebettet. `buildListMeetingsRequest` erlaubt Keyword/Scope, fromDate/toDate, limit/skip, host_email, user_id, channel_id und schlägt bei `scope` ohne `keyword` mit `scope_requires_keyword` fehl; `scope` wird inline (nicht als Variable) eingebaut.

- [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs) — `scripts/_fireflies-meetings.mjs:1` (LIST_MEETINGS_FIELDS), `scripts/_fireflies-meetings.mjs:16` (MINIMAL_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:103` (FULL_ONLY_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:124` (buildGetMeetingQuery), `scripts/_fireflies-meetings.mjs:133` (buildListMeetingsRequest)

## Connected to
[Client](client.md), [CLI](cli.md), [Sync](sync.md).

## If you change this
- **Hits:** get-meeting, list-meetings, sync-meetings-to-memory; alle Skripte, die Query-Aufbau wiederverwenden; Feld-/Schema-Regressionen in `tests/`.
- **Does not hit:** Channels- und Probe-Queries mit eigener Feldauswahl in den jeweiligen Skripten.

## Surfaces
Die Query-Strings gehen über `firefliesGraphQL` an den externen Fireflies-Endpoint; Server validiert Feldnamen.

## See
Feldnamen nach Doku: [references/transcript-queries.md](../../../references/transcript-queries.md). [Änderungsrouting](../effects/CONTEXT.md).