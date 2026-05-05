# Fireflies Webhooks V2

Stand: 2026-04-21

## Zweck

Webhooks V2 liefert ereignisbasierte Benachrichtigungen zu Meeting-Lebenszyklusereignissen.

## Status laut Doku

- Webhooks V2 ist das bevorzugte System.
- Legacy Webhooks V1 sollen auf V2 migriert werden.

## Unterstützte Events

- `meeting.transcribed`
  - feuert, wenn das Meeting transkribiert wurde und das Transcript bereit ist
- `meeting.summarized`
  - feuert, wenn die Summary erzeugt wurde

## Einrichtung laut Doku

1. Webhooks-V2-Konfigurationsseite in Fireflies öffnen
2. gültige `https`-URL eintragen, die `POST` annimmt
3. optional Signing Secret setzen
4. gewünschte Events auswählen
5. speichern

## Payload-Felder

- `event`
  - Eventtyp, z. B. `meeting.transcribed`
- `timestamp`
  - Unix-Timestamp in Millisekunden
- `meeting_id`
  - ID des Meetings
  - laut Doku identisch mit der Transcript-ID in der Fireflies API
- `client_reference_id`
  - optionaler eigener Identifier aus dem Upload-Flow

## Beispiel-Payloads

### meeting.transcribed

```json
{
  "event": "meeting.transcribed",
  "timestamp": 1710876543210,
  "meeting_id": "ASxwZxCstx",
  "client_reference_id": "be582c46-4ac9-4565-9ba6-6ab4264496a8"
}
```

### meeting.summarized

```json
{
  "event": "meeting.summarized",
  "timestamp": 1710876789456,
  "meeting_id": "ASxwZxCstx"
}
```

## Signaturprüfung

- Fireflies nutzt HMAC-SHA256
- Header: `X-Hub-Signature`
- Format: `sha256=<hex-encoded-hmac-sha256-digest>`
- Prüfung laut Doku:
  1. Header lesen
  2. HMAC über den rohen Request-Body mit dem Signing Secret berechnen
  3. `sha256=` voranstellen
  4. timing-safe vergleichen

## Praktische Regeln für den Skill

- Webhook-Payload immer als untrusted input behandeln.
- Bei Event-Verarbeitung nicht blind Payload-Daten vertrauen.
- Nach einem Webhook das Meeting/Transcript bevorzugt per API nachladen.
- Für robuste Zuordnung `client_reference_id` im Upload setzen.

## Quelle

- Webhooks V2
  - URL: https://docs.fireflies.ai/graphql-api/webhooks-v2
  - Gelesen: 2026-04-21
