---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_fireflies-client.mjs
verified_at: 2026-09-30
revision: dc0d4c2010031b1aeb9b57cd302f741da0122675
---

# Client

Gemeinsamer GraphQL-Client, Workspace-/Secrets-Resolvierung und Ausgabe-Envelope für alle Skripte.

## Why this shape
Auth, Endpoint und Fehlerausgabe an einer Stelle; CLI-Skripte bleiben dünne Adapter.

## Shape
Alle Fireflies-Requests laufen über `firefliesGraphQL` (POST an `https://api.fireflies.ai/graphql`, Bearer-API-Key). Der Key wird über `loadApiKey` ermittelt: Account-Referenz aus CLI-Argument, `settings.json` (`fireflies-api.account` bzw. `fireflies.account`) oder erstem Eintrag in `integrations.fireflies.accounts`. `loadSecretsJson` iteriert Kandidatenpfade in fester Reihenfolge — `.agents/secrets.json` und `secrets.json` pro erkanntem Workspace-Root, zuletzt `~/.openclaw/secrets.json` — und wählt den ersten Kandidaten, dessen Dokument Fireflies-Credentials (`integrations.fireflies.accounts` mit mindestens einem Eintrag) enthält; existierende Kandidaten ohne Fireflies-Anteil werden übersprungen. Enthält kein existierender Kandidat Fireflies-Credentials, wird das ersten existierenden Dokuments geliefert, sodass `loadApiKey` weiterhin `missing_account_ref` wirft. Bei einem Fireflies-Match wird das Scannen beendet — späterer, ungültiger JSON-Inhalt in Restkandidaten wird dann nicht gelesen. Ohne Match bleibt der Scan vollständig; `missing_secrets_file:<tried>` listet alle Kandidaten. Export: `loadSecretsJson(candidatePaths)` erlaubt Kandidaten-Injektion (Default bleibt der Standard-Scan). Workspace-Erkennung (`resolveWorkspaceRoot`) nutzt `WORKSPACE_ROOT`, logisches PWD, CWD-Ancestors und Skriptherkunft; ein Kandidat gilt als Root, wenn `settings.json`, `AGENTS.md`, `.agents` oder `secrets.json` direkt darin liegt. Bei HTTP-Fehlern (`http_<status>`) und GraphQL-Errors (`graphql_error`) hängt der Fehler-Body am Error-Objekt; `printError` gibt einen JSON-Envelope `{ok:false,error,status,body}` auf stderr, `printJson` den Erfolgs-Envelope auf stdout.

- [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:92` (hasFirefliesCredentials), `scripts/_fireflies-client.mjs:97` (loadSecretsJson), `scripts/_fireflies-client.mjs:143` (resolveAccount), `scripts/_fireflies-client.mjs:163` (loadApiKey), `scripts/_fireflies-client.mjs:179` (firefliesGraphQL), `scripts/_fireflies-client.mjs:73` (resolveWorkspaceRoot)

## Connected to
[CLI](cli.md), [Meetings-Schema](meetings-schema.md), [Qualität](quality.md). Prozesse: [api-call](../processes/api-call.md).

## If you change this
- **Hits:** Alle Skripte unter `scripts/`, Secrets-Regressionen in `tests/` (client-registry-smoke), Dokumentation der Secret-Konvention in README/SKILL.md.
- **Does not hit:** Der lokaler Syncs Ordner-/Klassifikationslogik; kuratierte `references/`-Inhalte.

## Surfaces
Der Endpoint ist extern (Fireflies); alle Skripte importieren die Exporte dieses Moduls; Settings und Secrets stehen in Workspace-Konfigurationsdateien außerhalb des Repos.

## See
Secret-Pfade und deren Reihenfolge: `candidateSecretsPaths` in [scripts/_fireflies-client.mjs](../../../scripts/_fireflies-client.mjs) — `scripts/_fireflies-client.mjs:80`. Secret-Regressionen: [tests/client-registry-smoke.mjs](../../../tests/client-registry-smoke.mjs). [Änderungsrouting](../effects/CONTEXT.md).