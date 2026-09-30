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
`tests/` existiert als Zielstruktur; zum Kartierungsstand (Revision `a73fc6b`) liegen noch keine Tests im Repository. Verifikation beschränkt sich auf das Ausführen der Skripte; die im Run geplanten Smoke-/Regressionstests (`node --test tests/`) werden mit den Tickets FFA-A-T1/T2 angelegt und diese Karte synchron nachgezogen. Netzfreie Tests sollen temporäre Verzeichnisse und gemockte Secrets-Dateien nutzen; Render-Logik wird als reine Funktion separiert und direkt getestet. Kein Linter/Prettier konfiguriert.

- Geplante Testdateien (mit Tickets FFA-A-T1/T2 anzulegen): `tests/client-registry-smoke.mjs`, `tests/cli-transcript-smoke.mjs` — zum Kartierungsstand nicht vorhanden.

## Connected to
[Client](client.md), [CLI](cli.md), [Meetings-Schema](meetings-schema.md).

## If you change this
- **Hits:** Verifikationskommandos in Runs, README-Test-Hinweise.
- **Does not hit:** Kuratierte Referenzen; Fireflies-Endpoint selbst.

## Surfaces
Verifikation ohne API-Key ist zum Kartierungsstand nicht verfügbar; geplante Testform ist `node --test tests/`.

## See
Verifikationsreihenfolge im Run: [Änderungsrouting](../effects/CONTEXT.md).