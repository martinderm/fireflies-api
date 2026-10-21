---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_meeting-writer.mjs
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
---

# Writer-Transport

Child-Prozess-Transport zum kanonischen meeting-desk-Writer; fail-closed statt Legacy-Fallback.

## Why this shape
Der Adapter darf Records nicht selbst publizieren. Ein einziger, strikt validierter Transport hält Capabilities, stdin, Envelope, Exit-Codes und Timeout-Semantik an einer Stelle.

## Shape
`resolveWriterConfig` liest ausschließlich vertrauenswürdige Konfiguration: CLI `--meeting-writer`, `--python`, `--workspace-lock-root`, `--lease-id`, optional `--conversation-id`, plus Env-Fallback `MEETING_DESK_WRITER`/`MEETING_DESK_PYTHON`. Record-/Provider-Felder können diese Werte nie setzen. `assertWriterConfig` verlangt absolute Writer-/Workspace-/Lock-Root-Pfade und existierende Dateien/Verzeichnisse. `checkWriterCapabilities` startet `<python> <writer> --capabilities --json` und verlangt Exit 0 plus `data.record_schema = meeting-record/1` und `data.writer_version = meeting-desk/1`; jeder Fehler ist `kind: capabilities` und blockiert den API-Import.

`runWriterProcess` startet ohne Shell (`shell: false`) mit stdin/stdout/stderr-Pipes, begrenzt die Kindausgabe auf 4 MiB und unterstützt Timeout. `ingestRecord` validiert den Record vorab (`kind: record_invalid`), begrenzt stdin auf 1 MiB UTF-8, baut `--record - --workspace --lease-id --workspace-lock-root [--conversation-id] [--topic --project --event] [--dry-run] --json`, schreibt genau ein UTF-8-JSON-Dokument und verlangt Exit 0 **und** einen validen Sechs-Feld-Envelope (`action`, `success`, `state`, `message`, `data`, `error`). Erfolg muss `action: ingest_meeting` tragen; `data.entry` und `data.paths` müssen Plain Objects sein, `data.meeting_id` ein nichtleerer String, `data.changed` boolesch.

Fehlersemantik: Exit 2 = `rejected`; Exit 3 = `recovery_required`; Exit 0 mit `success: false`, falscher `action`, malformed/fehlenden Envelopes oder ungültigen Erfolgsdaten sowie jeder andere Nonzero-Exit nach möglichem Apply = `outcome_unknown` mit `reason` und `recoveryRequired: true`; Timeout/Signal ebenso. Writer-Inspect statt blinder Retry. Es gibt keinen Fallback auf einen Legacy-Writer.

- [scripts/_meeting-writer.mjs](../../../scripts/_meeting-writer.mjs) - `scripts/_meeting-writer.mjs:41` (resolveWriterConfig), `scripts/_meeting-writer.mjs:54` (assertWriterConfig), `scripts/_meeting-writer.mjs:120` (runWriterProcess), `scripts/_meeting-writer.mjs:198` (parseWriterEnvelope), `scripts/_meeting-writer.mjs:262` (checkWriterCapabilities), `scripts/_meeting-writer.mjs:312` (ambiguousIngest), `scripts/_meeting-writer.mjs:325` (ingestRecord), `scripts/_meeting-writer.mjs:441` (createWriterAdapter)

## Connected to
[Record](record.md), [Sync](sync.md), [CLI](cli.md), [Qualität](quality.md). Prozess: [meeting-sync](../processes/meeting-sync.md).

## If you change this
- **Hits:** Sync-CLI, Capabilities-/Envelope-/Exit-Tests, SKILL.md-Writer-Vertrag, Record-Referenz, meeting-desk-Writer-Erwartungen.
- **Does not hit:** GraphQL-Felder, Record-Transformation, `get-meeting.mjs`-stdout.

## Surfaces
Startet einen externen Python-Prozess; beobachtbare Oberfläche sind stdout/stderr und Exit-Code. Schreibt selbst keine Workspace-Dateien.

## See
[Record-Vertrag](../../../references/meeting-record-v1.md), [CLI](cli.md). [Änderungsrouting](../effects/CONTEXT.md).
