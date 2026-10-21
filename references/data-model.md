# Fireflies Transcript Data Model

Stand: 2026-04-21

## Zweck

Diese Referenz sammelt die wichtigsten Felder des Fireflies-`Transcript`-Schemas, damit bei Feldwahl und Query-Design nicht jedes Mal die Web-Doku nötig ist. Seit OI #35 beschreibt sie außerdem die Grenze zwischen Adapter-Transformation und kanonischem Meeting-Writer.

## Adapter-Grenze und kanonischer Record (OI #35)

Der Fireflies-Adapter ist **kein Register- oder Meeting-Datei-Writer**. Seine Ausgabe ist ein `meeting-record/1`-Record; Details und Beispiele stehen in [`meeting-record-v1.md`](meeting-record-v1.md). Der meeting-desk-Writer validiert den Record, nimmt vertrauenswürdige Routingoptionen entgegen und schreibt `meetings.json`, Frontmatter, Summary-/Transcript-Dateien und Review-/Content-Zustand.

- `source.system` ist `fireflies`; `source.external_id` und `meeting_id` sind die unveränderte rohe, opake Fireflies-ID (kein Präfix, keine Umschlüsselung, keine Dateinamen-Bereinigung). Leere IDs, Steuerzeichen, unpaare Surrogate und IDs über 512 Zeichen werden abgewiesen; Leerzeichen, `/` oder `\` in gültigen IDs bleiben erhalten. IDs sind nie Dateipfadbestandteile.
- `date` (Epoch-Millisekunden) wird zu `start.utc`; eine reine Datumsangabe bleibt `start.utc: null` mit `estimated: true`. Importzeit oder eine erfundene Mittagszeit sind kein Ersatz.
- `duration` wird zu `duration_minutes` (Provider-Minuten, `0` bleibt bekannt). Numerische Strings werden nicht still umgewandelt; der rohe Providerwert inklusive Originaltyp bleibt inert in `source_metadata` (`provider_duration_raw`, `provider_duration_raw_type`, `provider_duration_status`).
- `transcript_md` (gerendert) und `transcript_raw_md` (rohe Satztexte, bytegenau, nur strukturell mit LF verbunden) sind getrennt; der Writer darf Raw niemals umschreiben.
- Provider-spezifische Felder (Channels, Speakers, Organizer, Kalender, `meeting_info`, Summary-Keywords, Fingerprint usw.) liegen inert in `source_metadata`, nicht als Record-Root-Extras.
- Der Adapter setzt keine `project_slug`/`topic_slug`-Entscheidung und keine Freigabe. `classification_hint` bleibt leer; `review.recommended` ist `true`.

## Wichtige Fireflies-`Transcript`-Felder

### Identität und Links

- `id`
  - eindeutige Transcript-ID
- `title`
  - Titel des Transcripts
- `transcript_url`
  - URL zur Ansicht im Fireflies-Dashboard
- `meeting_link`
  - Webkonferenz-URL des Meetings, falls unterstützt

### Personen und Teilnehmer

- `organizer_email`
  - E-Mail des Organizers
- `user`
  - User, in dessen Auftrag Fred aufgenommen hat
- `speakers`
  - Sprecherliste mit IDs und Namen im Transcript
- `participants`
  - Teilnehmer-E-Mails, auch ohne Fireflies-Konto
- `meeting_attendees`
  - strukturierte Teilnehmerliste
- `meeting_attendance`
  - Join-/Leave-Zeiten der Teilnehmer
- `fireflies_users`
  - nur Teilnehmer mit Fireflies-Konto
- `workspace_users`
  - Teilmenge der Fireflies-User aus dem Workspace/Team
- `host_email`
  - deprecated

### Zeit und Dauer

- `duration`
  - Audiolänge in Minuten
- `dateString`
  - ISO-Datetime
- `date`
  - Millisekunden seit Unix-Epoch, UTC

### Inhalte

- `sentence`
  - Liste von Sentence-Objekten mit Transkriptinhalt
- `summary`
  - KI-generierte Summary
- `apps`
  - Vorschau auf AI-App-Outputs, maximal 5 neueste

### Meeting-Metadaten

- `meeting_info`
  - zusätzliche Metadaten
- `calendar_id`
  - Kalender-Event-ID
- `cal_id`
  - Kalender-Event-ID inklusive Zeitanteil für wiederkehrende Events
- `calendar_type`
  - Kalenderanbieter
- `channels`
  - zugeordnete Channels
- `shared_with`
  - externe Freigaben
- `is_live`
  - ob das Meeting aktuell live ist

### Downloads und Medien

- `audio_url`
  - signierte Download-URL für Audio, läuft nach 24h ab, planabhängig
- `video_url`
  - signierte Download-URL für Video, läuft nach 24h ab, planabhängig und nur mit aktiviertem Meeting-Video

### Analytics

- `analytics`
  - MeetingAnalytics mit Sentiments, Kategorien und Sprecher-Analysen
  - planabhängig

## Kanonische Meeting-Ablage (Writer-eigentümlich)

Der meeting-desk-Writer — nicht der Fireflies-Adapter — pflegt die Ablage. Ziel ist `memory/evidence/meetings/` (Fallback für Altsysteme: `memory/references/meetings/`). Projekt-scoped Dateien können unter `memory/evidence/projects/<project_slug>/meetings/<channel>/` liegen; `meetings.json` bleibt am Meetings-Root.

### Ordnerstruktur

```text
memory/
  evidence/
    meetings/
      meetings.json
      <channel-or-ohne-channel>/
        <date>-<meeting-slug>.summary.md
        <date>-<meeting-slug>.transcript.md
```

Regeln:

- `meetings.json` ist ein **Objekt** mit `meetings`-Liste; unbekannte Root-Metadaten bleiben erhalten.
- Ein nacktes Array ist kein gültiges Register und wird vom Writer nicht still konvertiert.
- Summary und Volltranskript werden getrennt publiziert; Raw-Evidenz wird niemals umgeschrieben.
- Ein Adapter darf das Register lesen, aber niemals schreiben, reparieren, löschen oder neu anlegen.

### `meetings.json` — kanonischer Eintrag (OI #35)

Neue Einträge verwenden die folgende Objektform. Nicht vorhandene Werte sind `null`, nicht erfunden. Provider-spezifische Extras gehören ausschließlich nach `source_metadata`.

```json
{
  "channel_strategy": {
    "mode": "scarce_channels",
    "max_channels": 3,
    "channels_are_taxonomy": false,
    "classification_source_of_truth": "chat_review_classification"
  },
  "channel_mappings": {
    "channel-slug": {
      "channel_id": "channel-id",
      "channel_title": "CHANNEL-TITLE",
      "routing_mode": "unmapped",
      "project_slug": null,
      "topic_slug": null,
      "mapping_source": "unmapped",
      "notes": "Intake-Channel; fachliche Zuordnung erfolgt nachgelagert."
    }
  },
  "meetings": [
    {
      "meeting_id": "01J8Z5M4T3K2Q1P0N9B8A7C6D5",
      "source": {
        "system": "fireflies",
        "account_ref": "account@example.com",
        "external_id": "01J8Z5M4T3K2Q1P0N9B8A7C6D5"
      },
      "title": "Meeting Title",
      "date": 1776757200000,
      "dateString": "2026-04-21T07:40:00.000Z",
      "meeting_date": "2026-04-21",
      "start_estimated": false,
      "duration_minutes": 42,
      "duration": 42,
      "participants": ["account@example.com"],
      "summary_path": "memory/evidence/meetings/channel-slug/2026-04-21-meeting-title.summary.md",
      "transcript_path": "memory/evidence/meetings/channel-slug/2026-04-21-meeting-title.transcript.md",
      "transcript_raw_path": null,
      "topic_slug": null,
      "project_slug": null,
      "event_slug": null,
      "classification_status": "unmapped",
      "classification_basis": [],
      "review_recommended": true,
      "review_reason": "asr-name-and-number-check",
      "content_status": "provisional",
      "first_synced_at": "2026-04-21T12:00:00Z",
      "last_synced_at": "2026-04-21T12:05:00Z",
      "record_schema": "meeting-record/1",
      "source_metadata": {
        "provider": "fireflies",
        "channel_slug": "channel-slug",
        "provider_duration_raw": 42,
        "provider_duration_raw_type": "number",
        "provider_duration_minutes": 42,
        "provider_duration_status": "valid",
        "channels": [{ "id": "channel-id", "title": "CHANNEL-TITLE", "is_private": false }],
        "speakers": [{ "id": "s1", "name": "Alice" }],
        "organizer_email": "account@example.com",
        "transcript_url": "https://app.fireflies.ai/view/...",
        "meeting_info_summary_status": "processed",
        "summary_keywords": ["keyword-1"],
        "server_fingerprint": "sha256...",
        "server_change_status": "unchanged",
        "server_changed_since_last_sync": false
      }
    }
  ]
}
```

Legacy-Aliase bleiben lesbar und werden bei einem zielbezogenen Update nicht unnötig umgeschlüsselt:

| Quelle | belegte Identität | Zeit-/Dauer-Aliase | Importprovenienz |
| :--- | :--- | :--- | :--- |
| Fireflies | `meeting_id` = rohe externe ID; dokumentierter Alias `fireflies_<id>` | `duration` / `duration_minutes`, `dateString` / `start_time` | `first_synced_at`, `last_synced_at`, `synced_at` |
| TicNote | `meeting_id: ticnote-<recordId>` | `duration` / `duration_minutes` | wie oben |
| Zoom | `id: zoom-<uuid>` | `duration` / `duration_minutes` | wie oben |

Abgleich erfolgt über Quellsystem plus externe Identität, nie über Titel-Fuzzy-Matching. Widersprüchliche IDs, mehrdeutige Einträge oder fremde Accountbindungen stoppen.

### Manuelle Imports und neutrale Quellen

Das Meeting-Schema ist nicht auf Fireflies beschränkt. Es darf auch für manuell importierte Transkripte verwendet werden, zum Beispiel aus Zoom-Sessions, Chat-Datei-Uploads oder lokalen Ordnern wie `Agent-Share/`.

Regeln:

- manuelle Imports werden ebenfalls über den kanonischen Writer in dieselbe `meetings.json` und dieselbe Ordnerstruktur überführt; der Fireflies-Adapter schreibt sie nicht selbst
- Summary-Datei und optional Volltranskript-Datei werden nach denselben Writer-Regeln publiziert
- wenn kein Channel vorhanden ist, den neutralen Fallback-Ordner des Writers verwenden; nichts erfinden
- Quelle immer im `source`-Block des Records dokumentieren (`source.system`, `source.external_id`); provider-spezifische Herkunft gehört inert nach `source_metadata`

Zulässige `source.system`-Werte des Records:

- `fireflies`
- `ticnote`
- `zoom`
- `manual`
- `vimeo-webvtt`

Provider-spezifische Zusatzfelder (z. B. `import_mode`, `origin_path`, `origin_name`, `summary_origin`) gehören in `source_metadata`, nicht in den Record-Root.

### `channel_mappings` Feldbedeutung

`channel_mappings` hält die lokale Beschreibung von Fireflies-Channel-Slugs als knappe Intake-Container sowie optionale Routingdefaults auf Channel-Ebene.

Felder:

- `channel_id`
  - originale Fireflies-Channel-ID
- `channel_title`
  - aktueller Fireflies-Channel-Titel
- `routing_mode`
  - Art der Channel-basierten Vorzuordnung
- `project_slug`
  - zugeordneter Projekt-Slug, wenn vorhanden oder als fixer Default gesetzt
- `topic_slug`
  - zugeordneter Topic-Slug, wenn vorhanden oder als fixer Default gesetzt
- `mapping_source`
  - Herkunft der Zuordnung
- `notes`
  - freie Notiz für Begründung, Sonderfall oder Prüfhinweis

Empfohlene Werte für `routing_mode`:

- `unmapped`
  - Standard für reine Intake-Channels; fachliche Zuordnung erfolgt später
- `fixed_project`
  - nur verwenden, wenn ein Channel belastbar für genau ein Projekt steht
- `fixed_topic`
  - nur verwenden, wenn ein Channel belastbar für genau ein Topic steht
- `fixed_both`
  - nur verwenden, wenn ein Channel belastbar für eine feste Projekt- und Topic-Kombination steht

Empfohlene Werte für `mapping_source`:

- `manual`
  - händisch gesetzte Zuordnung
- `derived_project`
  - aus Projektkatalog oder Projektskill abgeleitet
- `derived_topic`
  - aus Topic-Katalog oder Topicskill abgeleitet
- `derived_both`
  - Projekt- und Topic-Zuordnung gemeinsam abgeleitet
- `unmapped`
  - noch keine belastbare Zuordnung vorhanden

### Zusammenspiel mit anderen Skills

Die Felder `project_slug` und `topic_slug` sind nicht nur lokale Deko, sondern die Brücke zu den Katalog-Skills.

- `project_slug` soll mit den Slugs aus dem Skill `project-catalog-entry` kompatibel sein.
- `topic_slug` soll mit den Slugs aus dem Skill `topic-catalog-entry` kompatibel sein.
- Wenn diese Skills vorhanden sind, Channel-Mappings bevorzugt gegen deren Katalogstruktur prüfen statt freie Eigenerfindungen zu verwenden.
- Neue Mapping-Werte möglichst an bestehende Katalog-Slugs anlehnen, damit Meetings später sauber mit Projekten und Topics verbunden werden können.
- Bei generischen Channels `routing_mode` sauber setzen und `project_slug` oder `topic_slug` nur dann vorbelegen, wenn es wirklich feste Defaults gibt.
- Wenn keine belastbare Zuordnung möglich ist, `mapping_source: unmapped` setzen statt einen hübschen Fantasieslug zu erfinden.

### Zusätzliche Meeting-Felder für Betrieb und Nachpflege

Zusätzlich zu den inhaltlichen Meeting-Feldern sind diese Betriebsfelder wichtig:

- `project_scoped`
  - boolesche Kennzeichnung, dass die Meeting-Dateien physisch im Projektbaum liegen (`memory/evidence/projects/<project_slug>/meetings/<channelSlug>/`)
  - wird ausschließlich vom kanonischen Writer gesetzt, wenn eine vertrauenswürdige `--project`-Auswahl vorliegt; der Adapter setzt es nie
  - ist eine Ablage-/Routingentscheidung, keine Content-Freigabe; `review_recommended` bleibt unabhängig davon erhalten
  - `project_slugs` bedeutet bei projekt-scoped Einträgen „enthaltende Bäume“; Umrouting ist ein Writer-Vorgang
  - Layout-Split (bewusst): Der Projektbaum liegt immer unter `memory/evidence/projects/`, auch wenn ein Custom-`meetingsRoot` gesetzt ist; nur der Pool folgt dem Custom-Root (Dual-Evidence-fest)

- `project_slugs`
  - optionale Liste zusätzlicher Projektzuordnungen, falls später mehr als ein Projekt dokumentiert werden soll
- `topic_slugs`
  - optionale Liste zusätzlicher Topiczuordnungen, falls später mehr als ein Topic dokumentiert werden soll
- `project_matches`
  - optionales Feld für spätere Kandidatenlisten, falls der Agent solche Evidenz gesondert dokumentiert
- `topic_matches`
  - optionales Feld für spätere Kandidatenlisten, falls der Agent solche Evidenz gesondert dokumentiert
- `classification_status`
  - aktueller Klassifikationszustand des Meetings (Writer-/Registerfeld)
  - kanonische Werte des neuen Writers: `classified`, `unmapped`; ältere Werte wie `mapped`/`candidate` bleiben als Bestand lesbar
- `classification_confidence`
  - grobe Vertrauensstufe der Klassifikation
  - empfohlene Werte: `high`, `medium`, `low`
- `classification_notes`
  - kurze maschinenlesbare Begründungen oder Scoring-Hinweise
- `classification_basis`
  - nachvollziehbare Liste der wichtigsten Evidenzen für die Zuordnung, zum Beispiel Channel, Titel, Summary, Teilnehmer oder bekannte Kontakte
- `review_recommended`
  - boolesches Signal, dass die fachliche Zuordnung im Chat noch offen ist und Review sinnvoll ist
- `review_reason`
  - Kurzgrund für empfohlenes Review, zum Beispiel `chat-review-classification-required`, `missing-channel-mapping`, `multi-context-meeting`, `ambiguous-primary-context`
- `classifier_mode`
  - dokumentiert, dass die fachliche Klassifikation im Chat nachgelagert erfolgt
  - empfohlene Werte: `chat-review`, `agent-llm`, `user-resolved`
- `review_input`
  - kompaktes Input-Paket für die spätere LLM- oder Human-Nachklassifikation
- `llm_review_status`
  - Workflow-Status für den Nachgang durch den aufrufenden Agenten
  - empfohlene Werte: `not-needed`, `pending`, `resolved`, `user-query`
- `llm_review_summary`
  - kurze textliche Zusammenfassung der späteren LLM- oder Human-Entscheidung
- `resolved_by`
  - wer den Review-Fall aufgelöst hat, zum Beispiel `agent-llm` oder `user`
- `resolved_at`
  - Zeitpunkt der Auflösung des Review-Falls
- `server_fingerprint`
  - lokaler Hash über relevante Serverfelder zur Update-Erkennung
  - der Adapter liest ihn nur; das Ergebnis des Vergleichs reist inert in `source_metadata`, geschrieben wird es vom Writer
- `server_change_status`
  - Status des letzten Serververgleichs
  - empfohlene Werte: `new`, `unknown`, `changed`, `unchanged`
- `server_changed_since_last_sync`
  - boolescher Kurzindikator für den letzten Vergleich
- `first_synced_at`
  - erster lokaler Sync-Zeitpunkt
- `last_synced_at`
  - letzter lokaler Sync-Zeitpunkt
- `source.import_mode`
  - Art des Imports, besonders relevant für manuelle Quellen
- `source.origin_path`
  - ursprünglicher lokaler Pfad oder Ablageort
- `source.origin_name`
  - ursprünglicher Dateiname oder Quellname

Praktische Bedeutung:

- `project_slug` und `topic_slug` sind die kanonischen Fachverlinkungen, sobald im Chat eine belastbare Entscheidung getroffen wurde.
- `project_slugs`, `topic_slugs`, `project_matches` und `topic_matches` sind optional und nur nötig, wenn spätere Mehrfachkontexte oder Evidenzlisten bewusst dokumentiert werden sollen.
- `classification_*` und `classification_basis` steuern Nacharbeit, Nachvollziehbarkeit und Review.
- `review_*` und `classifier_mode` markieren Fälle, die nach dem Sync durch den aufrufenden Agenten im Chat weiterbearbeitet werden sollen.
- `llm_review_*` halten den Nachgang getrennt von der Intake-Synchronisierung fest.
- `server_*` ermöglicht das Erkennen späterer Änderungen am Fireflies-Meeting auch ohne offizielles `updated_at`-Feld.

### Frontmatter (Writer-Ausgabe)

Frontmatter wird **vom kanonischen Writer** erzeugt. Der Adapter liefert nur die Markdown-Bodies (`summary_md`, `transcript_md`) und Raw (`transcript_raw_md`); er schreibt oder aktualisiert keine Frontmatter. Das folgende Legacy-Fireflies-Beispiel dokumentiert bestehende Bestände und dient nicht als Adapter-Ausgabevertrag.

Bestehende, reichere Frontmatter-Felder bleiben lesbar:

```yaml
---
meeting_id: "meeting-id"
title: "Meeting Title"
slug: "meeting-title"
date: 1776757200000
dateString: "2026-04-21T07:40:00.000Z"
duration: 42
channel: "CHANNEL-TITLE"
channel_slug: "channel-slug"
channel_id: "channel-id"
channels: ["CHANNEL-TITLE"]
project_slug: null
topic_slug: null
classification_status: "unmapped"
classification_confidence: "low"
classification_notes: ["chat-review-classification-pending"]
classification_basis: ["channel:channel-slug"]
review_recommended: true
review_reason: "chat-review-classification-required"
llm_review_status: "pending"
transcript_url: "https://app.fireflies.ai/view/..."
meeting_link: null
organizer_email: "account@example.com"
host_email: null
calendar_id: null
cal_id: null
calendar_type: null
participants_count: 1
participants: ["account@example.com"]
speakers_count: 2
speakers: ["Speaker A", "Speaker B"]
meeting_attendees_count: 0
meeting_attendance_count: 0
shared_with_count: 0
shared_with: []
apps_present: false
apps_count: 0
meeting_info_fred_joined: true
meeting_info_silent_meeting: false
meeting_info_summary_status: "processed"
has_summary: true
has_full_transcript: true
audio_url_present: false
video_url_present: false
analytics_present: false
summary_keywords: ["keyword-1", "keyword-2"]
summary_meeting_type: null
summary_topics_discussed: []
summary_path: "memory/references/meetings/channel-slug/2026-04-21-meeting-title.summary.md"
transcript_path: "memory/references/meetings/channel-slug/2026-04-21-meeting-title.transcript.md"
server_change_status: "new"
server_changed_since_last_sync: false
first_synced_at: "2026-04-21T12:00:00Z"
last_synced_at: "2026-04-21T12:05:00Z"
source_system: "fireflies"
source_account_ref: "account@example.com"
---
```

Praktische Regel:

- **`meetings.json`** ist der kanonische Index und Routing-/Review-Zustand des Writers.
- **Frontmatter** wird nur vom Writer erzeugt und trägt die reicheren Metadaten für die Dateiinspektion.
- Der Adapter schreibt weder Frontmatter noch Register und liefert nur Record-Artefakte.

### Markdown-Body der Summary-Datei (Writer ergänzt Frontmatter)

```md
# <Meetingtitel>

# <Meetingtitel>

## Kurzüberblick
- Datum:
- Dauer:
- Channel:
- Organizer:
- Teilnehmer:
- Transcript URL:

## Summary

### Executive Summary

### Key Points
- 
- 
- 

### Decisions
- 

### Action Items
- [ ] 

### Open Questions
- 

### Participants and Speakers
- 

### Analytics Snapshot
- Sentiment:
- Kategorien:
- Speaker Insights:

### Related Systems
- Meeting Link:
- Calendar:
- Channels:
- Shared With:

### Source Notes
- Fireflies Meeting ID:
- Last Synced:
- Data Completeness:
```

### Markdown-Body der Volltranskript-Datei (Writer ergänzt Frontmatter)

```md
# <Meetingtitel> - Volltranskript

# <Meetingtitel> - Volltranskript

## Metadaten
- Meeting ID:
- Datum:
- Dauer:
- Channel:
- Transcript URL:

## Volltranskript

### Rohtext oder strukturierte Sätze

#### 00:00 Speaker Name
Text...

#### 00:18 Speaker Name
Text...
```

## Praktische Regeln für den Skill

- Standardmäßig nur die wirklich benötigten Felder abfragen.
- Für Listenansichten klein beginnen, zum Beispiel `id`, `title`, `date`, `transcript_url`.
- `audio_url`, `video_url` und `analytics` nur gezielt anfordern, weil planabhängig.
- Bei Live-Meetings beachten: Wenn `is_live=true`, liefert das Transcript-Feld für Sätze laut Doku Live-Captions statt verarbeitetem Endtranskript.
- Deprecated-Felder möglichst meiden.
- Für die lokale Ablage den kanonischen Writer verwenden, statt neue Ad-hoc-Strukturen zu erfinden; der Adapter liefert nur `meeting-record/1`.
- `meetings.json` ist die kanonische Metadatenquelle des Writers. Frontmatter wird nur vom Writer erzeugt.
- Für Update-Erkennung kein offizielles `updated_at` erfinden, sondern lokale Vergleichslogik über `server_fingerprint` und `server_change_status` verwenden; der Adapter liest den alten Fingerprint und schreibt das Ergebnis nur inert in `source_metadata`.

## Quelle

- Transcript Schema
  - URL: <https://docs.fireflies.ai/schema/transcript>
  - Gelesen: 2026-04-21
