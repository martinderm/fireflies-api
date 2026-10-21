---
type: object
cluster: orchestrator
universe: live
status: verified
entity: scripts/sync-meetings-to-memory.mjs
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
---

# Sync

Read-only Intake-Orchestrierung: liest Register und API, baut Records und delegiert jeden Record an den kanonischen Writer.

## Why this shape
Intake, Transformation und Publikation sind getrennt. Der Adapter kennt Fireflies und Fingerprints, aber nicht die Writer-eigene Register-/Journal-/Pfadsemantik. Dadurch gibt es genau eine Schreibgrenze und keinen zweiten Meeting-Publisher.

## Shape
`resolveMeetingsRoot` wählt weiterhin `memory/evidence/meetings` (Fallback `memory/references/meetings`) oder einen Settings-Pfad, aber **nur zum Lesen** des Registers. `parseSyncArgs` akzeptiert `--limit`, `--skip`, `--mode`, `--meeting-id`, `--refresh-changed`, `--dry-run`, `--context-channel-slug/title`, die Routingoptionen `--project`/`--topic`/`--event` plus Aliase `--project-slug`/`--topic-slug`/`--event-slug` sowie die Writer-Konfiguration `--meeting-writer`, `--python`, `--workspace-lock-root`, `--lease-id`, `--conversation-id`, `--timeout-ms`. Unbekannte Optionen und positionale Argumente sind Nutzungsfehler. `resolveRouting` normalisiert nur nichtleere Werte; ein **fehlendes** Routing ist gültig und bedeutet unmapped Intake. Explizit leere oder zu `ohne-channel` normalisierende Werte werfen `empty_<name>_slug:<raw>`.

`readRegistryFile` unterscheidet ein fehlendes Register (leerer Ausgangszustand) von einem beschädigten: ungültiges JSON, nacktes Array, ungültiger Root, nicht-Array-`meetings` und ungültige `channel_mappings` sind Rejections. Es wird nie `catch -> []` verwendet und nie etwas zurückgeschrieben. `computeMeetingFingerprint` bleibt der SHA-256 über Titel, Zeit, Dauer, Channels, Speakers, Summary, Sentences und Apps. Der alte Fingerprint wird aus `source_metadata.server_fingerprint` oder dem Legacy-Rootfeld gelesen; `server_change_status` (`new`/`unknown`/`changed`/`unchanged`) und `server_changed_since_last_sync` reisen inert in `source_metadata`.

`runMeetingsIntake` sucht bestehende Einträge über Quellsystem plus externe Identität (Fireflies-Alias `fireflies_<id>` bleibt lesbar) **vor** dem Detail-Fetch. Mehrdeutige Identität, fremde Accountbindung und ein nichtleerer gebundener Account bei unbekanntem aktuellem Account stoppen den Kandidaten ohne API-/Writer-Aufruf; ein ungebundener Bestandseintrag bleibt unter der Quellsystem-Identität zulässig. Danach wird pro Meeting ein Record gebaut. Jeder Record geht an `writer.ingestRecord(record, {route, dryRun})`. Erfolge und Fehler bleiben pro Meeting sichtbar (`meetings`, `failures`, `synced`, `failed`); `state` ist `success`, `partial_error` oder `recovery_required`. `recovery_required`/`outcome_unknown` stoppt den Batch. `runSync` prüft zuerst Writer-Konfiguration und Capabilities, dann das Register, dann die API; Exit 0 nur bei vollem Erfolg, 2 bei Rejection/Teilfehler, 3 bei Recovery, 1 bei API-Fehlern.

Es gibt keine Adapter-Writes: kein `mkdir`, kein Markdown, kein Frontmatter, kein `meetings.json`, kein Verschieben/Löschen. Der öffentliche CLI-/Funktionseinstieg bleibt, die Record-Ausführung liegt beim Writer.

- [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:43` (resolveMeetingsRoot), `scripts/sync-meetings-to-memory.mjs:68` (parseSyncArgs), `scripts/sync-meetings-to-memory.mjs:168` (resolveRouting), `scripts/sync-meetings-to-memory.mjs:177` (readRegistryFile), `scripts/sync-meetings-to-memory.mjs:214` (computeMeetingFingerprint), `scripts/sync-meetings-to-memory.mjs:333` (runMeetingsIntake), `scripts/sync-meetings-to-memory.mjs:544` (runSync), `scripts/sync-meetings-to-memory.mjs:618` (runSyncCli)

## Connected to
[Record](record.md), [Writer](writer.md), [Meetings-Schema](meetings-schema.md), [Client](client.md), [Skill-Verhalten](skill-behavior.md). Prozess: [meeting-sync](../processes/meeting-sync.md).

## If you change this
- **Hits:** `meetings.json`-Leser, Fingerprint-/Alias-Semantik, Routingoptionen, Writer-Transport, SKILL.md-Sync-Regeln, Sync-Tests.
- **Does not hit:** Reine Lese-Skripte (list/channels/probe), Writer-interne Journal-/Recovery-Logik.

## Surfaces
Liest Fireflies-API und lokale `meetings.json`; schreibt selbst nichts. Schreibseite ist ausschließlich der externe Writer.

## See
[Record-Vertrag](../../../references/meeting-record-v1.md), [Datenmodell](../../../references/data-model.md). [Änderungsrouting](../effects/CONTEXT.md).
