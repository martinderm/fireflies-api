# fireflies-api skill

Kompakter Skill für Fireflies GraphQL-Workflows (Meetings, Channels, Transcript-Intake).
Der Skill ist ein **Record-Adapter**: er transformiert Fireflies-Payloads in
`meeting-record/1` und delegiert jede Meeting-Ablage an den kanonischen
`meeting-desk`-Writer. Er schreibt selbst weder Meeting-Dateien noch
`meetings.json`; die einzige, ausdrücklich operator-invokierte Ausnahme ist die
einmalige Legacy-Register-Migration (siehe unten).

## Inhalt

- [SKILL.md](SKILL.md): Arbeitsregeln und Einsatzbereich des Skills
- [scripts/](scripts/): Node-Skripte für Fireflies API, Record-Transformation und Writer-Transport
- [references/](references/): kuratierte Fachreferenzen inklusive Record-Vertrag

## Voraussetzungen

- Node.js (empfohlen: aktuelles LTS oder neuer)
- Python 3 und der kanonische Writer `meeting-desk/scripts/ingest_meeting.py` für Sync-Läufe
- Ein Trusted Workspace-Lock-Root (`workspace-lock`) und eine aktive, eigene Lease für Schreibvorgänge; der Export importiert den Shared Guard `workspace_lock_guard.py` in place (`allow_legacy=False`). Die Lease-ID ist eine kooperative Zusicherung, keine kryptografische Aufruferidentität.
- Python 3 und ein erreichbarer OI-`verify_meeting_fixtures.py` für die erforderliche Cross-Repo-Konformitätsprüfung
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

Vom Repo-Root (Verzeichnis dieses README):

```bash
node scripts/list-channels.mjs
node scripts/list-meetings.mjs --limit 5
node scripts/get-meeting.mjs <transcriptId> --format markdown
```

Record-Export (nur unter `<workspace>/data/`, no-clobber):

```bash
node scripts/get-meeting.mjs <transcriptId> \
  --output data/meeting.meeting-export.json \
  --lease-id <lease> \
  --workspace-lock-root <skill-root>/workspace-lock
```

Kanonischer Sync (keine eigenen Meeting-Writes):

```bash
node scripts/sync-meetings-to-memory.mjs \
  --meeting-writer <skill-root>/meeting-desk/scripts/ingest_meeting.py \
  --python <python> \
  --workspace-lock-root <skill-root>/workspace-lock \
  --lease-id <lease> \
  [--project <slug>] [--topic <slug>] [--event <slug>] [--dry-run]
```

Legacy-Register einmalig migrieren (nur wenn `meetings.json` noch ein nacktes
JSON-Array ist):

```bash
node scripts/migrate-meetings-registry.mjs [--meetings-root <path>] [--dry-run] [--json]
```

- Einmaliger Operator-Vorgang, **kein Sync-Fallback**: der Sync bleibt read-only,
  schreibt `meetings.json` nie und bricht bei einem Legacy-Array fail-closed ab;
  seine Fehlermeldung nennt dieses Migrationskommando.
- Die Migration führt genau eine begrenzte Transition aus (Legacy-Array-Root ->
  kanonischer Objekt-Root), erhält alle Einträge und unbekannten Felder, ergänzt
  `meeting_id` nur wenn sie fehlt und validiert vor jeder Mutation.
- Sie schreibt ausschließlich `meetings.json` (keine Meeting-Dateien, keine
  Fireflies-API, keine Secrets), atomar als kanonisches JSON (2 Spaces, LF,
  Trailing Newline); ein bereits kanonisches Register bleibt bytegleich und
  unverändert.
- Exit 0 bei `migrated`/`already_current`/`dry_run`, Exit 2 bei jeder Ablehnung.
  `--meetings-root` löst relative Pfade gegen den Workspace-Root auf.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
