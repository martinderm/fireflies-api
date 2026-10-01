---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/get-meeting.mjs
verified_at: 2026-10-01
revision: 03fa8e73ec212263aa41accde6391b683d05f01b
---

# CLI

Dünne CLI-Skripte über dem gemeinsamen Client; jeder Aufruf ist ein JSON-Envelope auf stdout bzw. stderr.

## Why this shape
Skripte bleiben austauschbare Adapter; Argument-Parsing und Fehler-Semantik folgen einem gemeinsamen Muster.

## Shape
`get-meeting.mjs` holt ein Meeting und gibt `{ok, mode, meeting}` als JSON aus. Modi: `--mode minimal|full|sentences-only` (Fehler `mode_must_be_minimal_full_or_sentences_only`), `--format json|markdown` (Fehler `format_must_be_json_or_markdown`), `--sentences-only` (Flag erzwingt den sentences-only-Modus). Auto-Default: `--format markdown` ohne explizites `--mode` und ohne `--sentences-only` resolvliert den Modus automatisch zu `sentences-only`; ein explizits gesetztes `--mode` gewinnt jederzeit (Tracking über `modeExplicit`). `--format markdown` rendert timestamped Speaker-Dialog (`[mm:ss] Speaker`, Speaker-Fallback `Unknown Speaker`, Fallback auf `raw_text`, leerer Sentences-Fall → Platzhaltertext), `--output <file>` schreibt das Resultat in eine Datei und bestätigt auf stdout mit kurzem Envelope `{ok, mode, format, output}`. Fail-loud-Absicherungen: fehlende, `''`-leere oder `--`-beginnende Werte an Wert-Flags werfen `missing value for <flag>`; überzählige positionale Argumente werfen `unexpected_positional_argument:<arg>`; Nutzungsfehler exit 2, API-Fehler exit 1. Alle Fehlerpfade setzen `process.exitCode` statt `process.exit`, damit der Event-Loop drainen kann (libuv-Assertion-Crash auf Windows/Node 24 vermieden). `list-meetings.mjs` listet mit Pagination (limit 1–50, skip ≥ 0) und Optionalfiltern sowie `{ok, query, count, meetings}`. `list-channels.mjs` gibt `{ok, count, channels}` aus. `probe-meeting-capabilities.mjs` prüft read-only, welche Felder im Account befüllt sind, optional mit `--include-summary`. Alle Argument-Parser sind handgeschrieben ohne Dependencies.

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
CLI-Aufrufe aus Workspace-Root (oder mit `WORKSPACE_ROOT`); stdout ist maschinenlesbarer JSON-Envelope (markdown-Format: Plaintext-Dialog), stderr tragen Fehler. Der Fehlerpfad endet drain-safe via `process.exitCode`.

## See
Skriptverzeichnis und Modi: [SKILL.md](../../../SKILL.md). [Änderungsrouting](../effects/CONTEXT.md).