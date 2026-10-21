---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_fireflies-meetings.mjs
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
---

# Meetings-Schema

Gemeinsame GraphQL-Feldkataloge, Query-Builder und reine Render-/Parser-Helfer für Transcript- und Transcripts-Queries.

## Why this shape
Feldkataloge werden geteilt statt pro Skript kopiert; Query-Aufbau ist reine Funktion ohne I/O. YAML-Helfer (`yamlString`, `yamlDurationMinutes`) leben in [scripts/_yaml-helpers.mjs](../../../scripts/_yaml-helpers.mjs) und werden nur noch vom schlanken CLI-Frontmatter genutzt. Pfad-Helfer (`relativeWorkspacePath`) leben in [scripts/_path-helpers.mjs](../../../scripts/_path-helpers.mjs) und werden von Sync und Export verwendet.

## Shape
`LIST_MEETINGS_FIELDS` ist das schlanke Listenfeldkatalog-Set (id, title, date, dateString, duration, transcript_url, organizer_email, host_email, channels). `MINIMAL_MEETING_FIELDS` umfasst zusätzlich Teilnehmer, Speakers, Attendance, User, `meeting_info`, das volle `summary`-Objekt, `shared_with` und `apps_preview`. Der gemeinsame `SENTENCE_FIELDS`-Kern wird von `FULL_ONLY_MEETING_FIELDS` (inkl. `ai_filters`) und `SENTENCES_ONLY_MEETING_FIELDS` (nur `id` + Sentences) komponiert. `GET_MEETING_FORMATS`/`GET_MEETING_MODES` sind geschlossene Validierungslisten. `buildGetMeetingQuery` bettet Sentences nur in `full`/`sentences-only` ein. `secondsToClock`, `renderTranscriptMarkdown(meeting, {bracketed})`, `parseGetMeetingArgs` und `validateGetMeetingArgs` sind reine Helfer. `validateGetMeetingArgs` erzwingt zusätzlich den Record-Export-Vertrag (`.meeting-export.json`, JSON-Format, Lease, Lock-Root). `buildListMeetingsRequest` erlaubt Keyword/Scope, fromDate/toDate, limit/skip, host_email, user_id, channel_id und schlägt bei `scope` ohne `keyword` mit `scope_requires_keyword` fehl.

Die früheren Funktionen `buildMeetingDestinationPaths` und `buildProjectRelocatePlan` wurden mit dem Adapter-Schreibpfad entfernt; Zielpfade für Meeting-Dateien gehören ausschließlich dem Writer.

- [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs) - `scripts/_fireflies-meetings.mjs:17` (LIST_MEETINGS_FIELDS), `scripts/_fireflies-meetings.mjs:32` (MINIMAL_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:139` (FULL_ONLY_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:149` (buildGetMeetingQuery), `scripts/_fireflies-meetings.mjs:277` (renderTranscriptMarkdown), `scripts/_fireflies-meetings.mjs:364` (parseGetMeetingArgs), `scripts/_fireflies-meetings.mjs:432` (validateGetMeetingArgs), `scripts/_fireflies-meetings.mjs:467` (buildListMeetingsRequest)

## Connected to
[Client](client.md), [CLI](cli.md), [Record](record.md), [Sync](sync.md).

## If you change this
- **Hits:** get-meeting, list-meetings, sync; Feld-/Schema-Regressionen in `tests/`; Record-Transformation, die den gerenderten Transkript-Kern nutzt.
- **Does not hit:** Channels- und Probe-Queries mit eigener Feldauswahl; Writer-interne Pfadableitung.

## Surfaces
Die Query-Strings gehen über `firefliesGraphQL` an den externen Fireflies-Endpoint; der Server validiert Feldnamen. Render-/Parser-Helfer sind rein lokal.

## See
Feldnamen nach Doku: [references/transcript-queries.md](../../../references/transcript-queries.md). [Record-Vertrag](../../../references/meeting-record-v1.md). [Änderungsrouting](../effects/CONTEXT.md).
