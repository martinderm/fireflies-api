---
type: process
universe: live
status: verified
entity: scripts/sync-meetings-to-memory.mjs
verified_at: 2026-10-01
revision: 03fa8e73ec212263aa41accde6391b683d05f01b
consumes: [../objects/sync.md, ../objects/meetings-schema.md, ../objects/client.md]
produces: [../objects/skill-behavior.md]
---

# meeting-sync

## Input → Movement → Output
Sync-Aufruf (Modus, optionale Filter) → Listen-/Detail-Queries, Fingerprint-Vergleich, Markdown- und meetings.json-Pflege → gespiegelte Meetings im aufrufenden Agent-Workspace mit Review-Vormerkung.

## Why this shape
Der Sync ist Intake, nicht Klassifikator: er spiegelt, markiert und bereitet Review vor; die fachliche Zuordnung geschieht nachgelagert im aufrufenden Agenten.

## Steps
1. Wählt den Meetings-Root im aufrufenden Workspace (Dual Evidence mit Fallback) und liest `meetings.json`. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:10`.
2. Ermittelt Kandidaten je Modus (nur neue, einzelne `--meeting-id --mode all`, `--refresh-changed --mode all`) über Listen- und Detail-Queries mit Sentences. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:430`.
3. Berechnet einen Server-Fingerprint und leitet `server_change_status` ab; gelöste Reviews bleiben stabil, außer der Fingerprint ändert sich. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:245`, `scripts/sync-meetings-to-memory.mjs:518`.
4. Schreibt Summary- und Volltranskript-Markdown und aktualisiert `meetings.json` (Channel-Strategie, Mappings, Klassifikationsfelder, `review_input`). Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:597`, `scripts/sync-meetings-to-memory.mjs:667`.

## If you change this
- **Hits:** meetings.json-Verbraucher, Fingerprint-Semantik, SKILL.md-Sync-Regeln.
- **Does not hit:** Reine Lese-Skripte; Auth-Resolvierung.

## Surfaces
Schreibseite im aufrufenden Workspace; gelesen werden Fireflies-API und lokale `meetings.json`.

## See
[Sync](../objects/sync.md), [Skill-Verhalten](../objects/skill-behavior.md).