# Fireflies Summary-Felder

Stand: 2026-04-30

## Zweck

Lokale Referenz für Summary-Felder aus Fireflies, besonders für Fälle, in denen die Web-Ansicht umfangreicher wirkt als unsere aktuelle API-Nutzung.

## Wichtige Beobachtung

Die Web-Ansicht kann umfangreicher sein als das, was unsere aktuellen Skripte ziehen, **auch ohne dass die API prinzipiell weniger kann**.

Grund:
- unsere bisherigen Queries nutzen nur einen Teil der verfügbaren Summary-Felder
- insbesondere fehlen aktuell in unseren Skripten:
  - `summary.notes`
  - `summary.extended_sections`

## Summary-Schema

Laut Doku umfasst `summary` u. a.:
- `action_items`
- `keywords`
- `outline`
- `overview`
- `shorthand_bullet`
- `notes`
- `gist`
- `bullet_gist`
- `short_summary`
- `short_overview`
- `meeting_type`
- `topics_discussed`
- `transcript_chapters`
- `extended_sections`

## Extended Sections

`extended_sections` ist ein Array von `SummarySection`-Objekten mit:
- `title`
- `content`

Laut Doku sind das:
- optionale, erweiterte Summary-Abschnitte
- sie entstehen durch Anpassung der Summary im Fireflies-Dashboard

Das ist sehr wahrscheinlich die naheliegendste Erklärung für "in der Web-Ansicht sehe ich mehr als über unsere aktuelle API-Antwort".

## Praktische Konsequenz für diesen Skill

Wenn eine Fireflies-Webansicht reichere Summary-Blöcke zeigt, sollten wir gezielt zusätzlich abfragen:

```graphql
summary {
  notes
  extended_sections {
    title
    content
  }
}
```

Optional weiter relevant:
- `transcript_chapters`
- `topics_discussed`
- `meeting_type`

## Umsetzungshinweis

- Diese Felder eher im Frontmatter oder im Markdown-Body der Meeting-Datei sichtbar machen.
- `meetings.json` eher kompakt halten.
- Für bestehende Sync-Skripte genügt meist eine Erweiterung der Summary-Feldauswahl und eine kontrollierte Ausgabe in die Markdown-Dateien.

## Quellen

- Summary Schema
  - URL: https://docs.fireflies.ai/schema/summary.md
  - Gelesen: 2026-04-30
- SummarySection Schema
  - URL: https://docs.fireflies.ai/schema/summary-section.md
  - Gelesen: 2026-04-30
- Transcript Query
  - URL: https://docs.fireflies.ai/graphql-api/query/transcript.md
  - Gelesen: 2026-04-30
