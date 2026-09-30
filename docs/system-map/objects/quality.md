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
`tests/` enthält Smoke-/Regressionstests gegen exportierte Funktionen (Resolvierung, Query-Aufbau, Render-Helper) und CLI-Argumentverhalten, ausgeführt mit `node --test tests/`. Netzfreie Tests nutzen temporäre Verzeichnisse und gemockte Secrets-Dateien; die Render-Logik des Volltranskripts (Clock-Prefix, Speaker-Fallback, raw_text-Fallback) ist als reine Funktion separiert und direkt getestet. Kein Linter/Prettier konfiguriert.

- [tests/client-registry-smoke.mjs](../../../tests/client-registry-smoke.mjs) — `tests/client-registry-smoke.mjs:1`
- [tests/cli-transcript-smoke.mjs](../../../tests/cli-transcript-smoke.mjs) — `tests/cli-transcript-smoke.mjs:1`

## Connected to
[Client](client.md), [CLI](cli.md), [Meetings-Schema](meetings-schema.md).

## If you change this
- **Hits:** Verifikationskommandos in Runs, README-Test-Hinweise.
- **Does not hit:** Kuratierte Referenzen; Fireflies-Endpoint selbst.

## Surfaces
`node --test tests/` ist der lokale Verifikationsbefehl ohne API-Key.

## See
Verifikationsreihenfolge im Run: [Änderungsrouting](../effects/CONTEXT.md).