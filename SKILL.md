---
name: fireflies-api
description: Arbeite mit der Fireflies API für Meeting-Transkripte, Summaries, Speaker-Daten, Uploads und Webhooks. Verwende diesen Skill, wenn Fireflies analysiert, integriert, automatisiert oder über API/GraphQL angebunden werden soll, besonders für Fragen zu Auth, Query-Struktur, Uploads, Transcript-Abruf, Summaries, Search und Webhooks.
---

# Fireflies API

Nutze diesen Skill für Fireflies-Arbeit. Bevor du konkrete API-Operationen planst oder implementierst, hole dir den aktuellen Stand aus der offiziellen Doku.

## Offizielle Doku

Primärquelle:
- Introduction: https://docs.fireflies.ai/getting-started/introduction
- Doku-Index für LLMs: https://docs.fireflies.ai/llms.txt

Wichtige Einstiegsseiten:
- Quickstart: https://docs.fireflies.ai/getting-started/quickstart
- Authorization: https://docs.fireflies.ai/fundamentals/authorization
- Concepts: https://docs.fireflies.ai/fundamentals/concepts
- Query Transcripts: https://docs.fireflies.ai/graphql-api/query/transcripts
- Upload Audio: https://docs.fireflies.ai/graphql-api/mutation/upload-audio
- Webhooks V2: https://docs.fireflies.ai/graphql-api/webhooks-v2

Bereits lokal kuratiert:
- Auth: `references/auth.md`
- Transcript Queries: `references/transcript-queries.md`
- Upload Audio: `references/upload-audio.md`
- Webhooks V2: `references/webhooks.md`
- Capability Matrix: `references/capability-matrix.md`
- Channels und Meeting-Zuordnung: `references/channels.md`
- Summary-Format für transcript-only Fälle: `references/summary-format.md`

Wenn du Fireflies noch nicht gut genug kennst oder wenn sich das Thema nach aktueller Doku anhört, lies zuerst `references/fireflies-docs.md` und ziehe dann die passende Originalseite nach. Jedes Mal, wenn du neue Fireflies-Doku liest, überführe die belastbaren Inhalte sofort in eine thematisch passende lokale Referenzdatei, damit künftige Arbeit zunehmend ohne Webzugriff auskommt.

## Arbeitsweise

1. Kläre den Use-Case.
   - Lesen: Transcript, Summary, Meeting-Metadaten, Speaker, Search
   - Schreiben: Audio hochladen, ggf. andere Mutations
   - Ereignisse: Webhooks für fertige Transkripte/Summaries
   - Manuell importieren: externe Transkripte, zum Beispiel aus Zoom, per Chat-Upload oder aus einem lokalen Ordner wie `Agent-Share/`

2. Prüfe die Auth-Annahme.
   - Fireflies arbeitet laut Doku mit Bearer API Key.
   - Keine Secrets raten oder erfinden.
   - Lokale Secret-Konvention: `~/.openclaw/secrets.json` unter `integrations.fireflies.accounts.<email>.apiKey`.
  - `secrets.json` darf niemals versioniert oder in PRs enthalten sein.
   - Beim Zugriff auf Accounts mit Sonderzeichen in der Mailadresse immer String-Key-Notation verwenden, nicht Dot-Notation.
  - Account-Zugriff erfolgt über `integrations.fireflies.accounts["<email>"].apiKey`.
   - Wenn Credentials fehlen, nur Vorbereitung, Schema, Beispiele und Integrationsplan liefern.

3. Nutze die Doku gezielt statt aus dem Bauch.
   - Starte bei `llms.txt`, wenn unklar ist, welche Seite relevant ist.
   - Nutze nur die wirklich passende Primärseite für das konkrete Problem.
   - Bei GraphQL immer die minimal nötige Query oder Mutation formulieren.

4. Kuriere neues Wissen lokal ein.
   - Alles Belastbare aus neu gelesener Fireflies-Doku in `references/` ablegen, statt es nur flüchtig im Chat zu verwenden.
   - Keine zentrale Sammeldatei pflegen. Wissen immer thematisch getrennt in eigene Dateien schreiben.
   - Bestehende Themen-Dateien erweitern, wenn das Thema schon abgedeckt ist.
   - Neue Themen-Dateien anlegen, wenn ein eigenes Thema entsteht, zum Beispiel `auth.md`, `graphql-basics.md`, `transcript-queries.md`, `upload-audio.md`, `webhooks.md`, `data-model.md` oder `limits-and-gotchas.md`.
   - Pro Datei nur ein klar abgegrenztes Thema behandeln, damit sie später gezielt geladen werden kann.
   - Pro Eintrag immer Quelle und Original-URL notieren.
   - Lokale Referenzen knapp, strukturiert und für spätere Wiederverwendung schreiben.
   - Zielzustand: Der Skill soll mit der Zeit genug lokales Fireflies-Wissen sammeln, dass Webzugriffe nur noch für neue oder strittige Details nötig sind.

5. Halte Integrationen klein und robust.
   - Erst manueller API-Flow oder Skill-Workflow.
   - Wiederkehrende, klar umrissene Aktionen später ggf. als Tool kapseln.
   - Wenn Hilfsskripte nötig sind, lege sie unter `scripts/` des Skills an und bevorzuge wiederverwendbare, klar benannte Skripte statt einmaliger Ad-hoc-Dateien.
   - Gemeinsame Query- und Felddefinitionen bevorzugt in Shared-Module auslagern statt dieselbe GraphQL-Struktur in mehrere Skripte zu kopieren.

## Empfehlung: Skill vor Tool

Für neue Fireflies-Arbeit standardmäßig so vorgehen:
- zuerst Skill-Workflow und Beispiele
- dann wiederkehrende Operationen identifizieren
- erst danach ein echtes Tool bauen, falls Zuverlässigkeit, Fehlerbehandlung oder Automatisierung das rechtfertigen

Ein Tool ist sinnvoll, wenn mehrere dieser Punkte zutreffen:
- wiederholte GraphQL-Calls mit stabilen Inputs/Outputs
- wiederkehrende Auth- und Header-Logik
- Uploads oder Webhooks brauchen robuste Behandlung
- Fehlerbilder sollen zentral abgefangen werden
- andere Skills oder Agents sollen dieselben Operationen wiederverwenden

## Typische Aufgaben

### 1) Transcript abrufen

Vorgehen:
- zuerst `references/transcript-queries.md` lesen
- nur bei neuen oder unklaren Details die Original-Doku nachziehen
- benötigte Felder minimieren
- Meeting-ID, Transcript-ID oder Filter sauber klären
- Antwort auf nutzbares internes Format reduzieren
- relevante, wiederverwendbare oder vollständig abgerufene Meeting-Daten in eine lokale Meeting-Struktur unter `memory/references/meetings/` überführen
- rein flüchtige Ad-hoc-Checks nur dann persistieren, wenn der Nutzer das verlangt oder spätere Wiederverwendung absehbar ist

#### Lokale Meeting-Ablage

Wenn Meeting-Daten abgerufen werden, lege oder aktualisiere eine lokale Struktur unter `memory/references/meetings/`.

Für Struktur, `meetings.json`, Frontmatter und Markdown-Dateien immer `references/data-model.md` als maßgebliches Schema verwenden.

Kurzregeln:
- `memory/references/meetings/meetings.json` pflegen
- im Top-Level zusätzlich `channel_strategy` mit dem knappen-Channel-Modell führen
- einen Channel-Filter beim Sync nur als Laufzeitparameter verwenden, nicht als persistierten Meeting-Fakt
- in `channel_mappings` pro Channel mindestens `routing_mode` mitführen
- Fireflies-Channels nicht als fachliche Endstruktur behandeln
- der Sync dient für Intake, Spiegelung, Review-Vormerkung und Update-Erkennung, nicht für die endgültige Projekt-/Topic-Klassifikation
- pro Meeting zusätzlich `classification_status`, `classification_confidence`, `classification_notes`, `classification_basis`, `review_recommended`, `review_reason` und `classifier_mode` pflegen
- `project_slug` und `topic_slug` im Sync zunächst leer lassen, wenn die fachliche Klassifikation erst nachgelagert im Chat erfolgen soll
- `resolved_by`, `resolved_at`, `llm_review_status` und `llm_review_summary` optional für den späteren Review-Nachgang pflegen
- für Update-Erkennung `server_fingerprint`, `server_change_status`, `server_changed_since_last_sync`, `first_synced_at` und `last_synced_at` mitführen
- Meeting-Ordner unter dem ersten Channel anlegen, sonst sinnvoller Fallback
- Summary als eigene Markdown-Datei anlegen
- Volltranskript bei vollständigem Abruf als zweite Markdown-Datei anlegen
- stabile slug-basierte Dateinamen verwenden
- `project_slug` und `topic_slug` mit den Katalog-Skills `project-catalog-entry` und `topic-catalog-entry` kompatibel halten
- **Verschiebung & Pfadkonsistenz**: Die physischen Meeting-Dateien (Zusammenfassung/Volltranskript) können nachträglich in spezifischere Zielordner (wie Projekt-, Topic- oder Eventstrukturen) verschoben werden. In diesem Fall **müssen** die entsprechenden Pfade (`summary_path` und `transcript_path`) in `memory/references/meetings/meetings.json` angepasst werden, damit die JSON die kanonische Quelle für alle lokalen Meetings bleibt.

### 2) Audio hochladen

Vorgehen:
- zuerst `references/upload-audio.md` lesen
- nur bei neuen oder unklaren Details die Original-Doku nachziehen
- Dateiquelle, Limits und benötigte Parameter prüfen
- asynchronen Folgefluss bedenken: Upload heute, Transcript/Summary später

### 3) Manuelle Transcript-Imports

Der Skill darf auch Transkripte verarbeiten, die nicht aus Fireflies kommen, zum Beispiel aus Zoom Sessions.

Zulässige Quellen:
- Datei-Upload im Chat
- lokaler Ordnerinput, zum Beispiel unter `Agent-Share/`
- andere lokal verfügbare Textdateien mit Transcript-Inhalt

Regeln:
- externe oder manuell gelieferte Transkripte inhaltlich auswerten und analog zu Fireflies-Meetings unter `memory/references/meetings/` speichern
- dafür dieselbe Ordnerstruktur, `meetings.json`, Summary-Datei und optional Volltranskript-Datei verwenden
- im Datenmodell die Quelle sauber markieren, zum Beispiel über `source.system`, `source.import_mode` und `source.origin_path`
- wenn Channel-Zuordnung fehlt, sinnvollen Fallback-Ordner verwenden und Mapping offenlassen statt etwas zu erfinden
- bei manuellen Imports aus dem Inhalt nach Möglichkeit dieselben Klassifikations- und Routingregeln anwenden wie bei Fireflies-Meetings
- falls Rohformat oder Qualität schlecht sind, das im Meeting-Eintrag und in der Summary kenntlich machen
- wenn nur ein Transcript vorliegt, keine vorhandene Summary verfügbar ist oder die gelieferte Summary unzureichende Inhalte (z. B. leere Abschnitte) aufweist, nach `references/summary-format.md` eine eigene Meeting-Summary anhand des Transkripts erzeugen

### 4) Webhook-Integration

Vorgehen:
- zuerst `references/webhooks.md` lesen
- nur bei neuen oder unklaren Details die Original-Doku nachziehen
- relevante Eventtypen festlegen
- Payload als untrusted input behandeln
- nach Event lieber Meeting/Transcript nochmal aktiv per API nachladen statt blind Payload zu vertrauen

### 5) Channel-basierte Intake-Logik im knappen-Channel-Modell

Verwende Fireflies-Channels nur als groben Intake- und Relevanzhinweis, nicht als fachliche Klassifikation.

Grundsatz für die aktuelle Free-Nutzung:
- es gibt nur wenige Fireflies-Channels
- ein Channel-Filter kann beim Sync-Aufruf optional übergeben werden
- dieser Filter dient nur dazu, welche Meetings geholt werden
- die eigentliche Projekt- und Topic-Zuordnung erfolgt nachgelagert lokal pro Meeting
- die lokale Meeting-Klassifikation nach dem Sync ist Source of Truth, nicht der Channel selbst

Regeln:
- der Sync soll keine endgültige Projekt- oder Topic-Zuordnung erzwingen
- im Sync lieber ungemappt speichern als voreilig falsch zuzuordnen
- Inhalt schlägt Channel, Katalog schlägt bloße Namensähnlichkeit

Empfohlene Reihenfolge im Sync:
1. Prüfen, ob in `meetings.json.channel_strategy` das knappe-Channel-Modell aktiv ist.
2. Optionalen Channel-Filter nur für den Lauf übernehmen.
3. Meetings holen und lokal spiegeln.
4. `classification_status` zunächst auf unaufgelöst lassen, wenn noch keine fachliche Entscheidung getroffen wurde.
5. `review_recommended: true` setzen, wenn die eigentliche Fachklassifikation nachgelagert erfolgen soll.
6. Ein kompaktes `review_input` für den aufrufenden Agenten schreiben.

### 6) Nachgelagerte Klassifikation durch den aufrufenden Agenten

Die eigentliche Projekt- und Topic-Zuordnung soll nicht im Sync-Skript selbst laufen, sondern im aufrufenden Agenten nachgelagert erfolgen.

Regelmodell:
- Das Sync-Skript ist zuständig für Intake, Spiegelung, Änderungs-Erkennung und Review-Vorbereitung.
- Der aufrufende Agent ist zuständig für die fachliche Auflösung zu Projekten und Topics.
- Ein LLM oder Mensch ist zuständig für schwierige Fälle mit Mehrfachkontext, konkurrierenden Kandidaten oder unklarer Primärzuordnung.

Praktische Umsetzung:
- Das Sync-Skript schreibt `review_input` sowie `llm_review_status`.
- Der Agent liest diese Daten nach dem Sync und entscheidet, ob direkte Zuordnung, LLM-Review oder Rückfrage nötig ist.
- Wenn mehrere Projekte und/oder Topics plausibel sind, nicht künstlich im Sync auf genau eines reduzieren.
- Der eigentliche LLM-Schritt soll nicht im Sync-Skript selbst laufen, sondern im aufrufenden Agenten nachgelagert erfolgen.

### 7) Lokaler Sync und Update-Erkennung

Für wiederkehrende Fireflies-Arbeit bevorzugt die vorhandenen Reuse-Skripte unter `scripts/` verwenden.

Aktuelle Skripte:
- `list-channels.mjs`
  - listet zugängliche Fireflies-Channels
- `list-meetings.mjs`
  - listet Meetings mit Filtern und Pagination
- `get-meeting.mjs`
  - lädt ein einzelnes Meeting, `--mode minimal|full`
- `sync-meetings-to-memory.mjs`
  - synchronisiert Meetings in `memory/references/meetings/`
- `probe-meeting-capabilities.mjs`
  - prüft für ein konkretes Meeting read-only, welche Felder/Artefakte im aktuellen Account/Plan tatsächlich befüllt oder gesperrt sind
  - Einsatz: kurze Capability-Checks, bevor neue Metadaten dauerhaft in den Sync übernommen werden
- `relocate-local-meeting.mjs`
  - hängt ein bereits lokal gespiegeltes Meeting nur in `memory/references/meetings/` um und zieht Frontmatter + `meetings.json` lokal nach
  - keine Fireflies-API-Aktion; gedacht für lokale Nachpflege wie `ohne-channel` → `channel-slug`

Empfohlene Sync-Modi:
- Standardlauf ohne Zusatzoptionen
  - nur neue Meetings holen
- `--meeting-id <id> --mode all`
  - ein einzelnes Meeting gezielt neu holen
- `--refresh-changed --mode all`
  - bekannte Meetings erneut vom Server holen und auf Änderungen prüfen

Regeln für Update-Erkennung:
- Nicht auf ein erfundenes `updated_at` vertrauen, wenn die Doku kein belastbares Feld dafür zeigt.
- Stattdessen relevante Serverfelder lokal hashen und als `server_fingerprint` speichern.
- Aus altem und neuem Fingerprint `server_change_status` ableiten: `new`, `unknown`, `changed`, `unchanged`.
- `server_changed_since_last_sync` nur als Kurzsignal für den letzten Vergleich verwenden.
- Webhooks sind nützlich für Ereignisse wie `meeting.transcribed` und `meeting.summarized`, ersetzen aber den Inhaltsvergleich nicht vollständig.
- Lokal gespeicherte Meetings/Dateien nicht automatisch löschen, auch wenn ein Meeting serverseitig nicht mehr verfügbar ist (Free-Plan-Limit mit ca. 800 Minuten; lokale Referenzen dienen als Langzeitarchiv).

### 8) Nachgelagerte LLM-Klassifikation durch den aufrufenden Agenten

Wenn `review_recommended: true` gesetzt ist, soll der aufrufende Agent den Review-Fall nach dem Sync aktiv weiterbearbeiten.

Empfohlenes Vorgehen:
1. `review_input` aus `meetings.json` lesen.
2. Prüfen, ob der Fall klar genug für eine direkte Agentenentscheidung ist.
3. Wenn nötig, zusätzliche Meeting-Ausschnitte, Summary oder Match-Listen heranziehen.
4. Wenn weiterhin Mehrdeutigkeit besteht oder der Nutzerkontext entscheidend ist, kurze Rückfrage im Chat stellen.
5. Danach finale Entscheidung in die kanonischen Felder schreiben:
   - `project_slug`
   - `topic_slug`
   - `llm_review_summary`
   - `resolved_by`
   - `resolved_at`
   - `llm_review_status`

Regeln:
- Der Agent schreibt die finale Entscheidung direkt in `project_slug` und `topic_slug`.
- `llm_review_status` auf `resolved` setzen, wenn der Agent eine tragfähige Entscheidung getroffen hat.
- `llm_review_status` auf `user-query` setzen, wenn noch eine Nutzerentscheidung oder Rückfrage offen ist.
- Wenn neue Serveränderungen erkannt werden, darf ein zuvor gelöster Fall wieder auf `pending` zurückfallen.

## Ausgabeprinzipien

- Offizielle Seite verlinken, wenn die Antwort an aktueller Doku hängt.
- Bei Unsicherheit klar sagen, was bestätigt ist und was nur Annahme ist.
- Für Implementierungen zuerst kleines, testbares Beispiel liefern.
- Für Architekturfragen zwischen Skill-Workflow und Tool sauber unterscheiden.

## Referenzen

- Kurzübersicht und Doku-Navigation: `references/fireflies-docs.md`
- Auth: `references/auth.md`
- Transcript Queries: `references/transcript-queries.md`
- Upload Audio: `references/upload-audio.md`
- Webhooks V2: `references/webhooks.md`
- Capability Matrix: `references/capability-matrix.md`
- Channels und Meeting-Zuordnung: `references/channels.md`
- Summary-Format für transcript-only Fälle: `references/summary-format.md`
- Transcript-Datenmodell: `references/data-model.md`
- Weitere Themen-Dateien bei Bedarf, zum Beispiel `graphql-basics.md`, `limits-and-gotchas.md`, `realtime-api.md`
