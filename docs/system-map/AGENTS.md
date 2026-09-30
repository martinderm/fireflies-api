# fireflies-api — System-Map

ICM Form 6; Karte des Repository-Istzustands. Einstieg für Änderungen, keine zweite Spezifikation.

| Frage | Karte |
| :--- | :--- |
| Skill-Arbeitsregeln, Curating und Klassifikationsnachgelagerung | [Skill-Verhalten](objects/skill-behavior.md) |
| GraphQL-Client, Secrets-Resolvierung und Ausgabe-Envelope | [Client](objects/client.md) |
| GraphQL-Feldkataloge und Query-Builder | [Meetings-Schema](objects/meetings-schema.md) |
| CLI-Skripte und ihre Argumente | [CLI](objects/cli.md) |
| Lokaler Meeting-Sync und Update-Erkennung | [Sync](objects/sync.md) |
| Tatsächliche API-Flüsse | [Prozesse](processes/CONTEXT.md) |
| Tests | [Qualität](objects/quality.md) |
| Was trifft eine Änderung? | [Auswirkungen](effects/CONTEXT.md) |

Namensfallen: „Meeting“ und „Transcript“ bezeichnen dasselbe GraphQL-Objekt (`transcript`); Meeting-IDs sind Transcript-IDs. `sync-meetings-to-memory` schreibt nicht ins Ziel-Repository, sondern in den aufrufenden Agent-Workspace (`memory/evidence/meetings/` bzw. Fallback `memory/references/meetings/`).

Lade [CONTEXT.md](CONTEXT.md) und nur die zum Auftrag passende Karte. Neue Aufgaben: [GitHub Issues](https://github.com/martinderm/fireflies-api/issues). Metadatenregeln: [_meta/schema.md](_meta/schema.md).