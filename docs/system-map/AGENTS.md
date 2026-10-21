# fireflies-api — System-Map

ICM Form 6; Karte des Repository-Istzustands. Einstieg für Änderungen, keine zweite Spezifikation.

| Frage | Karte |
| :--- | :--- |
| Skill-Arbeitsregeln, Curating und Klassifikationsnachgelagerung | [Skill-Verhalten](objects/skill-behavior.md) |
| GraphQL-Client, Secrets-Resolvierung und Ausgabe-Envelope | [Client](objects/client.md) |
| GraphQL-Feldkataloge und Query-Builder | [Meetings-Schema](objects/meetings-schema.md) |
| API-zu-`meeting-record/1`-Transformation | [Record](objects/record.md) |
| Kanonischer Writer-Aufruf, Capabilities, Envelope/Exit | [Writer](objects/writer.md) |
| CLI-Skripte und ihre Argumente | [CLI](objects/cli.md) |
| Read-only Sync, Register-Aliase und Routing | [Sync](objects/sync.md) |
| Tatsächliche API-Flüsse | [Prozesse](processes/CONTEXT.md) |
| Tests | [Qualität](objects/quality.md) |
| Was trifft eine Änderung? | [Auswirkungen](effects/CONTEXT.md) |

Namensfallen: „Meeting“ und „Transcript“ bezeichnen dasselbe GraphQL-Objekt (`transcript`); Meeting-IDs sind Transcript-IDs. Der Adapter transformiert API-Payloads in `meeting-record/1` und schreibt **weder** Meeting-Dateien **noch** `meetings.json`; Register, Frontmatter, Pfade und Review-/Content-Zustand gehören dem meeting-desk-Writer. `get-meeting.mjs` schreibt Dateien nur als `.meeting-export.json` unter `<workspace>/data/`.

Lade [CONTEXT.md](CONTEXT.md) und nur die zum Auftrag passende Karte. Neue Aufgaben: [GitHub Issues](https://github.com/martinderm/fireflies-api/issues). Metadatenregeln: [_meta/schema.md](_meta/schema.md).
