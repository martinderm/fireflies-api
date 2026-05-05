# Fireflies Capability Matrix

Stand: 2026-04-21

Zweck: Einordnung, was für den Skill sofort sinnvoll ist, was später als Tool taugt und was vorerst niedrige Priorität hat.

## Jetzt sinnvoll im Skill

### Transcript- und Meeting-Daten lesen
- Nutzen: hoch
- Warum: Kern-Use-Case für Fireflies
- Typisch: Titel, Teilnehmer, Sprecher, Sätze, Summary, Meeting-Infos, Analytics, Channels, Sharing-Infos
- Lokale Folge-Dateien: `transcript-queries.md`, `data-model.md`

### Keyword-Suche in Transcripts
- Nutzen: hoch
- Warum: praktisch für Wiederfinden von Inhalten
- Hinweis: `keyword`/`scope`, `title` laut Changelog deprecated zugunsten von Keyword-Suche
- Lokale Folge-Dateien: `transcript-queries.md`

### Audio/Video zur Transkription hochladen
- Nutzen: hoch
- Warum: direkter Input-Flow für eigene Dateien oder Links
- Varianten: öffentliche URL, authentifizierter Download, später auch presigned Upload Flow
- Lokale Folge-Dateien: `upload-audio.md`, `auth.md`

### Webhooks für fertige Transkripte/Summaries
- Nutzen: hoch
- Warum: sinnvoll für Automatisierung ohne Polling
- Hinweis: Payload als untrusted input behandeln, danach Daten lieber per API nachladen
- Lokale Folge-Dateien: `webhooks.md`

## Später als Tool sinnvoll

### Stabile Transcript-Abfragen
- Priorität: hoch
- Warum als Tool: wiederkehrende GraphQL-Calls, standardisierte Feldauswahl, saubere Fehlerbehandlung
- Mögliche Tool-Aktionen:
  - `get_transcript`
  - `search_transcripts`
  - `get_transcript_summary`

### Upload-Flow kapseln
- Priorität: hoch
- Warum als Tool: Header/Auth/Validierung wiederholen sich, Uploads sind fehleranfälliger als einfache Queries
- Mögliche Tool-Aktionen:
  - `upload_audio`
  - später `create_upload_url`
  - später `confirm_upload`

### Webhook-unterstützte Automatisierung
- Priorität: mittel bis hoch
- Warum als Tool: robuste Verarbeitung, Idempotenz, Nachladen per API, Fehlerbehandlung zentral
- Mögliche Tool-Aktionen:
  - `handle_webhook_event`
  - `refresh_transcript_after_event`

### Meeting-Verwaltung
- Priorität: mittel
- Warum als Tool: wiederholbare Mutations mit klaren Regeln
- Beispiele:
  - `update_meeting_privacy`
  - `update_meeting_channel`
  - `share_meeting`
  - `revoke_shared_meeting_access`
  - `update_meeting_title`
  - `delete_transcript`

## Vorläufig beobachten oder nur bei Bedarf

### Realtime API via WebSocket
- Priorität: mittel
- Nutzen: Live-Captions, Live-Overlays, Realtime-Analyse
- Warum noch nicht zuerst: Beta, mehr Laufzeitlogik, eigener Verbindungs- und Event-Handling-Aufwand
- Lokale Folge-Dateien: `realtime-api.md`

### Active Meetings / Live-Daten
- Priorität: mittel
- Nutzen: Dashboards, Live-Monitoring
- Warum noch nicht zuerst: nur relevant, wenn wir Live-Ansichten oder Realtime-Prozesse bauen
- Lokale Folge-Dateien: `live-meetings.md`

### Analytics, User Groups, AskFred, Apps/Bites
- Priorität: niedrig bis mittel
- Nutzen: je nach späterem Produktfall
- Warum noch nicht zuerst: nicht Kern unseres ersten Fireflies-Flows
- Lokale Folge-Dateien: je eigenes Thema bei Bedarf

## Nicht blind einplanen

### Features mit Plan- oder Produktgrenzen
- Audio/Video-Downloads können planabhängig sein
- Realtime API ist laut Doku Beta
- Nicht alle Fireflies-Daten sind laut Doku vollständig über API verfügbar

## Empfehlung für unsere Reihenfolge

1. `transcript-queries.md`
2. `upload-audio.md`
3. `webhooks.md`
4. `auth.md`
5. danach Tool-Entwurf für Lesen + Upload
6. Realtime erst danach prüfen

## Quellen

- What’s New: https://docs.fireflies.ai/getting-started/whats-new
- Changelog: https://docs.fireflies.ai/additional-info/change-log
- Transcript Schema: https://docs.fireflies.ai/schema/transcript
- Upload Audio: https://docs.fireflies.ai/graphql-api/mutation/upload-audio
- Realtime API Overview: https://docs.fireflies.ai/realtime-api/overview
- Webhooks: https://docs.fireflies.ai/graphql-api/webhooks
