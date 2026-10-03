---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_fireflies-meetings.mjs
verified_at: 2026-10-03
revision: 38ab361f1e8371e32ded20aa201d8db9140891eb
---

# Meetings-Schema

Gemeinsame GraphQL-Feldkataloge und Query-Builder für Transcript- und Transcripts-Queries.

## Why this shape
Feldkataloge werden geteilt statt pro Skript kopiert; Query-Aufbau ist reine Funktion ohne I/O. YAML-Helfer (`yamlString`, `yamlScalar`, `yamlInline`, `yamlDurationMinutes`) leben seit Issue #10 gemeinsam in [scripts/_yaml-helpers.mjs](../../../scripts/_yaml-helpers.mjs) und werden von Sync und CLI-Frontmatter importiert; die Byte-Identität der Frontmatter-Ausgaben vor/nach der Konsolidierung ist als Run-Nachweis belegt. Pfad-Helfer (`relativeWorkspacePath`) leben seit Issue #13 in [scripts/_path-helpers.mjs](../../../scripts/_path-helpers.mjs) und werden von Sync und Relocate-Plan importiert.

## Shape
`LIST_MEETINGS_FIELDS` ist das schlanke Listenfeldkatalog-Set (id, title, date, dateString, duration, transcript_url, organizer_email, host_email, channels). `MINIMAL_MEETING_FIELDS` umfasst zusätzlich Teilnehmer, Speakers, Attendance, User, meeting_info, das volle `summary`-Objekt, shared_with und apps_preview. Der gemeinsame `SENTENCE_FIELDS`-Kern wird von `FULL_ONLY_MEETING_FIELDS` (inkl. `ai_filters`) und `SENTENCES_ONLY_MEETING_FIELDS` (nur `id` + Sentences) komponiert. `GET_MEETING_FORMATS` und `GET_MEETING_MODES` sind die geschlossenen Validierungslisten (`json|markdown`, `minimal|full|sentences-only`). `buildGetMeetingQuery` bettet Sentences nur in den `full`- und `sentences-only`-Modi ein; `secondsToClock`, `renderTranscriptMarkdown(meeting, {bracketed})`, `parseGetMeetingArgs` und `validateGetMeetingArgs` sind die exportierten reinen Render-/Parser-Helfer (Parser wirft `missing value for <flag>` bei `--`-beginnenden Flag-Werten). `buildListMeetingsRequest` erlaubt Keyword/Scope, fromDate/toDate, limit/skip, host_email, user_id, channel_id und schlägt bei `scope` ohne `keyword` mit `scope_requires_keyword` fehl; `scope` wird inline (nicht als Variable) eingebaut.

- [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs) — `scripts/_fireflies-meetings.mjs:1` (LIST_MEETINGS_FIELDS), `scripts/_fireflies-meetings.mjs:16` (MINIMAL_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:123` (FULL_ONLY_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:126` (SENTENCES_ONLY_MEETING_FIELDS), `scripts/_fireflies-meetings.mjs:130` (GET_MEETING_FORMATS/MODES), `scripts/_fireflies-meetings.mjs:133` (buildGetMeetingQuery), `scripts/_fireflies-meetings.mjs:146` (secondsToClock), `scripts/_fireflies-meetings.mjs:153` (renderTranscriptMarkdown), `scripts/_fireflies-meetings.mjs:179` (parseGetMeetingArgs), `scripts/_fireflies-meetings.mjs:212` (validateGetMeetingArgs), `scripts/_fireflies-meetings.mjs:228` (buildListMeetingsRequest)

## Connected to
[Client](client.md), [CLI](cli.md), [Sync](sync.md).

## If you change this
- **Hits:** get-meeting, list-meetings, sync-meetings-to-memory; alle Skripte, die Query-Aufbau wiederverwenden; Feld-/Schema-Regressionen in `tests/`.
- **Does not hit:** Channels- und Probe-Queries mit eigener Feldauswahl in den jeweiligen Skripten.

## Surfaces
Die Query-Strings gehen über `firefliesGraphQL` an den externen Fireflies-Endpoint; Server validiert Feldnamen.

## See
Feldnamen nach Doku: [references/transcript-queries.md](../../../references/transcript-queries.md). [Änderungsrouting](../effects/CONTEXT.md).