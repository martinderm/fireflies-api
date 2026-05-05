# Fireflies Auth

Stand: 2026-04-21

## Kurzfassung

- Fireflies verwendet tokenbasierte Authentifizierung mit Bearer Token.
- API-Requests gehen an `https://api.fireflies.ai/graphql`.
- Der Header lautet: `Authorization: Bearer <api_key>`.

## Lokale Secret-Konvention

- Lokaler Speicherort: `~/.openclaw/secrets.json`
- Für einen eingerichteten Account:
  - `integrations.fireflies.accounts["<email>"].apiKey`
- Wegen Sonderzeichen in der Mailadresse immer String-Key-Notation verwenden.

## Token beschaffen

Laut Doku:
1. In Fireflies einloggen
2. Bereich `Integrations` öffnen
3. `Fireflies API` öffnen
4. API-Key kopieren und sicher speichern

## Minimalbeispiel

```bash
curl \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --data '{ "query": "{ user { name integrations } }" }' \
  https://api.fireflies.ai/graphql
```

## Hinweise

- API-Key wie ein Passwort behandeln.
- Nicht in clientseitigem Code oder öffentlichen Repos speichern.
- Bei `auth_failed` zuerst Authorization-Header prüfen.
- Bei Fehlern auch auf fehlenden oder abgelaufenen Key prüfen.

## Quelle

- Authorization
  - URL: https://docs.fireflies.ai/fundamentals/authorization
  - Gelesen: 2026-04-21
