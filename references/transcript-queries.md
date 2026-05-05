# Fireflies Transcript Queries

Stand: 2026-04-21

## Zweck

Die Query `transcripts` liefert eine Liste von Transkripten passend zu Filterargumenten.

## Endpoint und Auth

- Endpoint: `https://api.fireflies.ai/graphql`
- Auth: `Authorization: Bearer <api_key>`

## Minimales Beispiel

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data '{ "query": "query Transcripts($userId: String) { transcripts(user_id: $userId) { title id } }" }' \
  https://api.fireflies.ai/graphql
```

## Wichtige Argumente

- `keyword`
  - sucht in Meeting-Titel und/oder gesprochenen Wörtern
  - mit `scope` kombinierbar
  - max. 255 Zeichen
- `scope`
  - GraphQL-Typ laut Doku: `TranscriptsQueryScope`
  - Optionen: `title`, `sentences`, `all`
  - wenn `scope` gesetzt ist, wird `keyword` erforderlich
  - Default laut Doku: `TITLE`
- `fromDate`
  - GraphQL-Typ laut Doku: `DateTime`
  - ISO-8601-Zeitstempel
  - liefert Transkripte nach diesem Zeitpunkt
- `toDate`
  - GraphQL-Typ laut Doku: `DateTime`
  - ISO-8601-Zeitstempel
  - liefert Transkripte vor diesem Zeitpunkt
- `limit`
  - maximal 50 pro Query
- `skip`
  - Offset/Pagination
- `host_email`
  - filtert nach Host-E-Mail
- `user_id`
  - filtert nach User-ID

## Deprecated laut Doku

- `title`
  - deprecated, stattdessen `keyword` verwenden
  - nicht mit `keyword` kombinieren
- `date`
  - deprecated, stattdessen `fromDate` und `toDate` verwenden
  - historisch Millisekunden seit Epoch
- `organizer_email`
  - deprecated, stattdessen `organizers`
- `participant_email`
  - deprecated, stattdessen `participants`

## Praktische Regeln für den Skill

- Für neue Suche immer `keyword` statt `title` bevorzugen.
- Für Datum immer `fromDate`/`toDate` statt `date` verwenden.
- Feldauswahl klein halten, nur wirklich benötigte Felder abfragen.
- Bei größeren Ergebnismengen Pagination mit `limit` + `skip` einplanen.
- Lokale Beobachtung vom 2026-04-21: Die Doku nennt für `scope` den Typ `TranscriptsQueryScope`, aber der Live-Endpunkt hat bei variablenbasierter Deklaration `Unknown type` geliefert. Für robuste Skripte `scope` daher nur dann verwenden, wenn nötig, und bevorzugt inline statt über eine typisierte GraphQL-Variable einbauen.

## Quelle

- Query: Transcripts
  - URL: https://docs.fireflies.ai/graphql-api/query/transcripts
  - Gelesen: 2026-04-21
