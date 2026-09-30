---
type: object
cluster: quality
universe: live
status: verified
entity: tests/
verified_at: 2026-09-30
revision: dc0d4c2010031b1aeb9b57cd302f741da0122675
---

# Qualität

Regressionen laufen über `node --test` mit importierbaren Hilfsfunktionen; kein Build-Schritt, keine externen Test-Dependencies.

## Why this shape
Der Skill ist reines Node (ESM); der eingebaute Test-Runner hält die Toolchain bei null Dependencies.

## Shape
`tests/` enthält Smoke-/Regressionstests (node:test + assert/strict, keine Dependencies), ausgeführt mit `node --test "tests/**/*.mjs"` (Node v24: Positional-Args sind Globs, ein Verzeichnis-Argument wird nicht discovered). Netzfreie Tests nutzen temporäre Verzeichnisse (`mkdtempSync`) und injizierte Kandidatenpfade statt Homedir-Manipulation. Secrets-Regressionen (`client-registry-smoke`) pinnen Fallback-Scan, Priorität und Fehlersemantik (`missing_secrets_file`, invalid-JSON-Throw). CLI-/Transcript-Regressionen (`cli-transcript-smoke`) pinnen Markdown-Render (bracketed vs. sync-Format, Speaker- und raw_text-Fallback, Platzhalter), sentences-only-Katalog, Flag-Wert-Absicherung (`missing value for <flag>`) und Argumentvalidierung; die Byte-Identität des Sync-Renderpfads ist per Test gepinnt. Kein Linter/Prettier konfiguriert.

- [tests/client-registry-smoke.mjs](../../../tests/client-registry-smoke.mjs) — `tests/client-registry-smoke.mjs:57`
- [tests/cli-transcript-smoke.mjs](../../../tests/cli-transcript-smoke.mjs) — `tests/cli-transcript-smoke.mjs:29`

## Connected to
[Client](client.md), [CLI](cli.md), [Meetings-Schema](meetings-schema.md).

## If you change this
- **Hits:** Verifikationskommandos in Runs, README-Test-Hinweise.
- **Does not hit:** Kuratierte Referenzen; Fireflies-Endpoint selbst.

## Surfaces
`node --test "tests/**/*.mjs"` ist der lokale Verifikationsbefehl ohne API-Key.

## See
Verifikationsreihenfolge im Run: [Änderungsrouting](../effects/CONTEXT.md).