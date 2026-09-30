---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_fireflies-client.mjs
verified_at: 2026-09-30
revision: a73fc6b6e937a718510e173e41d379465f5d5993
---

# Client

Gemeinsamer GraphQL-Client, Workspace-/Secrets-Resolvierung und Ausgabe-Envelope für alle Skripte.

## Why this shape
Auth, Endpoint und Fehlerausgabe an einer Stelle; CLI-Skripte bleiben dünne Adapter.

## Shape
Alle Fireflies-Requests laufen über `firefliesGraphQL` (POST an `https://api.fireflies.ai/graphql`, Bearer-API-Key). Der Key wird über `loadApiKey` ermittelt: Account-Referenz aus CLI-Argument, `settings.json` (`fireflies-api.account` bzw. `fireflies.account`) oder erstem Eintrag in `integrations.fireflies.accounts`. `loadSecretsJson` iteriert Kandidatenpfade in fester Reihenfolge — `.agents/secrets.json` und `secrets.json` pro erkanntem Workspace-Root, zuletzt `~/.openclaw/secrets.json` — und nutzt die erste existierende Datei. `missing_account_ref`/`missing_api_key:<account>` werden als Fehler geworfen, nicht still übersprungen. Workspace-Erkennung (`resolveWorkspaceRoot`) nutzt `WORKSPACE_ROOT`, logisches PWD, CWD-Ancestors und Skriptherkunft; ein Kandidat gilt als Root, wenn `settings.json`, `AGENTS.md`, `.agents` oder `secrets.json` direkt darin liegt. Bei HTTP-Fehlern (`http_<status>`) und GraphQL-Errors (`graphql_error`) hängt der Fehler-Body am Error-Objekt; `printError` gibt einen JSON-Envelope `{ok:false,error,status,body}` auf stderr, `printJson` den Erfolgs-Envelope auf stdout.

- [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:92` (loadSecretsJson), `scripts/_fireflies-client.mjs:123` (resolveAccount), `scripts/_fireflies-client.mjs:143` (loadApiKey), `scripts/_fireflies-client.mjs:159` (firefliesGraphQL), `scripts/_fireflies-client.mjs:73` (resolveWorkspaceRoot)

## Connected to
[CLI](cli.md), [Meetings-Schema](meetings-schema.md), [Qualität](quality.md). Prozesse: [api-call](../processes/api-call.md).

## If you change this
- **Hits:** Alle Skripte unter `scripts/`, Secrets-Regressionen in `tests/`, Dokumentation der Secret-Konvention in README/SKILL.md.
- **Does not hit:** Der lokaler Syncs Ordner-/Klassifikationslogik; kuratierte `references/`-Inhalte.

## Surfaces
Der Endpoint ist extern (Fireflies); alle Skripte importieren die Exporte dieses Moduls; Settings und Secrets stehen in Workspace-Konfigurationsdateien außerhalb des Repos.

## See
Secret-Pfade und deren Reihenfolge: `candidateSecretsPaths` in [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:80`. [Änderungsrouting](../effects/CONTEXT.md).