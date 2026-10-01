---
type: object
cluster: quality
universe: live
status: verified
entity: tests/
verified_at: 2026-10-01
revision: 2ae1f0d668dc1eaebab409853e95e23b26cbe02c
---

# Qualität

Regressionen laufen über `node --test` mit importierbaren Hilfsfunktionen; kein Build-Schritt, keine externen Test-Dependencies.

## Why this shape
Der Skill ist reines Node (ESM); der eingebaute Test-Runner hält die Toolchain bei null Dependencies.

## Shape
`tests/` enthält Smoke-/Regressionstests (node:test + assert/strict, keine Dependencies), ausgeführt mit `node --test "tests/**/*.mjs"` (Node v24: Positional-Args sind Globs, ein Verzeichnis-Argument wird nicht discovered). Netzfreie Tests nutzen temporäre Verzeichnisse (`mkdtempSync`, Aufräumen per `t.after` + `rmSync`) und injizierte Kandidatenpfade statt Homedir-Manipulation. Secrets-Regressionen (`client-registry-smoke`) pinnen Fallback-Scan, Priorität und Fehlersemantik (`missing_secrets_file`, invalid-JSON-Throw). CLI-/Transcript-Regressionen (`cli-transcript-smoke`) pinnen Markdown-Render (bracketed vs. sync-Format, Speaker- und raw_text-Fallback, Platzhalter), sentences-only-Katalog, Auto-Default-Resolvierung (markdown ohne explizites `--mode` → sentences-only, explizites `--mode` gewinnt), CLI-Frontmatter (`buildCliFrontmatter`, Delimiter, null-Bewahrung, `frontmatter_requires_markdown_format`, full-Kaskade), Speaker-Mapping (`parseSpeakerMap` KV/JSON, id-Vorrang, Original-Fallback, Fail-loud-Codes), yaml-Helfer-Konventionen aus [scripts/_yaml-helpers.mjs](../../../scripts/_yaml-helpers.mjs), Fail-loud-Absicherungen (`missing value for <flag>`, `unexpected_positional_argument`) und echte Exit-Code-Semantik per `spawnSync` (usage exit 2, netzfrei); die Byte-Identität des Sync-Renderpfads ist per Test gepinnt. Probe-Regressionen (`probe-query-smoke`) pinnen Query-Komposition (Standard ohne paid-Felder, Opt-in-Varianten) und Capabilities-Kennzeichnung (null statt false bei nicht abgefragt). Kein Linter/Prettier konfiguriert.

- [tests/client-registry-smoke.mjs](../../../tests/client-registry-smoke.mjs) — `tests/client-registry-smoke.mjs:57`
- [tests/cli-transcript-smoke.mjs](../../../tests/cli-transcript-smoke.mjs) — `tests/cli-transcript-smoke.mjs:31`

## Connected to
[Client](client.md), [CLI](cli.md), [Meetings-Schema](meetings-schema.md).

## If you change this
- **Hits:** Verifikationskommandos in Runs, README-Test-Hinweise.
- **Does not hit:** Kuratierte Referenzen; Fireflies-Endpoint selbst.

## Surfaces
`node --test "tests/**/*.mjs"` ist der lokale Verifikationsbefehl ohne API-Key.

## See
Verifikationsreihenfolge im Run: [Änderungsrouting](../effects/CONTEXT.md).