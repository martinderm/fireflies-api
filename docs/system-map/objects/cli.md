---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/get-meeting.mjs
verified_at: 2026-09-30
revision: dc0d4c2010031b1aeb9b57cd302f741da0122675
---

# CLI

Dünne CLI-Skripte über dem gemeinsamen Client; jeder Aufruf ist ein JSON-Envelope auf stdout bzw. stderr.

## Why this shape
Skripte bleiben austauschbare Adapter; Argument-Parsing und Fehler-Semantik folgen einem gemeinsamen Muster.

## Shape
`get-meeting.mjs` holt ein Meeting und gibt `{ok, mode, meeting}` als JSON aus. Modi: `--mode minimal|full|sentences-only` (Fehler `mode_must_be_minimal_full_or_sentences_only`), `--format json|markdown` (Fehler `format_must_be_json_or_markdown`), `--sentences-only` (Flag erzwingt den sentences-only-Modus); `--format markdown` rendert timestamped Speaker-Dialog (`[mm:ss] Speaker`, Speaker-Fallback `Unknown Speaker`, Fallback auf `raw_text`, leerer Sentences-Fall → Platzhaltertext), `--output <file>` schreibt das Resultat in eine Datei und bestätigt auf stdout mit kurzem Envelope `{ok, mode, format, output}`. Wert-Flags weisen fehlende Werte am Argv-Ende (`next === undefined`) sowie `--`-beginnende Folge-Flags als Wert fail-loud ab (`missing value for <flag>`, exit 2). `list-meetings.mjs` listet mit Pagination (limit 1–50, skip ≥ 0) und Optionalfiltern sowie `{ok, query, count, meetings}`. `list-channels.mjs` gibt `{ok, count, channels}` aus. `probe-meeting-capabilities.mjs` prüft read-only, welche Felder im Account befüllt sind, optional mit `--include-summary`. Alle Argument-Parser sind handgeschrieben ohne Dependencies.

- [scripts/get-meeting.mjs](../../../scripts/get-meeting.mjs) — `scripts/get-meeting.mjs:1`
- [scripts/list-meetings.mjs](../../../scripts/list-meetings.mjs) — `scripts/list-meetings.mjs:1`
- [scripts/list-channels.mjs](../../../scripts/list-channels.mjs) — `scripts/list-channels.mjs:1`
- [scripts/probe-meeting-capabilities.mjs](../../../scripts/probe-meeting-capabilities.mjs) — `scripts/probe-meeting-capabilities.mjs:1`
- [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:50` (parseArgs)

## Connected to
[Client](client.md), [Meetings-Schema](meetings-schema.md), [Qualität](quality.md). Prozesse: [api-call](../processes/api-call.md).

## If you change this
- **Hits:** CLI-Regressionen in `tests/`, README-Schnellstart, SKILL.md-Skriptverzeichnis, System-Map-Karten [CLI](cli.md) und [Qualität](quality.md).
- **Does not hit:** Auth-Resolvierung solange nur Konsumiert; meetings.json-Schema.

## Surfaces
CLI-Aufrufe aus Workspace-Root (oder mit `WORKSPACE_ROOT`); stdout ist maschinenlesbarer JSON-Envelope, stderr tragen Fehler.

## See
Skriptverzeichnis und Modi: [SKILL.md](../../../SKILL.md). [Änderungsrouting](../effects/CONTEXT.md).