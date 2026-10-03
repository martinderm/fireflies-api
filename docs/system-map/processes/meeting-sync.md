---
type: process
universe: live
status: verified
entity: scripts/sync-meetings-to-memory.mjs
verified_at: 2026-10-03
revision: 3b90b8f8ae06a0e6d99ea69d68fc4982db4edf31
consumes: [../objects/sync.md, ../objects/meetings-schema.md, ../objects/client.md]
produces: [../objects/skill-behavior.md]
---

# meeting-sync

## Input → Movement → Output
Sync-Aufruf (Modus, optionale Filter, optional `--project-slug`) → Listen-/Detail-Queries, Zielableitung (`buildMeetingDestinationPaths`: Pool- oder Projektbaum), Fingerprint-Vergleich, Markdown- und meetings.json-Pflege → gespiegelte Meetings im aufrufenden Agent-Workspace mit Review-Vormerkung.

## Why this shape
Der Sync ist Intake, nicht Klassifikator: er spiegelt, markiert und bereitet Review vor; die fachliche Zuordnung geschieht nachgelagert im aufrufenden Agenten. `--project-slug` ist eine Nutzer-Vormerkung (`project_scoped`), keine Klassifikation.

## Steps
1. Wählt den Meetings-Root im aufrufenden Workspace (Dual Evidence mit Fallback) und liest `meetings.json`. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:10`.
2. Ermittelt Kandidaten je Modus (nur neue, einzelne `--meeting-id --mode all`, `--refresh-changed --mode all`) über Listen- und Detail-Queries mit Sentences. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:430`.
3. Leitet die Zielordner ab: ohne `--project-slug` der generelle Pool (`<meetingsRoot>/<channelSlug|ohne-channel>`), mit `--project-slug` `memory/evidence/projects/<slug>/meetings/<channelSlug|ohne-channel>`; `meetings.json` bleibt am Meetings-Root. Quelle: [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs) — `scripts/_fireflies-meetings.mjs:522`.
4. Berechnet einen Server-Fingerprint und leitet `server_change_status` ab; gelöste Reviews bleiben stabil, außer der Fingerprint ändert sich. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:245`, `scripts/sync-meetings-to-memory.mjs:518`.
5. Schreibt Summary- und Volltranskript-Markdown und aktualisiert `meetings.json` (Channel-Strategie, Mappings, Klassifikationsfelder, `review_input` mit projekt-Vormerkung). Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:597`, `scripts/sync-meetings-to-memory.mjs:667`.

## If you change this
- **Hits:** meetings.json-Verbraucher, Fingerprint-Semantik, SKILL.md-Sync-Regeln, Projekt-Layout (Projektbaum `projects/<slug>/meetings/`).
- **Does not hit:** Reine Lese-Skripte; Auth-Resolvierung.

## Surfaces
Schreibseite im aufrufenden Workspace (`memory/evidence|references/meetings/` und optional `memory/evidence/projects/<slug>/meetings/`); gelesen werden Fireflies-API und lokale `meetings.json`.

## See
[Sync](../objects/sync.md), [Skill-Verhalten](../objects/skill-behavior.md).