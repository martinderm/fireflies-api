---
type: object
cluster: adapter
universe: live
status: verified
entity: scripts/_meeting-record.mjs
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
---

# Record

Reine Fireflies-API-zu-`meeting-record/1`-Transformation ohne Datei- oder Registerzugriff.

## Why this shape
Der Adapter liefert einen validierten, providergebundenen Record; der meeting-desk-Writer bleibt die einzige Publikations- und Registergrenze. So ist die Transformation offline testbar und der Adapter kann keine Meeting-Dateien oder Freigaben erzeugen.

## Shape
`RECORD_SCHEMA = meeting-record/1`; `RECORD_ROOT_KEYS` pinnt die elf Root-Felder (`schema`, `source`, `meeting_id`, `title`, `start`, `duration_minutes`, `participants`, `artifacts`, `classification_hint`, `review`, `source_metadata`). `buildMeetingRecord` übernimmt die rohe, opake Fireflies-ID unverändert in `source.external_id` und `meeting_id` (Leerzeichen, `/`, `\` bleiben erhalten; nur leer/Steuerzeichen/unpaare Surrogate werden abgewiesen), entfernt nur den bekannten Cloud-Suffix ` (syncd)` vom Titel und validiert das Ergebnis am Ende. `buildStart` mappt `date` (Epoch-Millisekunden) auf einen echten UTC-Zeitpunkt, zonenbehaftete `dateString`-Werte auf UTC plus lokales `calendar_date`; reine Datumsangaben bleiben `utc: null`/`estimated: true` mit sichtbarer Basis, naive Zeiten ohne Zone werden nicht geparst. `normalizeDuration` akzeptiert nur endliche, nichtnegative Zahlen (auch `0`); numerische Strings werden nicht still umgewandelt. `durationMetadata` bewahrt den rohen Providerwert inklusive Originaltyp/Status (`valid`/`invalid`/`missing`, nichtendliche Zahlen als `repr`) in `source_metadata`. `normalizeParticipants` dedupliziert nichtleere Strings.

Artefakte: `renderSummaryMarkdown` erzeugt den Summary-Body ohne Frontmatter (nur bei vorhandenem Summary-Inhalt); die `Data Completeness`-Zeile leitet sich aus den tatsächlich vorhandenen Summary-/Volltranskript-/Rohtranskript-Artefakten ab. `renderTranscriptArtifact` erzeugt den gerenderten Transkript-Body, `buildRawTranscript` die rohe Providerfassung aus `raw_text` (Fallback `text`) in Satzreihenfolge, verbunden mit genau `\n`; Satztexte bleiben bytegenau inklusive CRLF/Unicode. Ein nichtleeres `transcript_md` verlangt ein nichtleeres `transcript_raw_md`. Fehlende Artefakte sind `null`; mindestens eines muss nichtleer sein. `classification_hint` bleibt vollständig leer, `review.recommended` ist `true` mit `fireflies-asr-and-name-check`. Provider-Metadaten (Channels, Speakers, Organizer, Kalender, `meeting_info`, Summary-Keywords, Duration-Provenienz, Fingerprint, Änderungsstatus) liegen ausschließlich in `source_metadata`.

`validateMeetingRecord` prüft exakte Root-/Blockfelder, Typen, RFC3339-mit-Zone, reale Kalendertage, ID-Steuerzeichen, JSON-Sicherheit (endliche Zahlen, keine Zyklen, keine unpaaren Surrogate) und die dokumentierten Grenzen (`RECORD_LIMITS`: Tiefe 32, 5000 Array-Einträge, 524.288 Bytes/String, 1.048.576 Bytes/Record, 65.536 Bytes `source_metadata`). `RecordValidationError.code` ist maschinenlesbar. IDs sind opak, auf 512 Zeichen begrenzt und werden nie als Dateipfadbestandteile verwendet.

- [scripts/_meeting-record.mjs](../../../scripts/_meeting-record.mjs) - `scripts/_meeting-record.mjs:3` (RECORD_SCHEMA/ROOT_KEYS), `scripts/_meeting-record.mjs:19` (RECORD_LIMITS), `scripts/_meeting-record.mjs:122` (buildStart), `scripts/_meeting-record.mjs:236` (renderSummaryMarkdown), `scripts/_meeting-record.mjs:318` (buildRawTranscript), `scripts/_meeting-record.mjs:328` (renderTranscriptArtifact), `scripts/_meeting-record.mjs:421` (buildMeetingRecord), `scripts/_meeting-record.mjs:542` (validateMeetingRecord)

## Connected to
[Writer](writer.md), [Sync](sync.md), [Meetings-Schema](meetings-schema.md), [CLI](cli.md), [Qualität](quality.md).

## If you change this
- **Hits:** Writer-Transport, Sync-Intake, get-meeting-Export, Record-Tests, `references/meeting-record-v1.md` und `references/data-model.md`.
- **Does not hit:** GraphQL-Query-Aufbau, Secrets-Resolvierung, Writer-interne Register-/Journal-Semantik.

## Surfaces
Record-Objekte gehen über stdin an den Writer oder als `.meeting-export.json` in die `data/`-Zone. Reine Funktionen ohne I/O.

## See
[Record-Vertrag](../../../references/meeting-record-v1.md), [Datenmodell](../../../references/data-model.md). [Änderungsrouting](../effects/CONTEXT.md).
