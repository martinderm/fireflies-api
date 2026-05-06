# Fireflies Transcript Data Model

Stand: 2026-04-21

## Zweck

Diese Referenz sammelt die wichtigsten Felder des Fireflies-`Transcript`-Schemas, damit bei Feldwahl und Query-Design nicht jedes Mal die Web-Doku nötig ist.

## Wichtige Transcript-Felder

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

## Meeting-Ablage unter `memory/references/meetings/`

Wenn Meeting-Daten lokal gespiegelt werden, nutze diese Struktur.

### Ordnerstruktur

```text
memory/
  references/
    meetings/
      meetings.json
      <channel-slug>/
        <date>-<meeting-slug>.summary.md
        <date>-<meeting-slug>.transcript.md
```

Regeln:

- `meetings.json` im Hauptordner pflegen.
- Für den Ordnernamen standardmäßig den ersten Eintrag aus `channels` verwenden.
- Wenn `channels` leer ist, sinnvollen Fallback wie `ohne-channel` verwenden.
- Slugs stabil, lesbar und dateisystemfreundlich halten.
- Summary und Volltranskript als getrennte Dateien speichern.
- Dieselbe Struktur gilt auch für manuell importierte Transkripte, zum Beispiel aus Zoom oder aus lokalen Ablageordnern.

### `meetings.json` Schema, kompakte Produktivversion

Neutral als Top-Level-Objekt mit getrennten Bereichen für Sync-Strategie, Mapping und Meetings.

Regel:

- `meetings.json` ist **kanonischer Index + Routing-/Review-Zustand**.
- Reichere Meeting-Metadaten sollen bevorzugt im **Frontmatter** der Meeting-Dateien liegen.
- `meetings.json` soll daher kompakt bleiben und keine unnötig großen Detailblöcke duplizieren.

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
      "mapping_source": "manual",
      "notes": "Context-Intake-Channel. Fachliche Zuordnung erfolgt nachgelagert pro Meeting lokal."
    }
  },
  "meetings": [
    {
      "meeting_id": "meeting-id",
      "title": "Meeting Title",
      "slug": "meeting-title",
      "date": 1776757200000,
      "dateString": "2026-04-21T07:40:00.000Z",
      "duration": 42,
      "channel": "CHANNEL-TITLE",
      "channel_slug": "channel-slug",
      "channel_id": "channel-id",
      "channels": ["CHANNEL-TITLE"],
      "project_slug": null,
      "topic_slug": null,
      "project_slugs": [],
      "topic_slugs": [],
      "project_matches": [],
      "topic_matches": [],
      "classification_status": "unmapped",
      "classification_confidence": "low",
      "classification_notes": ["chat-review-classification-pending"],
      "classification_basis": ["channel:channel-slug"],
      "review_recommended": true,
      "review_reason": "chat-review-classification-required",
      "classifier_mode": "chat-review",
      "review_input": {
        "source": "sync-intake",
        "title": "Meeting Title",
        "channel": "CHANNEL-TITLE",
        "channel_slug": "channel-slug",
        "routing_mode": "unmapped",
        "keywords": ["keyword-1", "keyword-2"],
        "project_slug": null,
        "topic_slug": null,
        "classification_status": "unmapped",
        "classification_confidence": "low",
        "classification_basis": ["channel:channel-slug"],
        "review_recommended": true,
        "review_reason": "chat-review-classification-required"
      },
      "llm_review_status": "pending",
      "llm_review_summary": null,
      "resolved_by": null,
      "resolved_at": null,
      "transcript_url": "https://app.fireflies.ai/view/...",
      "meeting_link": null,
      "organizer_email": "account@example.com",
      "host_email": null,
      "participants_count": 1,
      "speakers_count": 2,
      "meeting_attendees_count": 0,
      "meeting_attendance_count": 0,
      "shared_with_count": 0,
      "is_live": false,
      "meeting_info_summary_status": "processed",
      "has_summary": true,
      "has_full_transcript": true,
      "summary_keywords": ["keyword-1", "keyword-2"],
      "summary_has_notes": true,
      "summary_extended_sections_count": 1,
      "summary_path": "memory/references/meetings/channel-slug/2026-04-21-meeting-title.summary.md",
      "transcript_path": "memory/references/meetings/channel-slug/2026-04-21-meeting-title.transcript.md",
      "audio_url_present": false,
      "video_url_present": false,
      "analytics_present": false,
      "apps_present": false,
      "apps_count": 0,
      "server_fingerprint": "sha256...",
      "server_change_status": "unchanged",
      "server_changed_since_last_sync": false,
      "first_synced_at": "2026-04-21T12:00:00Z",
      "last_synced_at": "2026-04-21T12:05:00Z",
      "source": {
        "system": "fireflies",
        "account_ref": "account@example.com",
        "endpoint": "https://api.fireflies.ai/graphql"
      }
    }
  ]
}
```

### Manuelle Imports und neutrale Quellen

Das Meeting-Schema ist nicht auf Fireflies beschränkt. Es darf auch für manuell importierte Transkripte verwendet werden, zum Beispiel aus Zoom-Sessions, Chat-Datei-Uploads oder lokalen Ordnern wie `Agent-Share/`.

Regeln:

- manuelle Imports werden in dieselbe `meetings.json` und dieselbe Ordnerstruktur geschrieben wie Fireflies-Meetings
- Summary-Datei und optional Volltranskript-Datei bleiben gleich aufgebaut
- wenn kein Channel vorhanden ist, `channel` und `channel_slug` neutral oder leer lassen und den Fallback-Ordner verwenden
- Quelle immer im `source`-Block dokumentieren

Empfohlene `source.system` Werte:

- `fireflies`
- `zoom`
- `manual-import`
- `other`

Empfohlene Zusatzfelder im `source`-Block:

- `import_mode`
  - zum Beispiel `chat-upload`, `local-folder`, `manual-paste`
- `origin_path`
  - ursprünglicher Dateipfad oder Ablagepfad, wenn lokal bekannt
- `origin_name`
  - ursprünglicher Dateiname oder Quellname
- `summary_origin`
  - empfohlene Werte: `fireflies`, `local-from-transcript`, `manual-curated`, `unknown`

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

- `project_slugs`
  - optionale Liste zusätzlicher Projektzuordnungen, falls später mehr als ein Projekt dokumentiert werden soll
- `topic_slugs`
  - optionale Liste zusätzlicher Topiczuordnungen, falls später mehr als ein Topic dokumentiert werden soll
- `project_matches`
  - optionales Feld für spätere Kandidatenlisten, falls der Agent solche Evidenz gesondert dokumentiert
- `topic_matches`
  - optionales Feld für spätere Kandidatenlisten, falls der Agent solche Evidenz gesondert dokumentiert
- `classification_status`
  - aktueller Klassifikationszustand des Meetings
  - empfohlene Werte: `mapped`, `candidate`, `unmapped`
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

### Frontmatter-Template, erweitert

Für Summary-Datei und Volltranskript einen **reicheren Frontmatter-Block** verwenden. `meetings.json` bleibt die kanonische Index- und Routingdatei, soll aber gegenüber Frontmatter und Markdown eher **kompakt** bleiben.

Empfohlene Frontmatter-Felder:

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

- **Frontmatter** trägt die reicheren Meeting-Metadaten für direkte Dateiinspektion.
- **`meetings.json`** hält denselben Kernzustand weiterhin zentral, aber möglichst ohne unnötig große Detailblöcke.

### Markdown-Schema für Summary-Datei, Maximalversion

```md
---
<Frontmatter laut Template oben>
---

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

### Markdown-Schema für Volltranskript-Datei, Maximalversion

```md
---
<Frontmatter laut Template oben>
---

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
- Für die lokale Ablage immer zuerst dieses Schema verwenden, statt neue Ad-hoc-Strukturen zu erfinden.
- `meetings.json` ist die kanonische Metadatenquelle. Der Frontmatter in den Markdown-Dateien bleibt absichtlich minimal.
- Für Update-Erkennung kein offizielles `updated_at` erfinden, sondern lokale Vergleichslogik über `server_fingerprint` und `server_change_status` verwenden.

## Quelle

- Transcript Schema
  - URL: <https://docs.fireflies.ai/schema/transcript>
  - Gelesen: 2026-04-21
