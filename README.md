# fireflies-api skill

Kompakter Skill für Fireflies GraphQL-Workflows (Meetings, Channels, Transcript-Intake).

## Inhalt

- [SKILL.md](SKILL.md): Arbeitsregeln und Einsatzbereich des Skills
- [scripts/](scripts/): wiederverwendbare Node-Skripte für Fireflies API und lokalen Sync
- [references/](references/): kuratierte Fachreferenzen zur Fireflies-Doku

## Voraussetzungen

- Node.js (empfohlen: aktuelles LTS oder neuer)
- Secrets in einer der folgenden Dateien:
  - `~/.openclaw/secrets.json`
  - `secrets.json` im Workspace-Root (Fallback)
- Wichtige Sicherheitsregel: `secrets.json` niemals committen oder in Pull Requests aufnehmen.

Erwartete Struktur:

```json
{
  "integrations": {
    "fireflies": {
      "accounts": {
        "<email>": {
          "apiKey": "YOUR_FIREFLIES_API_KEY"
        }
      }
    }
  }
}
```

## Schnellstart

Vom Repo-Root [skills/fireflies-api](skills/fireflies-api):

```bash
node scripts/list-channels.mjs
node scripts/list-meetings.mjs --limit 5
```

## Lizenz

MIT, siehe [LICENSE](LICENSE).
