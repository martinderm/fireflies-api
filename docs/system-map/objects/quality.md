---
type: object
cluster: quality
universe: live
status: verified
entity: tests/
verified_at: 2026-10-29
revision: fa31dbd+ff15-working-tree
---

# Qualität

Regressionen laufen über `node --test` mit importierbaren Hilfsfunktionen; kein Build-Schritt, keine externen Test-Dependencies.

## Why this shape
Der Skill ist reines Node (ESM); der eingebaute Test-Runner hält die Toolchain bei null Dependencies. Der Writer-Transport wird über echte Kindprozesse mit einem synthetischen Fake-Writer geprüft, nicht über einen Mock des halben Prozessmodells.

## Shape
`tests/` enthält Smoke-/Regressionstests (`node:test` + `assert/strict`, keine Dependencies), ausgeführt mit `node --test "tests/**/*.mjs"`. Netzfreie Tests nutzen temporäre Verzeichnisse (`mkdtempSync`, Aufräumen per `t.after` + `rmSync`) und injizierte Kandidatenpfade statt Homedir-Manipulation.

Abgedeckte Verträge:

- `client-registry-smoke`: Secrets-Fallback-Scan, Priorität, Fehlersemantik.
- `cli-transcript-smoke`: Markdown-Render, Speaker-Map, CLI-Frontmatter, Modus-Kaskade, Usage-Exits, Record-Export-Ablehnungen vor API.
- `probe-query-smoke`: Query-Komposition und `null`-Capabilities.
- `path-helpers-smoke`: `relativeWorkspacePath`.
- `meeting-record-smoke`: exakte `meeting-record/1`-Rootfelder, Zeit-/Dauer-Mapping samt roher Duration-Provenienz, rohe vs. gerenderte Transkripte, opake ID-Erhaltung, ehrliche Data-Completeness, `source_metadata`, Validator-Grenzen.
- `writer-transport-smoke`: Capabilities, stdin-Byte-/Größeninhalt, Argumente ohne Shell, `ingest_meeting`-Action, Plain-Object-`paths`, malformed/contradictory Envelopes und andere Nonzero-Exits als `outcome_unknown`, Exit 2/3, Timeout.
- `sync-intake-smoke`: Record-Delegation, read-only Register/Fingerprint, unmapped Intake, Teilfehler, Recovery-Stopp, Identitäts-/Account-Ambiguität, keine FS-Mutation durch den Sync selbst.
- `sync-project-smoke`: Argument-/Routingregeln, fehlendes Projekt ist gültig, explizit leere Werte scheitern, beschädigtes Array-Register, Capabilities vor API, Account-Preflight ohne API/Writer, öffentlicher `runSync`-Einstieg.
- `sync-direct-run-smoke`: Direktlauf über normalen Pfad und Junction liefert denselben Usage-Exit 2 samt Fehler-Envelope; Modul-Import über beide Pfade schreibt nichts und setzt keinen Exit-Code; `isDirectRun` bleibt für den Test-Runner und für fehlende Entry-Pfade `false`.
- `get-meeting-export-smoke`: Zone-/Endungs-/Lease-Gates, no-clobber, valider Record, echte kanonische Guard-Szenarien (missing/foreign/expired), Lease-Freigabe/-Ersatz nach Fetch oder Staging mit null Export/keinem Temp-Rest.
- `record-conformance-fixture`: separates Fixture-Gate mit gepinntem Manifest-Digest, Quell-Datei-SHA-256, Schema/Version und 11/19/5-Zählung; Python-Kanonisierung, kein Skip und keine Invalid-Ausnahmegruppe.
- `cross-repo-conformance`: erforderliche Cross-Repo-Prüfung über den echten OI-`verify_meeting_fixtures.py`; fehlt der Helper, schlägt der Test fehl statt zu skippen.

Ein Linter/Prettier ist nicht konfiguriert.

- [tests/meeting-record-smoke.mjs](../../../tests/meeting-record-smoke.mjs) - `tests/meeting-record-smoke.mjs:1`
- [tests/writer-transport-smoke.mjs](../../../tests/writer-transport-smoke.mjs) - `tests/writer-transport-smoke.mjs:1`
- [tests/sync-intake-smoke.mjs](../../../tests/sync-intake-smoke.mjs) - `tests/sync-intake-smoke.mjs:1`
- [tests/sync-project-smoke.mjs](../../../tests/sync-project-smoke.mjs) - `tests/sync-project-smoke.mjs:1`
- [tests/sync-direct-run-smoke.mjs](../../../tests/sync-direct-run-smoke.mjs) - `tests/sync-direct-run-smoke.mjs:1`
- [tests/get-meeting-export-smoke.mjs](../../../tests/get-meeting-export-smoke.mjs) - `tests/get-meeting-export-smoke.mjs:1`
- [tests/record-conformance-fixture.mjs](../../../tests/record-conformance-fixture.mjs) - `tests/record-conformance-fixture.mjs:1`
- [tests/cross-repo-conformance.mjs](../../../tests/cross-repo-conformance.mjs) - `tests/cross-repo-conformance.mjs:1`
- [tests/helpers/canonical-installations.mjs](../../../tests/helpers/canonical-installations.mjs) - `tests/helpers/canonical-installations.mjs:1`
- [tests/cli-transcript-smoke.mjs](../../../tests/cli-transcript-smoke.mjs) - `tests/cli-transcript-smoke.mjs:1`
- [tests/client-registry-smoke.mjs](../../../tests/client-registry-smoke.mjs) - `tests/client-registry-smoke.mjs:1`
- [tests/probe-query-smoke.mjs](../../../tests/probe-query-smoke.mjs) - `tests/probe-query-smoke.mjs:1`
- [tests/path-helpers-smoke.mjs](../../../tests/path-helpers-smoke.mjs) - `tests/path-helpers-smoke.mjs:1`

## Connected to
[Client](client.md), [CLI](cli.md), [Record](record.md), [Writer](writer.md), [Sync](sync.md), [Meetings-Schema](meetings-schema.md).

## If you change this
- **Hits:** Verifikationskommandos in Runs, README-Test-Hinweise.
- **Does not hit:** Kuratierte Referenzen; Fireflies-Endpoint selbst.

## Surfaces
`node --test "tests/**/*.mjs"` ist der lokale Verifikationsbefehl ohne API-Key; aktuell 174 Tests, davon 168 grün. Die 6 umgebungsgebundenen Tests (`cross-repo-conformance`, Lease-Guard/Export-Publication) benötigen die externen OI-meeting-desk- und workspace-lock-Checkouts (`OI_MEETING_DESK_ROOT`, `WORKSPACE_LOCK_ROOT`). Die gemeinsame OI-Fixture ist vendort; fehlt sie oder der kanonische Guard/OI-Verifier, schlagen die betroffenen Tests fehl statt zu skippen.

## See
[Record-Vertrag](../../../references/meeting-record-v1.md). [Änderungsrouting](../effects/CONTEXT.md).
