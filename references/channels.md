# Fireflies Channels

Stand: 2026-04-22

## Zweck

Diese Referenz sammelt das lokale Wissen zu Fireflies-Channels für spätere gezielte Nutzung ohne erneuten Webzugriff.

## Strategische Änderung wegen knapper Channels

Für die aktuelle Fireflies-Free-Nutzung gilt lokal die Annahme:
- es stehen effektiv nur wenige Channels zur Verfügung
- beim Sync wird der für den jeweiligen Arbeitskontext relevante Channel als Parameter übergeben
- dieser Channel dient nur als Sammel- und Intake-Channel für den jeweiligen Kontext
- Fireflies-Channels sind keine belastbare Projekt- oder Topic-Taxonomie
- die fachliche Zuordnung erfolgt nachgelagert über den kanonischen Writer, nicht im Adapter

Konsequenz:
- Channel = grober Container
- der Writer-/Registerzustand ist Source of Truth für spätere Projekt-/Topic-Klassifikation
- der Adapter liefert nur `meeting-record/1`; Channel-Evidenz reist inert in `source_metadata`, nicht als Klassifikation

## Channel-Schema

- `id`
  - eindeutige Channel-ID
- `title`
  - Titel des Channels
- `is_private`
  - ob der Channel privat ist
- `created_by`
  - E-Mail des erstellenden Users
- `created_at`
  - Erstellungszeitpunkt
- `updated_at`
  - letzter Änderungszeitpunkt
- `members`
  - Mitgliederliste

## Praktische Regeln

- Für Listenabfragen zuerst kleine Feldauswahl verwenden, zum Beispiel `id`, `title`, `is_private`.
- Mit knappen Channels sparsam umgehen; keine fachliche Feingliederung über neue Channels aufbauen.
- Der relevante Context-Channel wird beim Sync-Aufruf übergeben, nicht fest im Skript verdrahtet.
- Channel-Zugehörigkeit nur als Intake- und Relevanzhinweis verwenden, nicht als endgültige Fachklassifikation.

## Lokale Zuordnung

### Kanal → Context-Intake-Regel

- der beim Sync übergebene Context-Channel
  - Regel: Meetings werden für diesen Kontext eingesammelt und als Records an den Writer gegeben
  - Routing Mode: initial `unmapped`
  - Notiz: fachliche Zuordnung zu Projekt und/oder Topic erfolgt erst nachgelagert über den Writer

## Empfehlung für Routing

- Verwende Channels primär als groben Intake- und Relevanzfilter.
- Behandle den jeweils übergebenen Context-Channel als Inbox für den aktuellen Arbeitskontext, nicht als Projekt- oder Topic-Etikett.
- Verzichte auf künstliche Channel-Rollenlogik; für den aktuellen Betrieb reicht ein generischer Inbox-Charakter.
- Führe Projekt-/Topic-Klassifikation erst nach dem Sync über den Writer durch.
- Inhalt schlägt Channel; die validierte Operator-/Katalogentscheidung schlägt jede bloße Channel-Namensähnlichkeit.
- Der Adapter setzt niemals `project_slug`/`topic_slug` und schreibt kein Register.

## Quellen

- Channel Schema
  - URL: https://docs.fireflies.ai/schema/channel
  - Gelesen: 2026-04-21
- Lokale Architekturentscheidung
  - Grund: knappe Channel-Anzahl in Fireflies-Free-Nutzung
  - Festgehalten: 2026-04-22
