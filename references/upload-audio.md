# Fireflies Upload Audio

Stand: 2026-04-21

## Zweck

Die Mutation `uploadAudio` lädt Audio oder Video zur Transkription in Fireflies hoch.

## Endpoint und Auth

- Endpoint: `https://api.fireflies.ai/graphql`
- Auth: `Authorization: Bearer <api_key>`

## Minimales Beispiel

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "query": "mutation($input: AudioUploadInput) { uploadAudio(input: $input) { success title message } }",
    "variables": {
      "input": {
        "url": "https://url-to-the-audio-file",
        "title": "title of the file"
      }
    }
  }' \
  https://api.fireflies.ai/graphql
```

## Wichtige Input-Felder

- `url` (required)
  - muss eine gültige `https`-URL sein
  - muss öffentlich erreichbar und tatsächlich herunterladbar sein
  - keine Vorschau-URL verwenden
  - erlaubte Formate laut Doku: `mp3`, `mp4`, `wav`, `m4a`, `ogg`
- `title`
  - Name des Meetings bzw. der Datei
- `webhook`
  - URL für Benachrichtigungen nach Abschluss der Transkription
- `custom_language`
  - Sprachcode, z. B. `de` oder `es`
- `save_video`
  - steuert, ob Video gespeichert werden soll
- `attendees`
  - Liste von Teilnehmerobjekten mit `displayName`, `email`, `phoneNumber`
  - relevant für CRM-Integrationen
- `client_reference_id`
  - eigener Bezeichner zur Korrelation mit Webhook-Events

## Erwartete Antwort

Typisch laut Doku:
- `success`
- `title`
- `message`

Beispielmeldung:
- Upload wurde zur Verarbeitung in die Queue gestellt

## Praktische Regeln für den Skill

- Vor Upload prüfen, ob die Datei-URL wirklich direkt downloadbar ist.
- Wenn Folgeautomatisierung geplant ist, `client_reference_id` setzen.
- Bei asynchronem Flow Webhook oder späteres Nachladen des Meetings einplanen.
- Uploads zuerst klein und reproduzierbar testen.

## Quelle

- Mutation: Upload Audio
  - URL: https://docs.fireflies.ai/graphql-api/mutation/upload-audio
  - Gelesen: 2026-04-21
