---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/get-meeting.mjs
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
---

# CLI

Dünne CLI-Skripte über dem gemeinsamen Client; jeder Aufruf ist ein JSON-Envelope auf stdout bzw. stderr.

## Why this shape
Skripte bleiben austauschbare Adapter; Argument-Parsing und Fehler-Semantik folgen einem gemeinsamen Muster. Seit OI #35 trennt die CLI strikt zwischen flüchtiger stdout-Ausgabe, explizitem Record-Export und delegierendem Sync.

## Shape
`get-meeting.mjs` holt ein Meeting. Modi: `--mode minimal|full|sentences-only` (Fehler `mode_must_be_minimal_full_or_sentences_only`), `--format json|markdown` (`format_must_be_json_or_markdown`), `--sentences-only`. Auto-Default: `--format markdown` ohne explizites `--mode` wird `sentences-only`; explizites `--mode` gewinnt. `--format markdown` rendert den timestamped Speaker-Dialog, `--speaker-map` mappt IDs/Namen, `--with-frontmatter` prepended den schlanken CLI-Frontmatter-Block nur auf stdout. Wert-Flags weisen fehlende, `''`-leere oder `--`-beginnende Werte als `missing value for <flag>` ab; überzählige Positionalargumente sind `unexpected_positional_argument:<arg>`; Nutzungsfehler exit 2, API-Fehler exit 1. Fehlerpfade setzen `process.exitCode` statt `process.exit`.

Dateiausgabe ist bewusst kein Markdown-Sidecar: `--output` muss auf `.meeting-export.json` enden, `--format json` verwenden und zusätzlich `--lease-id` plus `--workspace-lock-root` tragen (`output_must_end_with_meeting_export_json`, `output_requires_json_record_export`, `output_requires_lease_id`, `output_requires_workspace_lock_root`). `resolveRecordExportTarget` prüft `<workspace>/data/` per realpath (Pfad-, Symlink-/Junction-Flucht, fehlende Zone/Eltern) **vor** Credentials/API. `exportMeetingRecord` importiert den Shared Guard `workspace_lock_guard.py` in place über einen Python-Kindprozess und ruft `require_workspace_lock(..., allow_legacy=False)` auf; es werden keine Ownership-Regeln nachgebaut. Guard + Pfad laufen vor Credentials/API, vor dem Staging und unmittelbar vor der create-only-Publikation. Freigabe/Ersatz der Lease nach Fetch oder Staging hinterlässt weder Export noch Temp-Datei; die letzte Prüfung bis zum atomaren Create bleibt eine kooperative Race-Grenze. Die deklarierte Lease-ID ist keine kryptografische Aufruferidentität. Der Export nutzt immer den vollen Feldkatalog, baut einen validierten `meeting-record/1`-Record und schreibt ihn no-clobber (`output_exists_no_clobber`) über eine Temp-Datei im selben `data/`-Verzeichnis. Es entsteht kein unregistriertes Summary-/Transcript-Paar.

`list-meetings.mjs` listet mit Pagination (limit 1-50, skip = 0), Optionalfiltern und `{ok, query, count, meetings}`. `list-channels.mjs` gibt `{ok, count, channels}` aus. `probe-meeting-capabilities.mjs` prüft read-only; `--include-summary` fragt den Summary-Block an, `--include-paid-fields` optiert planabhängige Felder ein, nicht abgefragte Capabilities sind `null`. `sync-meetings-to-memory.mjs` ist ein delegierender Einstieg: `--project`/`--topic`/`--event` (plus `-slug`-Aliase) gehen an den Writer, `--meeting-writer`/`--python`/`--workspace-lock-root`/`--lease-id` konfigurieren den Trusted Transport. Ohne Routing ist der Lauf ein gültiger unmapped Intake. Die CLI schreibt weder Register noch Meeting-Dateien.

- [scripts/get-meeting.mjs](../../../scripts/get-meeting.mjs) - `scripts/get-meeting.mjs:64` (resolveRecordExportTarget), `scripts/get-meeting.mjs:113` (stageRecordExport), `scripts/get-meeting.mjs:134` (publishStagedRecordExport), `scripts/get-meeting.mjs:146` (exportMeetingRecord), `scripts/get-meeting.mjs:217` (main)
- [scripts/_workspace-lease.mjs](../../../scripts/_workspace-lease.mjs) - `scripts/_workspace-lease.mjs:1` (canonical guard import in place)
- [scripts/list-meetings.mjs](../../../scripts/list-meetings.mjs) - `scripts/list-meetings.mjs:1`
- [scripts/list-channels.mjs](../../../scripts/list-channels.mjs) - `scripts/list-channels.mjs:1`
- [scripts/probe-meeting-capabilities.mjs](../../../scripts/probe-meeting-capabilities.mjs) - `scripts/probe-meeting-capabilities.mjs:1`
- [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:69` (parseSyncArgs), `scripts/sync-meetings-to-memory.mjs:544` (runSync)

## Connected to
[Client](client.md), [Meetings-Schema](meetings-schema.md), [Record](record.md), [Writer](writer.md), [Sync](sync.md), [Qualität](quality.md). Prozesse: [api-call](../processes/api-call.md), [meeting-sync](../processes/meeting-sync.md).

## If you change this
- **Hits:** CLI-Regressionen in `tests/`, README-Schnellstart, SKILL.md-Skriptverzeichnis, Karten [CLI](cli.md), [Record](record.md), [Qualität](quality.md).
- **Does not hit:** Auth-Resolvierung solange nur konsumiert; Writer-interne Registerlogik.

## Surfaces
CLI-Aufrufe aus dem Workspace-Root (oder mit `WORKSPACE_ROOT`); stdout ist maschinenlesbarer JSON-Envelope (markdown-Format: Plaintext-Dialog), stderr trägt Fehler. Datei-Export ausschließlich unter `<workspace>/data/*.meeting-export.json`. Fehlerpfade enden drain-safe via `process.exitCode`.

## See
Skriptverzeichnis und Modi: [SKILL.md](../../../SKILL.md). [Record-Vertrag](../../../references/meeting-record-v1.md). [Änderungsrouting](../effects/CONTEXT.md).
