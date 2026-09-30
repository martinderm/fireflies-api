---
type: object
cluster: quality
universe: live
status: verified
entity: tests/
verified_at: 2026-09-30
revision: a73fc6b6e937a718510e173e41d379465f5d5993
---

# Qualität

Regressionen laufen über `node --test` mit importierbaren Hilfsfunktionen; kein Build-Schritt, keine externen Test-Dependencies.

## Why this shape
Der Skill ist reines Node (ESM); der eingebaute Test-Runner hält die Toolchain bei null Dependencies.

## Shape
`tests/` enthält Smoke-/Regressionstests (node:test + assert/strict, keine Dependencies), ausgeführt mit `node --test "tests/**/*.mjs"` (Node v24: Positional-Args sind Globs, ein Verzeichnis-Argument wird nicht discovered). Netzfreie Tests nutzen temporäre Verzeichnisse (`mkdtempSync`) und injizierte Kandidatenpfade statt Homedir-Manipulation; Secrets-Regressionen pinnen Fallback-Scan, Priorität und Fehlersemantik (`missing_secrets_file`, invalid-JSON-Throw). Kein Linter/Prettier konfiguriert.

- [tests/client-registry-smoke.mjs](../../../tests/client-registry-smoke.mjs) — `tests/client-registry-smoke.mjs:57`

## Connected to
[Client](client.md), [CLI](cli.md), [Meetings-Schema](meetings-schema.md).

## If you change this
- **Hits:** Verifikationskommandos in Runs, README-Test-Hinweise.
- **Does not hit:** Kuratierte Referenzen; Fireflies-Endpoint selbst.

## Surfaces
`node --test "tests/**/*.mjs"` ist der lokale Verifikationsbefehl ohne API-Key.

## See
Verifikationsreihenfolge im Run: [Änderungsrouting](../effects/CONTEXT.md).