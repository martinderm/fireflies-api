---
type: process
universe: live
status: verified
entity: scripts/relocate-local-meeting.mjs
verified_at: 2026-10-01
revision: 1bd06b63435a9dc3a50555e509d5853bd4667781
consumes: [../objects/sync.md]
produces: [../objects/sync.md]
---

# local-relocate

## Input → Movement → Output
Bereits gespiegeltes Meeting (meeting-id oder slug) plus Ziel-Slug/Topic → lokale Umsortierung → verschobene Dateien mit nachgezogenem Frontmatter und meetings.json-Einträgen.

## Why this shape
Verschiebungen sind reine lokale Nachpflege ohne API-Aufruf; meetings.json bleibt kanonische Pfadquelle.

## Steps
1. Löst den Meetings-Root im aufrufenden Workspace auf und liest `meetings.json`. Quelle: [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:7`.
2. Verschiebt Ordner/Dateien und zieht Frontmatter (`summary_path`, `transcript_path`) sowie den meetings.json-Eintrag nach. Quelle: [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:86`.

## If you change this
- **Hits:** Pfadkonsistenz zwischen meetings.json und Dateisystem; relocate-Regressionen.
- **Does not hit:** API-Skripte; Auth-Resolvierung.

## Surfaces
Ausschließlich lokale Dateien im aufrufenden Workspace.

## See
[Sync](../objects/sync.md).