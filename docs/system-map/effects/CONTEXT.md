# Änderungsauswirkungen — Routing

Inputs: Änderungsauftrag. Nicht den gesamten Baum laden; die Karten tragen die Details.

| Änderung | Zuerst öffnen |
| :--- | :--- |
| Secrets-Resolvierung, Account-Auswahl | [Client](../objects/client.md), [Qualität](../objects/quality.md) |
| GraphQL-Felder, Query-Aufbau | [Meetings-Schema](../objects/meetings-schema.md) |
| CLI-Skript hinzufügen, Argumente, Ausgabeformat | [CLI](../objects/cli.md), [Qualität](../objects/quality.md) |
| Sync-Verhalten, meetings.json, Ordnerlogik | [Sync](../objects/sync.md), [Skill-Verhalten](../objects/skill-behavior.md) |
| Arbeitsregeln, Referenz-Kurating | [Skill-Verhalten](../objects/skill-behavior.md) |
| tests/ erweitern | [Qualität](../objects/quality.md) |

Process: Hits/Does not hit der Karten gegen den konkreten Diff prüfen; Scope und passende Tests ableiten. Skripte und SKILL.md/Katalogreferenzen im selben Arbeitsschritt synchron halten.
Outputs: Änderungsliste und synchron aktualisierte Karten. Offene Arbeit als GitHub Issue.
Human Check: SKILL.md, Skriptverhalten und System-Map widersprechen sich nicht; Quelllinks bleiben gültig.