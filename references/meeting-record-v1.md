# Meeting Record v1 — Fireflies-Adaptervertrag

Stand: 2026-10-21

Diese Referenz beschreibt die Ausgabe des Fireflies-Adapters und den Vertrag mit
dem kanonischen meeting-desk-Writer (OI #35). Sie ersetzt die frühere Annahme,
der Adapter dürfe Meeting-Dateien oder `meetings.json` schreiben.

## Verantwortlichkeiten

| Ebene | Darf | Darf nicht |
| :--- | :--- | :--- |
| Fireflies-Adapter | API lesen, `meeting-record/1` bauen, Writer aufrufen, Record nach `data/` exportieren, Register lesen | Register/Meeting-Dateien schreiben, klassifizieren, freigeben, Legacy-Writer als Fallback nutzen |
| meeting-desk-Writer | Record validieren, Routing anwenden, Register/Frontmatter/Dateien/Journal schreiben | Provider-Payload als vertrauenswürdige Routingentscheidung übernehmen |
| Aufrufender Agent | Review lesen, Operator-/Writer-Kanal für Routing nutzen | Adapter-Record als Content-Approval behandeln |

## Root-Vertrag

Genau diese elf Root-Felder; unbekannte Erweiterungen sind ausschließlich in
`source_metadata` erlaubt. Unbekannte Versionen, falsche Typen, nichtendliche
Zahlen und ungültiges UTF-8 werden abgewiesen.

```json
{
  "schema": "meeting-record/1",
  "source": { "system": "fireflies", "account_ref": null, "external_id": "raw-fireflies-id" },
  "meeting_id": "raw-fireflies-id",
  "title": "Meeting title",
  "start": { "utc": null, "calendar_date": null, "estimated": true, "basis": ["unknown"] },
  "duration_minutes": null,
  "participants": [],
  "artifacts": { "summary_md": null, "transcript_md": null, "transcript_raw_md": null },
  "classification_hint": { "topic_slug": null, "project_slug": null, "event_slug": null, "basis": [] },
  "review": { "recommended": true, "reason": "fireflies-asr-and-name-check" },
  "source_metadata": {}
}
```

- `source.system` ist eines von `fireflies`, `ticnote`, `zoom`, `manual`, `vimeo-webvtt`.
- `source.external_id` und `meeting_id` sind nichtleere stabile, **opake** Strings. Fireflies-IDs bleiben roh: kein Präfix, keine Slugifizierung, keine Dateinamen-Bereinigung. Leere IDs, Steuerzeichen, unpaare Surrogate und IDs über 512 Zeichen werden abgewiesen; gültige opake IDs mit Leerzeichen, `/` oder `\` bleiben unverändert. Der Writer darf eine ID niemals als Dateipfadbestandteil verwenden.
- `source.account_ref` ist `null` oder eine nichtleere opake Referenz, kein Secret.
- `title` ist ein String; der bekannte Cloud-Suffix ` (syncd)` wird für den lokalen Titel entfernt.
- `participants` sind nichtleere Strings.
- Mindestens eines von `summary_md`, `transcript_md`, `transcript_raw_md` ist nichtleer. `null` bedeutet fehlendes Artefakt.

## Start und Dauer

`start` hat genau `utc`, `calendar_date`, `estimated`, `basis`.

- `utc` ist `null` oder RFC3339 mit expliziter Zeitzone. Neue Projektionen sind UTC.
- `calendar_date` ist `null` oder ein realer ISO-Kalendertag; er muss nicht der UTC-Tag sein.
- `estimated` ist strikt boolesch. Ohne `utc` muss `estimated: true` sein.
- `basis` ist eine Stringliste und macht die Herleitung sichtbar. Bei `estimated: true` darf sie nicht leer sein.
- `title` darf keine Steuerzeichen enthalten. Strings mit unpaaren Surrogaten werden als nicht-UTF-8 abgewiesen, nicht still ersetzt.

Fireflies-Mapping:

| Provider | Record | Regel |
| :--- | :--- | :--- |
| `date` (Epoch-Millisekunden) | `start.utc` + `calendar_date` | gültiger Instant, `estimated: false`, Basis `provider-epoch-ms` |
| `dateString` mit Zeitzone | `start.utc` + lokales `calendar_date` | `estimated: false`, Basis `provider-datestring-zone` |
| `dateString` nur Datum | `calendar_date`, `utc: null` | `estimated: true`, Basis `date-only` |
| `dateString` mit Zeit ohne Zone | `calendar_date`, `utc: null` | `estimated: true`, Basis `local-time-without-zone`; keine erfundene Zone |
| keine Zeit | alle Zeitfelder `null` | `estimated: true`, Basis `["unknown"]` |

Importzeit, Mitternacht oder Mittag sind **niemals** Ersatz für eine fehlende
Providerzeit. `duration_minutes` ist eine endliche, nichtnegative Zahl oder
`null`; `0` ist ein bekannter Wert, Boolean ist keine Zahl. Numerische Strings
werden nicht still in Zahlen umgewandelt, weil Fireflies `duration` als Zahl
dokumentiert. Der rohe Providerwert bleibt mit Originaltyp in
`source_metadata.provider_duration_raw`, `provider_duration_raw_type` und
`provider_duration_status` (`valid`, `invalid`, `missing`) erhalten;
nichtendliche Zahlen tragen zusätzlich `provider_duration_raw_repr`.

## Artefakte und Raw

- `transcript_md` ist die gerenderte, lesbare Fassung (Speaker/Timestamps).
- `transcript_raw_md` ist die rohe Providerfassung. Fireflies liefert strukturierte Sätze; der Adapter verbindet deren `raw_text` (Fallback: `text`) in Providerreihenfolge mit genau `\n`. Jeder Satztext bleibt bytegenau, inklusive Leerzeichen, Tabs, CRLF und Unicode. Der Writer übernimmt den String unverändert; gleicher Inhalt ist idempotent, abweichender Inhalt unter derselben Identität stoppt.
- `summary_md` ist die gerenderte Provider-Summary ohne Frontmatter. Fehlt Summary-Inhalt, ist das Feld `null`.
- Ein nichtleeres `transcript_md` verlangt ein nichtleeres `transcript_raw_md`; ein neues Transkript ohne Raw-Ausgangsfassung wird abgewiesen.
- Fehlt ein Transkript, sind `transcript_md` und `transcript_raw_md` `null`. Es wird kein Platzhalter als Evidenz erfunden.

## Klassifikation und Review

- `classification_hint` ist **untrusted** und enthält keine Entscheidung. Der Fireflies-Adapter setzt alle Slugs auf `null` und `basis` auf `[]`.
- Vertrauenswürdige Operator-Optionen `--topic`, `--project`, `--event` (Aliase `--project-slug`, `--topic-slug`, `--event-slug`) gehen an den Writer; nur der Writer validiert Kataloge und setzt `classified`/`unmapped`.
- Ohne Routing ist der Lauf ein gültiger **unmapped Intake**. Ein fehlendes `--project-slug` ist kein Fehler; ein explizit leerer oder zu `ohne-channel` normalisierender Wert wird abgewiesen.
- `review.recommended` ist beim Fireflies-Adapter `true`; `reason` ist `fireflies-asr-and-name-check`. Das fordert Review nur zusätzlich an und setzt keine Freigabe herab.
- `accepted` ist kein Adapterergebnis. Ein Import ist kein Content-Approval.

## `source_metadata` (inert)

Der Adapter legt Provider-Metadaten ausschließlich hier ab, zum Beispiel:

`provider`, `provider_meeting_id`, `provider_title`, `provider_date`,
`provider_date_string`, `provider_duration_raw`, `provider_duration_raw_type`,
`provider_duration_raw_repr`, `provider_duration_minutes`,
`provider_duration_status`, `channel_id`,
`channel_title`, `channel_slug`, `channels`, `organizer_email`, `host_email`,
`transcript_url`, `meeting_link`, `calendar_id`, `cal_id`, `calendar_type`,
`participants_count`, `speakers`, `speakers_count`, `meeting_attendees_count`,
`meeting_attendance_count`, `shared_with`, `apps_count`, `is_live`,
`meeting_info`, `meeting_info_summary_status`, `has_summary`,
`has_full_transcript`, `summary_keywords`, `summary_meeting_type`,
`summary_topics_discussed`, `summary_has_notes`,
`summary_extended_sections_count`, `server_fingerprint`,
`previous_server_fingerprint`, `server_change_status`,
`server_changed_since_last_sync`, `registry_match`.

Keine Secrets, keine erfundenen Klassifikationen und keine Workspace-Pfade.

## Validierungsgrenzen

Der Adapter prüft vor dem Writer-Aufruf:

- Root- und Blockfelder exakt; unbekannte Root-/Block-Keys werden abgewiesen.
- JSON-sichere Werte: endliche Zahlen, keine Funktionen/undefinierten Werte, keine Zyklen, keine unpaaren Surrogate.
- Doppelte JSON-Keys, NaN/Infinity, überlaufende Zahlen und über-tiefe Rohdokumente weist der Writer-Parser ab; der Adapter erzeugt sie nicht und prüft dieselben Objektgrenzen.
- maximale Tiefe 32, maximal 5000 Array-Einträge, maximal 524.288 UTF-8-Bytes pro String, maximal 1.048.576 Bytes pro Record, maximal 65.536 Bytes für `source_metadata`.

Diese Grenzen sind fail-closed und dokumentiert; sie sind kein unbegrenzter Parser.

## Writer-Seam

Der Adapter startet den Writer ohne Shell. stdin ist genau ein UTF-8-JSON-Record:

```text
<python> <ingest_meeting.py> --record - --workspace <root> --lease-id <lease> \
  --workspace-lock-root <trusted-skill-root> [--conversation-id <id>] \
  [--topic <slug>] [--project <slug>] [--event <slug>] [--dry-run] --json
```

Vertrauenswürdige Konfiguration kommt ausschließlich aus expliziten
CLI-Argumenten `--meeting-writer`, `--python`, `--workspace-lock-root`,
`--lease-id` sowie optional `MEETING_DESK_WRITER`/`MEETING_DESK_PYTHON`. Niemals
aus dem Record oder Provider-Payload. Vor Listen-/Detail-Queries:

```text
<python> <ingest_meeting.py> --capabilities --json
```

Erforderlich sind `data.record_schema = meeting-record/1` und
`data.writer_version = meeting-desk/1`. Schlägt das fehl, startet kein API-Import.

Envelope: genau sechs Felder `action`, `success`, `state`, `message`, `data`,
`error`. Erfolg verlangt **Exit 0**, `action: ingest_meeting` und einen validen
Erfolgs-Envelope mit Plain-Object-`data.entry`, nichtleerem
`data.meeting_id`, Plain-Object-`data.paths` und booleschem `data.changed`.
Exit 2 ist Rejection, Exit 3 `recovery_required`. Jeder andere Nonzero-Exit,
Exit 0 mit `success: false`, falscher Action, malformed/fehlenden Envelopes oder
ungültigen Erfolgsdaten kann nach einem möglichen Apply auftreten und wird
deshalb `outcome_unknown` mit `recoveryRequired: true`; dasselbe gilt für
Timeout/Signal und übergroße Kindausgabe. Dann ist Writer-Inspect nötig, kein
blinder Retry. Es gibt keinen Legacy-Fallback.

Batch-Läufe berichten pro Meeting: `meetings` (Erfolge), `failures` (Fehler),
`state` (`success`, `partial_error`, `recovery_required`), `synced`, `failed`.
`recovery_required` stoppt den Batch. Ein Teilfehler ist kein voller Erfolg.

## Read-only Register

Der Sync liest `meetings.json` nur:

- fehlendes Register: leerer Ausgangszustand, kein Schreiben;
- ungültiges JSON, nacktes Array, ungültige Root-/Listentypen: Rejection vor Writes;
- unbekannte Root-Metadaten: bleiben für den Writer erhalten;
- Identität: Quellsystem plus externe ID; Fireflies-Alias `fireflies_<id>` bleibt lesbar;
- mehrdeutige Identität oder fremde Accountbindung: Fehler, kein Rateversuch;
- ein nichtleerer gebundener `source.account_ref` bei unbekanntem aktuellem Account stoppt vor Detail-Fetch/Writer; ein ungebundener Bestandseintrag bleibt unter der Quellsystem-Identität zulässig;
- die Account-/Identitätsprüfung läuft vor dem Detail-Fetch, damit kein API- oder Writer-Aufruf für einen ungeklärten Bestand erfolgt;
- `server_fingerprint` wird gelesen, das Vergleichsergebnis reist inert in `source_metadata`.

Der Adapter legt weder Register noch Meeting-Dateien an, repariert sie nicht und
löscht sie nicht. `relocate-local-meeting.mjs` wurde entfernt.

## Ad-hoc-Export

`get-meeting.mjs` darf weiterhin JSON/Markdown auf stdout ausgeben. Eine
Dateiausgabe ist nur zulässig als:

- valider `meeting-record/1`-Record,
- Dateiname endet auf `.meeting-export.json`,
- Ziel liegt unter `<workspace>/data/`,
- explizite `--lease-id` und `--workspace-lock-root`,
- aktive, eigene Lease (`allow_legacy=False`),
- no-clobber.

Der Export ruft den Shared Guard `workspace_lock_guard.py` **in place** über
einen vertrauenswürdigen Python-Kindprozess auf und importiert dort
`require_workspace_lock(..., allow_legacy=False)`. Es werden keine
Ownership-Regeln nachgebaut, keine Guard-Datei kopiert und kein Legacy-Modus
akzeptiert. Der Guard prüft eine aktive, von der deklarierten Lease-ID
beanspruchte Sperre; das ist eine **kooperative Lease-Zusicherung**, kein
kryptografischer Nachweis einer Aufruferidentität.

Ablauf: Zone/Endung/Pfad prüfen → Guard vor Credentials/API → Fetch/Record →
Guard + Pfad erneut vor dem Staging → Guard + Pfad unmittelbar vor der
create-only-Publikation. Fehlt die Lease, gehört sie einer anderen Lease oder
ist sie abgelaufen, wird nichts geschrieben; ein nach dem Fetch oder Staging
freigegebener/ersetzter Lease hinterlässt weder Export noch Temp-Datei. Eine
Race zwischen der letzten Guard-Prüfung und dem atomaren Create bleibt im
kooperativen Lockmodell möglich und wird nicht als adversarielle Garantie
behauptet. Markdown-Dateien, andere Endungen, Pfadflucht,
Symlink-/Junction-Flucht und fehlende Elternordner werden abgewiesen. Es
entsteht kein unregistriertes Summary-/Transcript-Paar.

## Konformität

Der lokale Konformitätstest pinnt Manifest-Digest, Quell-Datei-SHA-256,
Record-Schema, Writer-Version und die Zählung 11/19/5. Die kanonische
JSON-Kanonisierung und -Digestberechnung laufen über stdlib Python, nicht über
eine abweichende JS-Serialisierung. `raw_invalid_json` bleibt Autorität des
OI-Writers und wird über den echten kanonischen
`verify_meeting_fixtures.py`-Helper cross-repo geprüft; der Adapter baut dafür
keinen zweiten Roh-JSON-Parser. Fehlt der OI-Helper, schlägt der Test fehl statt
zu skippen.
