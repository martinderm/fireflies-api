---
type: process
universe: live
status: verified
entity: scripts/_fireflies-client.mjs
verified_at: 2026-10-01
revision: 6ca11a640811f1bbc0cb4bab5f3f90424064eaba
consumes: [../objects/client.md]
produces: [../objects/cli.md, ../objects/sync.md]
---

# api-call

## Input → Movement → Output
Query/Variables plus optionaler Account → Workspace-/Secrets-Resolvierung und GraphQL-POST → JSON-Envelope `{ok,...}` auf stdout oder Fehler-Envelope auf stderr.

## Why this shape
Auth und Fehlersemantik an einem Ort; Skripte entscheiden nur über Feldauswahl und Ausgabeform.

## Steps
1. Resolviert Workspace-Root aus `WORKSPACE_ROOT`, logischem PWD, CWD-Ancestors und Skriptherkunft. Quelle: [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:73`.
2. Liest den ersten existierenden Secrets-Kandidaten (`.agents/secrets.json`, `secrets.json` pro Root, dann `~/.openclaw/secrets.json`) und resolviert den API-Key über Settings oder Accounts-Map. Quelle: [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:92`, `scripts/_fireflies-client.mjs:143`.
3. Sendet die Query als Bearer-POST und wirft `http_<status>` bzw. `graphql_error` mit angehängtem Body. Quelle: [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:159`.
4. CLI-Adapter drucken den Erfolgs-Envelope auf stdout oder den Fehler-Envelope auf stderr und setzen Exit-Codes (2 = Nutzung, 1 = API). Quelle: [scripts/get-meeting.mjs](../../../scripts/get-meeting.mjs) — `scripts/get-meeting.mjs:26`.

## If you change this
- **Hits:** Alle Skripte, Secrets-Regressionen, Ausgabe-Envelopes.
- **Does not hit:** Sync-Ordnerlogik und Klassifikationsfelder.

## Surfaces
Externer Endpoint `https://api.fireflies.ai/graphql`; stdout/stderr sind die lokal beobachtbare Oberfläche.

## See
[Client](../objects/client.md), [CLI](../objects/cli.md).