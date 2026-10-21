---
type: process
universe: live
status: verified
entity: scripts/sync-meetings-to-memory.mjs
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
consumes: [../objects/sync.md, ../objects/record.md, ../objects/writer.md, ../objects/meetings-schema.md, ../objects/client.md]
produces: [../objects/skill-behavior.md]
---

# meeting-sync

## Input → Movement → Output
Sync-Aufruf (Modus, optionale Filter, optionale vertrauenswürdige Route, Writer-Konfiguration) → Capabilities-Check, read-only Register-/API-Intake, Record-Transformation, Kindprozess-Aufruf → pro Meeting ein Writer-Ergebnis oder ein sichtbarer Fehler; keine Adapter-Writes.

## Why this shape
Der Sync ist Intake, nicht Publisher und nicht Klassifikator. Er liest Fingerprints/Aliase, markiert Änderungen und übergibt einen validierten Record; Register, Pfade, Frontmatter, Review- und Content-Status gehören dem Writer.

## Steps
1. Parst und validiert Argumente; `--project`/`--topic`/`--event` (plus Aliase) werden zu einer Route, ein fehlendes Routing bleibt `null` (unmapped Intake). Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:68`, `scripts/sync-meetings-to-memory.mjs:168`.
2. Löst vertrauenswürdige Writer-Konfiguration und Workspace-Root auf; prüft Writer-Datei, absoluten Lock-Root und Lease. Quelle: [scripts/_meeting-writer.mjs](../../../scripts/_meeting-writer.mjs) - `scripts/_meeting-writer.mjs:41`, `scripts/_meeting-writer.mjs:54`.
3. Prüft `--capabilities --json` auf `meeting-record/1`/`meeting-desk/1`; bei Fehler endet der Lauf vor API und Register. Quelle: [scripts/_meeting-writer.mjs](../../../scripts/_meeting-writer.mjs) - `scripts/_meeting-writer.mjs:262`.
4. Liest `meetings.json` nur lesend; fehlend ist erlaubt, beschädigt/Array/ungültiger Root ist Rejection. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:177`.
5. Prüft Kandidaten-Identität, Aliase und Accountbindung **vor** dem Detail-Fetch; ein nichtleerer gebundener Account bei unbekanntem aktuellem Account stoppt ohne API-/Writer-Aufruf. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:281`, `scripts/sync-meetings-to-memory.mjs:333`.
6. Ermittelt Kandidaten je Modus über Listen-/Detail-Query; `--refresh-changed` nutzt vorhandene Fireflies-Identitäten. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:544`.
7. Baut pro Meeting einen Record mit roher opaker ID, Zeit-/Dauer-Mapping samt Duration-Provenienz, getrennten Raw-/Render-Artefakten, inertem `source_metadata` und Fingerprint-Vergleich. Quelle: [scripts/_meeting-record.mjs](../../../scripts/_meeting-record.mjs) - `scripts/_meeting-record.mjs:421`, [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:333`.
8. Übergibt genau einen UTF-8-JSON-Record ohne Shell an den Writer; Exit 0 plus valider `ingest_meeting`-Erfolgs-Envelope mit Plain-Object-`paths` sind nötig. Exit 2/3, Timeout, Signal, malformed/contradictory/nonzero nach möglichem Apply werden `outcome_unknown`/`recovery_required`; der Batch stoppt. Quelle: [scripts/_meeting-writer.mjs](../../../scripts/_meeting-writer.mjs) - `scripts/_meeting-writer.mjs:312`, `scripts/_meeting-writer.mjs:325`.
9. Meldet `meetings`, `failures`, `synced`, `failed` und `state`; es gibt keine Datei-/Registermutation im Adapter. Quelle: [scripts/sync-meetings-to-memory.mjs](../../../scripts/sync-meetings-to-memory.mjs) - `scripts/sync-meetings-to-memory.mjs:333`.

## If you change this
- **Hits:** Writer-Vertrag, Record-Transformation, Fingerprint-/Alias-Semantik, Routingoptionen, SKILL.md-Sync-Regeln, Sync-/Transport-/Record-Tests.
- **Does not hit:** Reine Lese-Skripte; Writer-interne Journal-/Recovery-Schritte.

## Surfaces
Liest Fireflies-API und lokale `meetings.json`; schreibt selbst keine Dateien. Der einzige Schreibpfad führt über den externen Writer.

## See
[Sync](../objects/sync.md), [Record](../objects/record.md), [Writer](../objects/writer.md), [Skill-Verhalten](../objects/skill-behavior.md).
