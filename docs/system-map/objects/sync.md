---
type: object
cluster: orchestrator
universe: live
status: verified
entity: scripts/sync-meetings-to-memory.mjs
verified_at: 2026-10-01
revision: 3a974a362c24202ad44dc2cf3051928553521bce
---

# Sync

Lokaler Meeting-Sync in den aufrufenden Agent-Workspace mit knappen Kanälen, Fingerprinting und Review-Vormerkung.

## Why this shape
Intake und fachliche Klassifikation sind getrennt: der Sync spiegelt und markiert, die Zuordnung entscheidet der aufrufende Agent im Chat.

## Shape
`resolveMeetingsRoot` wählt `memory/evidence/meetings` (Dual Evidence, Fallback auf `memory/references/meetings` in Altsystemen) oder einen Settings-Pfad (`fireflies-api.meetingsRoot`); Ziel ist immer der Workspace außerhalb dieses Repos. Pro Meeting werden Summary- und Volltranskript-Markdown geschrieben (`YYYY-MM-DD-<slug>.summary.md` / `.transcript.md`; der Transcript-Body nutzt den gemeinsamen `renderTranscriptMarkdown`-Kern mit `bracketed: false`), `meetings.json` gepflegt (`channel_strategy` im knappen-Channel-Modell, `channel_mappings` pro Channel mit `routing_mode`) und ein `server_fingerprint` (SHA-256 über Metadaten, Summary und Sentences) statt eines erfundenen `updated_at` gespeichert; daraus leitet sich `server_change_status` (`new`, `unknown`, `changed`, `unchanged`) ab. Klassifikationsfelder bleiben bei Intake ungelöst (`classification_status: unmapped`, `review_recommended: true`) und `review_input` wird für den Chat-Review geschrieben; bereits gelöste Reviews (`llm_review_status: resolved`/`user-query`) bleiben stabil, außer der Server-Fingerprint ändert sich. Ein Cloud-Titel-Mutation-Suffix `(syncd)` existiert als Query, wird im Standardlauf aber nicht geschrieben (`cloud_title_error: skipped-no-write`). Modi: Standardlauf (nur neue), `--meeting-id <id> --mode all` (einzeln), `--refresh-changed --mode all` (bekannte erneut prüfen), optionaler Channel-Filter via `--context-channel-slug`/`--context-channel-title`.

- [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) — `scripts/sync-meetings-to-memory.mjs:10` (resolveMeetingsRoot), `scripts/sync-meetings-to-memory.mjs:245` (computeMeetingFingerprint), `scripts/sync-meetings-to-memory.mjs:269` (classifyMeeting), `scripts/sync-meetings-to-memory.mjs:371` (buildTranscriptMarkdown via renderTranscriptMarkdown), `scripts/sync-meetings-to-memory.mjs:418` (Args/Main), `scripts/sync-meetings-to-memory.mjs:518` (serverChangeStatus)
- [scripts/relocate-local-meeting.mjs](../../../scripts/relocate-local-meeting.mjs) — `scripts/relocate-local-meeting.mjs:7` (resolveMeetingsRoot)

## Connected to
[Meetings-Schema](meetings-schema.md), [Client](client.md), [Skill-Verhalten](skill-behavior.md). Prozesse: [meeting-sync](../processes/meeting-sync.md), [local-relocate](../processes/local-relocate.md).

## If you change this
- **Hits:** `meetings.json`-Verbraucher (meeting-desk, Agent-Workspaces), Fingerprint-Semantik, Klassifikationsfelder, SKILL.md-Sync-Regeln.
- **Does not hit:** Reine Lese-Skripte (get/list/channels/probe); Auth-Resolvierung.

## Surfaces
Schreibseite ist ausschließlich der aufrufende Workspace (`memory/evidence|references/meetings/`); gelesen werden Fireflies-API und lokale `meetings.json`.

## See
Datenmodell und Frontmatter: [references/data-model.md](../../../references/data-model.md). Sync-Regeln: [SKILL.md](../../../SKILL.md) Abschnitt „Lokaler Sync und Update-Erkennung“. [Änderungsrouting](../effects/CONTEXT.md).