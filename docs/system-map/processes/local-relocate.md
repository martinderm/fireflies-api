---
type: process
universe: live
status: verified
entity: scripts/relocate-local-meeting.mjs
verified_at: 2026-10-01
revision: 6ca11a640811f1bbc0cb4bab5f3f90424064eaba
consumes: [../objects/sync.md]
produces: [../objects/sync.md]
---

# local-relocate

## Input → Movement → Output
Bereits gespiegeltes Meeting (`--meeting-id`) plus Ziel (klassisch `--from-slug/--to-slug/--to-title/--topic-slug/--resolved-at`, oder projekt-scoped `--to-project <slug>`) → lokale Umsortierung → verschobene Dateien mit nachgezogenem Frontmatter und meetings.json-Einträgen.

## Why this shape
Verschiebungen sind reine lokale Nachpflege ohne API-Aufruf; meetings.json bleibt kanonische Pfadquelle. Projekt-Relocation ändert nur die physische Ablage und Membership (`project_slugs` = enthaltende Bäume), keine Klassifikation (`llm_review_status` bleibt).

## Steps
1. Löst den Meetings-Root im aufrufenden Workspace auf und liest `meetings.json`. Quelle: [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:7`.
2. Klassischer Pfad: Verschiebt Ordner/Dateien per Replace-Muster und zieht Frontmatter (`summary_path`, `transcript_path`) sowie den meetings.json-Eintrag nach (Klassifikation → `mapped`/`resolved`). Quelle: [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:196`.
3. Projekt-Pfad (`--to-project`): leitet aus dem Eintrag die from-/to-Pfade (`buildProjectRelocatePlan`, slugified, Orphan-frei), prüft Ziel-Kollisionen fail-loud (`target_file_exists`), verschiebt, setzt `project_slug`/`project_slugs`/`project_scoped` und lässt `llm_review_status` unverändert. Härtung (#12): gleichzeitige klassische Flags werfen `mutually_exclusive_flags:project_and_channel_relocation` (exit 2); leere/zu `ohne-channel` normalisierende Projekt-Slugs werfen `empty_project_slug` (exit 2). Quelle: [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:121`, [scripts/_fireflies-meetings.mjs](../../../scripts/_fireflies-meetings.mjs) — `scripts/_fireflies-meetings.mjs:544`.

## If you change this
- **Hits:** Pfadkonsistenz zwischen meetings.json und Dateisystem; relocate-Regressionen (`tests/sync-project-smoke.mjs`).
- **Does not hit:** API-Skripte; Auth-Resolvierung.

## Surfaces
Ausschließlich lokale Dateien im aufrufenden Workspace (Pool- und Projektbäume).

## See
[Sync](../objects/sync.md).