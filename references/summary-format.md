# Fireflies-like Meeting Summary Format

Stand: 2026-04-21

## Zweck

Diese Referenz beschreibt, wie eine Meeting-Summary aufgebaut werden soll, wenn nur ein Transcript vorliegt und keine fertige Fireflies-Summary verfügbar ist. Ziel ist keine freie Fantasie-Zusammenfassung, sondern eine Struktur, die sich eng an der beobachteten Fireflies-Summary orientiert.

## Beobachtete Fireflies-Summary-Struktur

Aus einer vorhandenen Fireflies-Meeting-Summary und mehreren bereits lokal gespiegelt formatierten Summary-Dateien wurden diese typischen Felder und Muster bestätigt:

- `overview`
  - mehrere Kernpunkte als prägnante Bullet-Zusammenfassung
- `action_items`
  - Aufgaben, nach Möglichkeit nach Sprecher oder Verantwortungsbereich gruppiert
- `keywords`
  - kurze Liste zentraler Begriffe oder Themen
- `outline`
  - optional, kann fehlen
- `shorthand_bullet`
  - strukturierte Abschnittszusammenfassung mit Emojis, Themenblöcken und Zeiträumen
- `notes`
  - ausführliche, gegliederte Langfassung mit Unterüberschriften und Bulletpoints
- `gist`
  - Ein-Satz-Zusammenfassung
- `bullet_gist`
  - wenige Bulletpoints mit Emojis
- `short_summary`
  - ein kompakter Absatz
- `short_overview`
  - optional, kann fehlen
- `meeting_type`
  - optional, kann fehlen
- `topics_discussed`
  - optional, kann fehlen
- `transcript_chapters`
  - optionale Kurzkapitel
- `extended_sections`
  - optionale Zusatzabschnitte

## Anleitung für manuell erzeugte Summary

Wenn nur ein Transcript vorhanden ist, erstelle eine Meeting-Summary in dieser Reihenfolge:

1. Transcript lesen und Hauptthemen identifizieren.
2. Entscheidungen, Aufgaben, offene Fragen und Verantwortlichkeiten herausziehen.
3. Wiederkehrende Begriffe als `keywords` verdichten.
4. Eine kurze Ein-Satz-Zusammenfassung (`gist`) schreiben.
5. Einen kompakten Absatz (`short_summary`) formulieren.
6. Eine knappe Bullet-Zusammenfassung (`bullet_gist`) mit maximal 4 bis 8 Punkten erstellen.
7. Eine etwas ausführlichere Kernpunktliste (`overview`) erstellen.
8. Eine gegliederte Langfassung (`notes`) schreiben.
9. Nur wenn das Transcript genügend Struktur bietet, zusätzlich `shorthand_bullet`, `outline`, `topics_discussed` oder `transcript_chapters` erzeugen.

## Priorität der Felder

### Pflichtfelder für manuelle Summary
- `gist`
- `short_summary`
- `overview`
- `bullet_gist`
- `notes`

### Stark empfohlen
- `action_items`
- `keywords`

### Optional nur bei belastbarer Grundlage
- `shorthand_bullet`
- `outline`
- `short_overview`
- `meeting_type`
- `topics_discussed`
- `transcript_chapters`
- `extended_sections`

## Stilregeln

- sachlich, knapp, nachvollziehbar
- keine erfundenen Entscheidungen oder Aufgaben
- Unsicherheit lieber als Unsicherheit markieren
- Aufgaben nur dann als Action Item formulieren, wenn sie im Transcript wirklich angelegt sind
- Sprecherzuordnung nur dann nennen, wenn sie im Transcript belastbar erkennbar ist
- Bei schwachem Transcript keine künstliche Präzision vortäuschen

## Beobachtete Muster in den lokal gespiegelten Summary-Dateien

Die vorhandenen lokalen Summary-Dateien in `boku-martin` zeigen zusätzlich diese nützlichen Muster:

- oberhalb der eigentlichen Summary steht ein kurzer Block `Kurzüberblick`
  - typischerweise mit Datum, Dauer, Channel, Organizer, Teilnehmern und Transcript-URL
- `Executive Summary`
  - entspricht praktisch dem kompakten Fließtext aus `short_summary`
- `Key Points`
  - entspricht in der Praxis gut dem Feld `bullet_gist`
  - meist 4 bis 6 Punkte mit Emojis
- `Decisions`
  - wird auch dann als eigener Abschnitt geführt, wenn aktuell keine klaren Entscheidungen vorliegen
  - in diesen Fällen steht nur `-`
- `Action Items`
  - werden häufig nach Verantwortlichen gruppiert
  - Sprecher oder Zuständige stehen als fett gesetzte Zwischenüberschrift
  - darunter folgen einfache Bulletpoints, keine Checkboxen
- `Open Questions`
  - ebenfalls eigener Abschnitt, auch wenn leer
- `Participants and Speakers`
  - knapper Überblick mit Teilnehmern und Sprecherliste
- `Analytics Snapshot`
  - auch dann aufführen, wenn Analytics nicht abgefragt wurden
  - dann explizit `nicht abgefragt` notieren
- `Related Systems`
  - Platz für Meeting Link, Calendar, Channels, Shared With
- `Source Notes`
  - Fireflies-ID, letzter Sync, Vollständigkeit und Klassifikationshinweise

## Empfohlene Markdown-Struktur für lokale Summary-Datei

Die lokale Summary-Datei unter `memory/references/meetings/...summary.md` soll sich inhaltlich an dieser Feldlogik und an den beobachteten lokalen Dateien orientieren.

```md
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
<kurzer Absatz, orientiert an `short_summary`>

### Key Points
- Punkt 1
- Punkt 2
- Punkt 3

### Decisions
- 

### Action Items
- **<Verantwortlich oder Sprecher>**
- Aufgabe 1
- Aufgabe 2
- **Unassigned**
- Aufgabe 3

### Open Questions
- 

### Participants and Speakers
- Teilnehmer:
- Speakers:

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
- Classification Notes:

## Optionaler Rohstoff für spätere Weiterverarbeitung

### Gist
<ein Satz>

### Overview
- Punkt 1
- Punkt 2
- Punkt 3

### Keywords
- keyword-1
- keyword-2
- keyword-3

### Notes
### Shorthand Bullet
### Outline
### Topics Discussed
### Transcript Chapters
### Extended Sections
```

## Regel für transcript-only Fälle

Wenn nur ein Transcript vorhanden ist und keine Fireflies-Summary mitgeliefert wird:
- immer eine eigene Meeting-Summary erzeugen
- die Summary nach obigem Schema schreiben
- bevorzugt die lokal beobachtete Abschnittsfolge verwenden: `Kurzüberblick` -> `Summary` -> `Executive Summary` -> `Key Points` -> `Decisions` -> `Action Items` -> `Open Questions` -> `Participants and Speakers` -> `Analytics Snapshot` -> `Related Systems` -> `Source Notes`
- `Decisions` und `Open Questions` auch dann beibehalten, wenn aktuell nichts Belastbares vorliegt; dann schlicht `-` schreiben
- `Action Items` nur als Aufgabenblock aus dem Transcript ableiten, nicht künstlich aufblasen
- in `meetings.json` kenntlich machen, dass die Summary lokal erzeugt wurde
- im `source`- oder Betriebskontext markieren, ob die Summary von Fireflies stammt oder lokal aus dem Transcript abgeleitet wurde

## Quelle

- Beobachtete API-Antwort aus vorhandenem Fireflies-Meeting
  - Transcript ID: `01KPQFT3J7DKHMXKEMRNYD2MZE`
  - Gelesen: 2026-04-21
- Beobachtete lokale Summary-Dateien in `boku-martin`
  - `2026-04-21-core-competence-ai-part-1.summary.md`
  - `2026-04-21-core-competence-ai-part-2.summary.md`
  - `2026-04-09-github-copilot-integration-and-challenges-meeting.summary.md`
  - Gelesen: 2026-04-21
- Summary Schema
  - URL: https://docs.fireflies.ai/schema/summary
  - Gelesen: 2026-04-21
- Summary Section Schema
  - URL: https://docs.fireflies.ai/schema/summary-section
  - Gelesen: 2026-04-21
