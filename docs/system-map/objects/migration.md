---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/migrate-meetings-registry.mjs
verified_at: 2026-10-29
revision: fa31dbd+ff16-working-tree
---

# Migration

Einmalige, explizite Operator-Migration eines Legacy-Array-Registers
(`meetings.json`) in den kanonischen Objekt-Root. Die einzige Register-Schreibstelle
des Adapters; der Sync ruft sie nicht auf.

## Why this shape
Historisch war `meetings.json` ein nacktes Array. Der alte Sync normalisierte
Nicht-Objekt-Roots still zu einer leeren Meeting-Liste und verlor dabei jeden
Legacy-Eintrag. Fail-closed allein machte solche Workspaces unsyncbar; ein stiller
Umschreibpfad im Sync wäre ein zweiter Publisher. Deshalb genau eine begrenzte,
operator-invokierte Transition, getrennt vom read-only Sync und vom
meeting-desk-Writer.

## Shape
`migrateLegacyRegistryDocument` nimmt einen geparsten Root: ein Array migriert
(`migrated`) verlustfrei und in Originalreihenfolge zum kanonischen Objekt
`channel_strategy`-Defaults + `channel_mappings: {}` + `meetings`; ein valides
Objekt ist `already_current` und wird nur tief kopiert, wobei ein Root ohne
`meetings`-Key gültig bleibt und die CLI dann `meetings: 0` meldet. Identität ist
`meeting_id`, sonst `source.external_id`, sonst Legacy-`id`; `meeting_id` wird nur
ergänzt, wenn sie fehlt. Der dokumentierte Alias `fireflies_<id>` gilt als
gleichwertig, ein Widerspruch ist `legacy_entry_identity_conflict:<index>`.
Identitäten werden opak validiert (nicht leer, max. 512, keine Steuerzeichen,
keine unpaaren Surrogate). Duplikate werden über alle Identitätstoken eines
Eintrags erkannt (`meeting_id`, Legacy-`id`, `source.external_id`, jeweils roh
und `fireflies_`-normalisiert) und als
`legacy_duplicate_identity:<identity>` abgewiesen. Quellformen (`source`-Objekt, unterstütztes
`source.system`, valide `source.external_id`) und Root-Shapes (`meetings`-Array,
`channel_mappings`-/`channel_strategy`-Objekt) werden vor jeder Mutation geprüft.

`migrateMeetingsRegistryFile` liest, validiert vollständig und schreibt erst dann:
symlink/junction-Ziele werden abgewiesen, eine Änderung von mtime/size zwischen
Lesen und Ersetzen bricht mit `registry_concurrent_change` ab, `--dry-run`
schreibt nie. `writeJsonAtomic` erzeugt eine eindeutige Temp-Datei im
Zielverzeichnis, schreibt kanonisch (UTF-8, 2 Spaces, LF, Trailing Newline),
`fsync`t, benennt sie über das Ziel um und entfernt sie bei jedem Fehler; ein
begrenzter Retry deckt nur transiente Windows-Share-Locks (`EPERM`/`EBUSY`/`EACCES`)
beim Replace ab, und ein injektionsfähiges `fs`-Seam bleibt testbar. `isDirectRun`
vergleicht realpfade, damit auch ein Aufruf über Junction/Symlink die CLI startet,
während der Import seitenwirkungsfrei bleibt. Exit 0 für
`migrated`/`already_current`/`dry_run`, Exit 2 für jede Ablehnung;
`--meetings-root` löst relative Pfade gegen den Workspace-Root auf. Keine Secrets,
keine Fireflies-API, keine Meeting-Dateien.

- [scripts/migrate-meetings-registry.mjs](../../../scripts/migrate-meetings-registry.mjs) - `scripts/migrate-meetings-registry.mjs:181` (migrateLegacyRegistryDocument), `scripts/migrate-meetings-registry.mjs:230` (migrateMeetingsRegistryFile), `scripts/migrate-meetings-registry.mjs:277` (writeJsonAtomic), `scripts/migrate-meetings-registry.mjs:333` (isDirectRun), `scripts/migrate-meetings-registry.mjs:376` (runMigrationCli)

## Connected to
[Sync](sync.md), [Skill-Verhalten](skill-behavior.md). Prozess: [meeting-sync](../processes/meeting-sync.md). Datenmodell: [Datenmodell](../../../references/data-model.md).

## If you change this
- **Hits:** Legacy-Identitäts-/Duplikatregeln, kanonische Root-Defaults, atomare
  Schreib-/Concurrency-Semantik, CLI-Envelope/Exit, README/SKILL/Datenmodell,
  `tests/migrate-meetings-registry-smoke.mjs`, `tests/sync-project-smoke.mjs`.
- **Does not hit:** Sync-Intake, Record-Transformation, Writer-Transport,
  Meeting-Dateien, Fireflies-API.

## Surfaces
Liest und schreibt ausschließlich `meetings.json` im aufgelösten Meetings-Root.
Kein Sync-Aufruf, kein zweiter Publisher, keine Credentials.

## See
[Sync](sync.md), [Datenmodell](../../../references/data-model.md), [Änderungsrouting](../effects/CONTEXT.md).
