---
type: object
cluster: orchestrator
universe: live
status: verified
entity: scripts/sync-meetings-to-memory.mjs
verified_at: 2026-10-03
revision: 3b90b8f8ae06a0e6d99ea69d68fc4982db4edf31
---

# Sync

Lokaler Meeting-Sync in den aufrufenden Agent-Workspace mit knappen Kanälen, Fingerprinting und Review-Vormerkung.

## Why this shape
Intake und fachliche Klassifikation sind getrennt: der Sync spiegelt und markiert, die Zuordnung entscheidet der aufrufende Agent im Chat.

## Shape
`resolveMeetingsRoot` wählt `memory/evidence/meetings` (Dual Evidence, Fallback auf `memory/references/meetings` in Altsystemen) oder einen Settings-Pfad (`fireflies-api.meetingsRoot`); Ziel ist immer der Workspace außerhalb dieses Repos. Pro Meeting werden Summary- und Volltranskript-Markdown geschrieben (`YYYY-MM-DD-<slug>.summary.md` / `.transcript.md`; der Transcript-Body nutzt den gemeinsamen `renderTranscriptMarkdown`-Kern mit `bracketed: false`), `meetings.json` gepflegt (`channel_strategy` im knappen-Channel-Modell, `channel_mappings` pro Channel mit `routing_mode`) und ein `server_fingerprint` (SHA-256 über Metadaten, Summary und Sentences) statt eines erfundenen `updated_at` gespeichert; daraus leitet sich `server_change_status` (`new`, `unknown`, `changed`, `unchanged`) ab. Klassifikationsfelder bleiben bei Intake ungelöst (`classification_status: unmapped`, `review_recommended: true`) und `review_input` wird für den Chat-Review geschrieben; bereits gelöste Reviews (`llm_review_status: resolved`/`user-query`) bleiben stabil, außer der Server-Fingerprint ändert sich (dann zurück zu `pending`). Ein Cloud-Titel-Mutation-Suffix `(syncd)` existiert als Query, wird im Standardlauf aber nicht geschrieben (`cloud_title_error: skipped-no-write`). Modi: Standardlauf (nur neue), `--meeting-id <id> --mode all` (einzeln), `--refresh-changed --mode all` (bekannte erneut prüfen), optionaler Channel-Filter via `--context-channel-slug`/`--context-channel-title`. Seit #14 ist der komplette Intake-Loop (`runMeetingsIntake`) mit injizierbaren Graph-Calls und io-Adaptern exportiert — netzfrei regressionstestbar (`tests/sync-intake-smoke.mjs`); das CLI nutzt ihn mit `firefliesGraphQL` und echtem fs.

Project-Scoping (Issue #8): `--project-slug <slug>` (slugified, gemeinsamer `slugify`-Export) leitet die Zielordner für Meeting-Dateien (`buildMeetingDestinationPaths`) nach `memory/evidence/projects/<slug>/meetings/<channelSlug|ohne-channel>` ab — `meetings.json` bleibt am Meetings-Root, nur die Dateien gehen in den Projektbaum. Der Eintrag erhält `project_slug`, `project_slugs` (Dedup) und `project_scoped: true`; `review_input.project_slug` ist eine Nutzer-Vormerkung, keine Klassifikation (`classification_status` bleibt `unmapped`, `review_recommended` bleibt `true`); `channel_mappings` bleibt unangetastet. Härtung (#12): fehlende, leere, `--`-beginnende oder zu `ohne-channel` normalisierende Projekt-Slugs schlagen fail-loud ab (`empty_project_slug:<raw>` bzw. `missing value for --project-slug`, exit 2 — vor jedem Registry-Read und API-Call); der Projektbaum ist Dual-Evidence-fest unter `workspaceRoot` verdrahtet, nur der Pool folgt einem Custom-Root.

- [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:10` (resolveMeetingsRoot), `scripts/sync-meetings-to-memory.mjs:218` (computeMeetingFingerprint), `scripts/sync-meetings-to-memory.mjs:269` (classifyMeeting), `scripts/sync-meetings-to-memory.mjs:386` (runMeetingsIntake — netzfrei testbarer Intake-Loop, graph/graphDetail injizierbar, Datei-Writes über io-Adapter mit echtem fs-Default), `scripts/sync-meetings-to-memory.mjs:463` (serverChangeStatus), `scripts/sync-meetings-to-memory.mjs:661` (runSyncCli-Einstieg), `scripts/sync-meetings-to-memory.mjs:744` (isDirectRun-Guard)
- [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:7` (resolveMeetingsRoot), `scripts/relocate-local-meeting.mjs:121` (relocateToProject — Reihenfolge: Pre-Check, beide Moves, dann Frontmatter-Write an Zielpfaden; Registry erst danach)
- [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs) — `scripts/_fireflies-meetings.mjs:11` (slugify), `scripts/_fireflies-meetings.mjs:522` (buildMeetingDestinationPaths), `scripts/_fireflies-meetings.mjs:544` (buildProjectRelocatePlan)

Relocate-Plan-Funktionen: `buildProjectRelocatePlan` leitet FROM-Pfade aus `meeting.summary_path`/`transcript_path` ab (funktioniert auch für Re-Relocate aus Projektbäumen) und entfernt bei Zielwechsel den bisherigen `project_slug` aus `project_slugs` (Membership = enthaltende Bäume, Orphan-Freiheit); `slugify` normalisiert Projekt-Slugs (Defense in Depth, Pfad-Escape unmöglich). Klassische `--to-slug`-Region bleibt byte-identisch zur Vor-Issue-#8-Revision. Tests: `tests/sync-project-smoke.mjs`.

## Connected to
[Meetings-Schema](meetings-schema.md), [Client](client.md), [Skill-Verhalten](skill-behavior.md). Prozesse: [meeting-sync](../processes/meeting-sync.md), [local-relocate](../processes/local-relocate.md).

## If you change this
- **Hits:** `meetings.json`-Verbraucher (meeting-desk, Agent-Workspaces), Fingerprint-Semantik, Klassifikationsfelder, SKILL.md-Sync-Regeln.
- **Does not hit:** Reine Lese-Skripte (get/list/channels/probe); Auth-Resolvierung.

## Surfaces
Schreibseite ist der aufrufende Workspace (`memory/evidence|references/meetings/` und mit `--project-slug`/`--to-project` zusätzlich `memory/evidence/projects/<slug>/meetings/`); gelesen werden Fireflies-API und lokale `meetings.json`.

## See
Datenmodell und Frontmatter: [references/data-model.md](../../../references/data-model.md). Sync-Regeln: [SKILL.md](../../../SKILL.md) Abschnitt „Lokaler Sync und Update-Erkennung“. [Änderungsrouting](../effects/CONTEXT.md).