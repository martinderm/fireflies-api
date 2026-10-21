# Änderungsauswirkungen — Routing

Inputs: Änderungsauftrag. Nicht den gesamten Baum laden; die Karten tragen die Details.

| Änderung | Zuerst öffnen |
| :--- | :--- |
| Secrets-Resolvierung, Account-Auswahl | [Client](../objects/client.md), [Qualität](../objects/quality.md) |
| GraphQL-Felder, Query-Aufbau | [Meetings-Schema](../objects/meetings-schema.md) |
| CLI-Skript hinzufügen, Argumente, Ausgabeformat | [CLI](../objects/cli.md), [Qualität](../objects/quality.md) |
| Record-Felder, Zeit-/Dauer-/Raw-Mapping | [Record](../objects/record.md), [Qualität](../objects/quality.md) |
| Writer-Aufruf, Envelope/Exit/Timeout, Capabilities | [Writer](../objects/writer.md), [Sync](../objects/sync.md), [Qualität](../objects/quality.md) |
| Sync-Verhalten, read-only meetings.json, Routing | [Sync](../objects/sync.md), [Skill-Verhalten](../objects/skill-behavior.md) |
| Ad-hoc-Dateiexport, Lease-/Zonen-Gate | [CLI](../objects/cli.md), [Qualität](../objects/quality.md) |
| Arbeitsregeln, Referenz-Kurating | [Skill-Verhalten](../objects/skill-behavior.md) |
| tests/ erweitern | [Qualität](../objects/quality.md) |

Process: Hits/Does not hit der Karten gegen den konkreten Diff prüfen; Scope und passende Tests ableiten. Skripte und SKILL.md/Katalogreferenzen im selben Arbeitsschritt synchron halten.
Outputs: Änderungsliste und synchron aktualisierte Karten. Offene Arbeit als GitHub Issue.
Human Check: SKILL.md, Skriptverhalten und System-Map widersprechen sich nicht; Quelllinks bleiben gültig.