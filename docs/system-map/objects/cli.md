---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/get-meeting.mjs
verified_at: 2026-10-01
revision: 6ca11a640811f1bbc0cb4bab5f3f90424064eaba
---

# CLI

Dünne CLI-Skripte über dem gemeinsamen Client; jeder Aufruf ist ein JSON-Envelope auf stdout bzw. stderr.

## Why this shape
Skripte bleiben austauschbare Adapter; Argument-Parsing und Fehler-Semantik folgen einem gemeinsamen Muster.

## Shape
`get-meeting.mjs` holt ein Meeting und gibt `{ok, mode, meeting}` als JSON aus. Modi: `--mode minimal|full|sentences-only` (Fehler `mode_must_be_minimal_full_or_sentences_only`), `--format json|markdown` (Fehler `format_must_be_json_or_markdown`), `--sentences-only` (Flag erzwingt den sentences-only-Modus). Auto-Default: `--format markdown` ohne explizites `--mode` und ohne `--sentences-only` resolvliert den Modus automatisch zu `sentences-only`; ein explizits gesetztes `--mode` gewinnt jederzeit (Tracking über `modeExplicit`). `--format markdown` rendert timestamped Speaker-Dialog (`[mm:ss] Speaker`, Speaker-Fallback `Unknown Speaker`, Fallback auf `raw_text`, leerer Sentences-Fall → Platzhaltertext), `--output <file>` schreibt das Resultat in eine Datei und bestätigt auf stdout mit kurzem Envelope `{ok, mode, format, output}`. Fail-loud-Absicherungen: fehlende, `''`-leere oder `--`-beginnende Werte an Wert-Flags werfen `missing value for <flag>`; überzählige positionale Argumente werfen `unexpected_positional_argument:<arg>`; Nutzungsfehler exit 2, API-Fehler exit 1. Alle Fehlerpfade setzen `process.exitCode` statt `process.exit`, damit der Event-Loop drainen kann (libuv-Assertion-Crash auf Windows/Node 24 vermieden). Dual-Evidence-Optionen: `--with-frontmatter` prepended einen CLI-Frontmatter-Block (`id`, `title`, `date` = dateString-Fallback, `duration_minutes`, `participants`, `source: "fireflies.ai"`, `type: "meeting-transcript"`; YAML-Strings JSON-quoted, Fehlende als null/[]) — nur bei `--format markdown` wirksam, sonst `frontmatter_requires_markdown_format` (exit 2); wenn der effektive Modus `sentences-only` ist und kein explizites `--mode` gesetzt ist, resolvliert die Kaskade (`resolveGetMeetingMode`) auf `full`, weil der Frontmatter-Metadatenbedarf den vollen Feldkatalog benötigt. `--speaker-map <mapping>` akzeptiert KV-Paare (`0=Dr. X,1=Martin`) oder JSON; `parseSpeakerMap` normalisiert auf byId/byName (numerische Keys mit Vorrang vor abgeleiteten `Speaker N`-Keys, Duplikat-Keys: letzter gewinnt) und wirft fail-loud (`invalid_speaker_map_json`, `invalid_speaker_map_entry`, `speaker_map_empty_value`); das Rendering resolvliert pro Sentence `speaker_id` → `speaker_name` → Original-Label. Bei `--format json` ist `--speaker-map` ein stiller No-op. `list-meetings.mjs` listet mit Pagination (limit 1–50, skip ≥ 0) und Optionalfiltern sowie `{ok, query, count, meetings}`. `list-channels.mjs` gibt `{ok, count, channels}` aus. `probe-meeting-capabilities.mjs` prüft read-only, welche Felder im Account befüllt sind: `--include-summary` fragt den Summary-Block an, `--include-paid-fields` optiert die planabhängigen Felder (`audio_url`, `video_url`, `analytics`) ein — die Standard-Probe fragt sie NICHT an, weil Fireflies auf dem Free-Plan die gesamte Query mit `paid_required` abbricht; nicht abgefragte Capabilities werden als `null` gekennzeichnet (statt `false` zu behaupten). Die Query-/Capabilities-Komposition lebt als reine Funktionen (`buildProbeQuery`, `buildProbeCapabilities`) in [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs). Alle Argument-Parser sind handgeschrieben ohne Dependencies.

- [scripts/get-meeting.mjs](../../../scripts/get-meeting.mjs) — `scripts/get-meeting.mjs:1`
- [scripts/list-meetings.mjs](../../../scripts/list-meetings.mjs) — `scripts/list-meetings.mjs:1`
- [scripts/list-channels.mjs](../../../scripts/list-channels.mjs) — `scripts/list-channels.mjs:1`
- [scripts/probe-meeting-capabilities.mjs](../../../scripts/probe-meeting-capabilities.mjs) — `scripts/probe-meeting-capabilities.mjs:1`
- [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:50` (parseArgs)

Frontmatter-Hinweis: Der CLI-Frontmatter-Block (`buildCliFrontmatter` in [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs)) ist ein schlanker Export-Dialekt für One-Shot-Abnahmen; der reiche Sync-Dialekt gemäß [references/data-model.md](../../../references/data-model.md) bleibt maßgeblich für Meeting-Ablagen im Sync.

## Connected to
[Client](client.md), [Meetings-Schema](meetings-schema.md), [Qualität](quality.md). Prozesse: [api-call](../processes/api-call.md).

## If you change this
- **Hits:** CLI-Regressionen in `tests/`, README-Schnellstart, SKILL.md-Skriptverzeichnis, System-Map-Karten [CLI](cli.md) und [Qualität](quality.md).
- **Does not hit:** Auth-Resolvierung solange nur Konsumiert; meetings.json-Schema.

## Surfaces
CLI-Aufrufe aus Workspace-Root (oder mit `WORKSPACE_ROOT`); stdout ist maschinenlesbarer JSON-Envelope (markdown-Format: Plaintext-Dialog), stderr tragen Fehler. Der Fehlerpfad endet drain-safe via `process.exitCode`.

## See
Skriptverzeichnis und Modi: [SKILL.md](../../../SKILL.md). [Änderungsrouting](../effects/CONTEXT.md).