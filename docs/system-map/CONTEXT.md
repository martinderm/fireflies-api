# System-Map — Lesevertrag

## Inputs
Reference: [Katalog](README.md), [_meta/schema.md](_meta/schema.md), die in der ausgewählten Karte verlinkten Quellmodule. Working: konkreter Änderungsauftrag oder GitHub Issue.

## Do NOT load
Nicht das gesamte Repository oder alle Karten laden. `references/` enthält kuratierte Fireflies-Doku und wird nur thematisch passend geladen, niemals komplett. Keine `secrets.json`, `.agents/secrets.json` oder `~/.openclaw/secrets.json` zur Kartierung laden — Inhalte sind Credentials.

## Process
1. Katalog nach Objekt oder Prozess wählen; für Änderungen effects/CONTEXT.md lesen.
2. Quellzitate und Grenzen der ausgewählten Karte prüfen. Code hat bei Istzustandsfragen Vorrang; SKILL.md trägt die Arbeitsregeln.
3. Live = aktiv verdrahtet; leftover = historisch/ersetzt; ghost = benannt, aber nicht implementiert.
4. Bei Drift Karte mit Quelle, Datum und Revision synchron aktualisieren. README.md ändern und AGENTS.md/routing.md daraus bytegleich generieren.

## Outputs
Begründeter Änderungsscope und synchron aktualisierte Objekt-/Prozesskarten. Offene Arbeit als GitHub Issue, keine lokale Backlog-Datei.

## Human Check
Eine fremde Person kann vom Repository-Einstieg eine Karte finden, deren Quellbelege öffnen und direkte Änderungsauswirkungen erklären. Kartierungsstand ist keine Behauptung eines aktuellen erfolgreichen Testlaufs.