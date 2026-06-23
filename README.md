# fireflies-api skill

Kompakter Skill für Fireflies GraphQL-Workflows (Meetings, Channels, Transcript-Intake).

## Inhalt

- [SKILL.md](SKILL.md): Arbeitsregeln und Einsatzbereich des Skills
- [scripts/](scripts/): wiederverwendbare Node-Skripte für Fireflies API und lokalen Sync
- [references/](references/): kuratierte Fachreferenzen zur Fireflies-Doku

## Voraussetzungen

- Node.js (empfohlen: aktuelles LTS oder neuer)
- Der Skill soll in Agent-Workspaces lokal unter `.agents/skills/fireflies-api` verlinkt sein, damit Workspace-Kontext und lokale Secrets konsistent aufgeloest werden.
- Secrets in einer der folgenden Dateien:
  - `.agents/secrets.json` im Workspace-Root (bevorzugt)
  - `secrets.json` im Workspace-Root (Fallback)
  - `~/.openclaw/secrets.json`
- Wichtige Sicherheitsregel: `secrets.json` niemals committen oder in Pull Requests aufnehmen.
- CLI-Aufrufe bevorzugt aus dem Agent-Workspace-Root starten. Wenn direkt aus dem Shared-Skill-Ordner gearbeitet wird, `WORKSPACE_ROOT` explizit setzen.

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
