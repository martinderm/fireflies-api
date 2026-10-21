---
name: fireflies-api
description: Arbeite mit der Fireflies API für Meeting-Transkripte, Summaries, Speaker-Daten, Uploads und Webhooks. Verwende diesen Skill, wenn Fireflies analysiert, integriert, automatisiert oder über API/GraphQL angebunden werden soll, besonders für Fragen zu Auth, Query-Struktur, Uploads, Transcript-Abruf, Summaries, Search und Webhooks.
---

# Fireflies API (SaaS-Adapter)

> **Architektur-Rolle:** Technischer SaaS-Adapter für Fireflies.ai (GraphQL, Audio-Upload, Transkript-Abruf, Webhooks). Der Adapter transformiert API-Payloads in `meeting-record/1` und schreibt **keine** Meeting-Dateien und **kein** `meetings.json`.
>
> **Workflow-Orchestrierung und kanonischer Writer:** Die übergeordnete thematische Klassifikation, Evidenz-Ablage, Action-Item-Triage und alle Ingest-Dateimutationen liegen bei **[`office-intelligence/meeting-desk`](../office-intelligence/skills/meeting-desk/SKILL.md)**. Der Sync delegiert jeden Record an `ingest_meeting.py` dieses Skills.

Nutze diesen Skill für direkte Fireflies-API-Operationen. Bevor du konkrete API-Operationen planst oder implementierst, hole dir den aktuellen Stand aus der offiziellen Doku.

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

## Kanonischer Meeting-Writer (OI #35)

Der Adapter ist **Transformator**, nicht Publisher:

- Fireflies-API-Payloads werden offline in genau einen `meeting-record/1`-Record transformiert (`scripts/_meeting-record.mjs`).
- `sync-meetings-to-memory.mjs` liest `meetings.json` nur lesend (für Modus, Alias-Identität, Account-Bindung und Fingerprint-Vergleich) und ruft für jeden Record den kanonischen Python-Writer auf.
- Es gibt **keinen** Register-Upsert, keinen Markdown-Write, kein Verschieben, Löschen oder Aktualisieren von Meeting-Dateien im Adapter. `relocate-local-meeting.mjs` wurde entfernt; Umrouting ist ein Writer-/Operator-Vorgang.
- Ein Fehler des Writers ist ein Fehler. Es gibt **keinen stillen Fallback** auf einen Legacy-Writer.

Vertrauenswürdige Aufrufkonfiguration (niemals aus dem Record oder Provider-Payload):

```bash
node scripts/sync-meetings-to-memory.mjs \
  --meeting-writer <skill-root>/skills/meeting-desk/scripts/ingest_meeting.py \
  --python <python> \
  --workspace-lock-root <skill-root>/skills/workspace-lock \
  --lease-id <lease> \
  [--conversation-id <id>] \
  [--topic <slug>] [--project <slug>] [--event <slug>] \
  [--dry-run]
```

Alternativ als Operator-Fallback: `MEETING_DESK_WRITER` und `MEETING_DESK_PYTHON`. Die Pfade werden nie aus API-Daten abgeleitet. Vor Listen-/Detail-Queries prüft der Adapter `ingest_meeting.py --capabilities --json` und verlangt `data.record_schema = meeting-record/1` sowie `data.writer_version = meeting-desk/1`.

Kindprozessvertrag: stdin ist genau ein UTF-8-JSON-Record (`--record -`), ohne Shell. stdout trägt genau einen Sechs-Feld-Envelope (`action`, `success`, `state`, `message`, `data`, `error`). Exit 0 **und** valider Erfolgs-Envelope sind gemeinsam nötig; Exit 2 ist Rejection, Exit 3 `recovery_required`. Timeout, Signal, widersprüchlicher Exit/Envelope oder unerwartete Ausgabe bedeuten einen unbekannten Ausgang und verlangen Writer-Inspect statt blindem Retry. Batch-Läufe melden Erfolg und Fehler pro Meeting (`meetings`, `failures`, `state`); ein Teilfehler ist kein voller Sync-Erfolg.

Routing: `--topic`/`--project`/`--event` sind vertrauenswürdige Operator-Optionen; alte Aliase `--project-slug`, `--topic-slug`, `--event-slug` werden akzeptiert. Ohne Routing ist der Lauf ein gültiger **unmapped Intake** und kein Fehler. Der Adapter klassifiziert nicht: `classification_hint` bleibt leer, `review.recommended` ist `true`. Katalogvalidierung, `unmapped`/`unrouted`-Ablage und Reviewpflicht entscheidet der Writer.

Record-Grenzen: `source.system = fireflies`, `source.external_id` und `meeting_id` sind die rohe, **opake** Fireflies-ID: keine Slugifizierung, keine Dateinamen-Bereinigung, keine erzwungene Umschlüsselung. Leere IDs, Steuerzeichen, unpaare Surrogate und IDs über 512 Zeichen werden abgewiesen; Leerzeichen, `/` oder `\` in einer gültigen opaken ID bleiben erhalten. Der Writer darf IDs nie als Dateipfadbestandteile verwenden. `date` (Epoch-Millisekunden) wird zu einem echten UTC-Zeitpunkt; eine reine Datumsangabe bleibt `utc: null`, `estimated: true`. Fehlende Zeit wird niemals durch Importzeit oder eine erfundene Mittagszeit ersetzt. `duration_minutes` sind Provider-Minuten; numerische Strings werden nicht still umgewandelt, der rohe Providerwert inklusive Originaltyp bleibt inert in `source_metadata` (`provider_duration_raw`, `provider_duration_raw_type`, `provider_duration_status`). `transcript_md` und `transcript_raw_md` sind getrennt; Raw enthält die unveränderten Satztexte in Providerreihenfolge, nur strukturell mit LF verbunden. Provider-Metadaten liegen inert in `source_metadata`. Die Summary-Completeness-Zeile nennt nur tatsächlich vorhandene Artefakte.

Details: [`references/meeting-record-v1.md`](references/meeting-record-v1.md).

## Arbeitsweise

Vor der Nutzung in einem Agent-Workspace sicherstellen:
- Der Shared Skill ist lokal unter `.agents/skills/fireflies-api` verlinkt.
- Die zugehoerige Secret-Datei ist unter `.agents/secrets.json` verlinkt oder alternativ als `secrets.json` im Workspace-Root vorhanden.
- CLI-Aufrufe bevorzugt aus dem Agent-Workspace-Root starten. Falls direkt im Shared-Skill-Ordner gearbeitet wird, `WORKSPACE_ROOT` explizit setzen.

1. Klaere den Use-Case.
   - Lesen: Transcript, Summary, Meeting-Metadaten, Speaker, Search
   - Schreiben: Audio hochladen, ggf. andere Mutations
   - Ereignisse: Webhooks für fertige Transkripte/Summaries
   - Manuell importieren: externe Transkripte, zum Beispiel aus Zoom, per Chat-Upload oder aus einem lokalen Ordner wie `Agent-Share/`

2. Prüfe die Auth-Annahme.
   - Fireflies arbeitet laut Doku mit Bearer API Key.
   - Keine Secrets raten oder erfinden.
   - Lokale Secret-Konvention: bevorzugt `.agents/secrets.json` im Workspace-Root, alternativ `secrets.json` im Workspace-Root oder `~/.openclaw/secrets.json`, jeweils unter `integrations.fireflies.accounts.<email>.apiKey`.
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
- für Persistenz entweder den Sync (Record an den kanonischen Writer) oder den expliziten Record-Export von `get-meeting.mjs` verwenden; der Adapter schreibt selbst keine Meeting-Ablage
- rein flüchtige Ad-hoc-Checks nur dann persistieren, wenn der Nutzer das verlangt oder spätere Wiederverwendung absehbar ist

#### Record-Export und kanonischer Writer (Dual-Evidence-Standard)

Die lokale Meeting-Ablage unter `memory/evidence/meetings/` (Fallback `memory/references/meetings/`) gehört dem meeting-desk-Writer. Der Adapter liefert nur den Record.

- **stdout** von `get-meeting.mjs` bleibt ein flüchtiger JSON-/Markdown-Export.
- **Dateiausgabe** ist ausschließlich ein gültiger `meeting-record/1`-Record mit Endung `.meeting-export.json` unter `<workspace>/data/`. Dafür sind ein expliziter Trusted Lease (`--lease-id`) und ein expliziter Lock-Root (`--workspace-lock-root`) nötig. Der Export importiert den Shared Guard `workspace_lock_guard.py` **in place** (`require_workspace_lock(..., allow_legacy=False)`) und prüft Lease + Pfad vor Credentials/API, erneut vor dem Staging und unmittelbar vor der create-only-Publikation. Freigabe/Ersatz der Lease nach Fetch oder Staging hinterlässt weder Export noch Temp-Datei; eine Race zwischen letzter Prüfung und atomarem Create bleibt im kooperativen Lockmodell möglich. Die deklarierte Lease-ID ist eine kooperative Zusicherung, keine kryptografische Aufruferidentität. Ein `--output` außerhalb dieser Zone, mit anderer Endung oder als Markdown wird **vor** jedem API-Aufruf abgewiesen.
- **Sync** delegiert jeden Record an den Writer. Nur der Writer pflegt `meetings.json`, Frontmatter, Summary-/Transcript-Dateien, Pfade, Review- und Content-Status.
- Der Writer erhält `--topic`/`--project`/`--event` nur aus vertrauenswürdiger Operator-Konfiguration. Ohne Routing entsteht ein gültiger unmapped Intake; der Adapter erfindet keine Klassifikation und keine Freigabe.
- Für Update-Erkennung bleibt `server_fingerprint` eine reine Adapter-/Lesezustands-Fähigkeit: der Vergleich liest den vorhandenen Registereintrag, das Ergebnis liegt inert in `source_metadata`; geschrieben wird es nur vom Writer.
- `project_slug`, `topic_slug`, `event_slug`, `classification_status` und `content_status` sind Writer-/Registerfelder, keine Adapter-Rootfelder.

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
- externe oder manuell gelieferte Transkripte inhaltlich auswerten, aber **nicht selbst** unter `memory/evidence/meetings/` ablegen; die Ablage ist Aufgabe des kanonischen Writers
- die Quelle im Record sauber markieren (`source.system`, `external_id`); provider-spezifische Herkunft gehört inert nach `source_metadata`
- wenn eine Channel-/Projektzuordnung fehlt, nichts erfinden: ohne vertrauenswürdige Operator-Auswahl bleibt der Intake unmapped und reviewpflichtig
- bei manuellen Imports aus dem Inhalt dieselben Writer-/Routingregeln verwenden wie bei Fireflies-Meetings; der Adapter klassifiziert nicht
- falls Rohformat oder Qualität schlecht sind, das im Record (z. B. `review.reason` oder `source_metadata`) kenntlich machen
- wenn nur ein Transcript vorliegt, keine vorhandene Summary verfügbar ist oder die gelieferte Summary unzureichende Inhalte (z. B. leere Abschnitte) aufweist, nach `references/summary-format.md` eine eigene Meeting-Summary anhand des Transkripts erzeugen und als `summary_md` in den Record geben

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
- der Sync erzwingt keine endgültige Projekt- oder Topic-Zuordnung
- im Sync lieber ungemappt an den Writer geben als voreilig falsch zuzuordnen
- Inhalt schlägt Channel, Katalog schlägt bloße Namensähnlichkeit
- Channel-Evidenz ist Provider-Metadatum (`source_metadata.channel_*`), keine Klassifikation

Empfohlene Reihenfolge im Sync:
1. Optionalen Channel-Filter nur für den Lauf übernehmen.
2. Capabilities des kanonischen Writers prüfen.
3. Meetings holen und je Meeting einen Record bauen.
4. Ohne vertrauenswürdige `--project`/`--topic`/`--event`-Auswahl bleibt `classification_hint` leer.
5. `review.recommended: true` bleibt gesetzt; der Writer entscheidet über `unmapped`/Reviewpflicht.
6. Der Writer schreibt Register und Review-Zustand; der Adapter liest nur.

### 6) Nachgelagerte Klassifikation durch den aufrufenden Agenten

Die eigentliche Projekt- und Topic-Zuordnung soll nicht im Sync-Skript selbst laufen, sondern im aufrufenden Agenten nachgelagert erfolgen.

Regelmodell:
- Der Adapter ist zuständig für API-Intake, Record-Transformation, Änderungs-Erkennung und das Melden von Provider-Evidenz.
- Der kanonische Writer ist zuständig für Register, Review-Zustand, Pfade und Publikation.
- Der aufrufende Agent ist zuständig für die fachliche Auflösung zu Projekten und Topics über den vertrauenswürdigen Writer-/Operator-Kanal.
- Ein LLM oder Mensch ist zuständig für schwierige Fälle mit Mehrfachkontext, konkurrierenden Kandidaten oder unklarer Primärzuordnung.

Praktische Umsetzung:
- Der Writer schreibt `review_input`, `classification_status` und `llm_review_status`; der Adapter liest sie nur.
- Der Agent liest diese Daten nach dem Sync und entscheidet, ob direkte Zuordnung, LLM-Review oder Rückfrage nötig ist.
- Wenn mehrere Projekte und/oder Topics plausibel sind, nicht künstlich im Sync auf genau eines reduzieren.
- Der eigentliche LLM-Schritt läuft nicht im Sync-Skript, sondern im aufrufenden Agenten nachgelagert.

### 7) Lokaler Sync und Update-Erkennung

Für wiederkehrende Fireflies-Arbeit bevorzugt die vorhandenen Reuse-Skripte unter `scripts/` verwenden.

Aktuelle Skripte:
- `list-channels.mjs`
  - listet zugängliche Fireflies-Channels
- `list-meetings.mjs`
  - listet Meetings mit Filtern und Pagination
- `get-meeting.mjs`
  - lädt ein einzelnes Meeting, `--mode minimal|full|sentences-only`
  - `--format markdown` rendert den Speaker-Dialog als Markdown (`[mm:ss] Speaker`) auf stdout
  - `--format markdown` wählt ohne explizites `--mode` automatisch den sentences-only-Modus; ein explizites `--mode` gewinnt
  - `--sentences-only` fragt nur die Sentence-Felder ab (kein summary/minimal-Ballast)
  - `--with-frontmatter` prepended einen schlanken YAML-Frontmatter-Block (id, title, date, duration_minutes, participants, source, type) — nur mit `--format markdown` und nur auf stdout; der effektive sentences-only-Modus wird dafür automatisch auf `full` angehoben
  - `--speaker-map "0=Dr. X,1=Martin"` (oder JSON) mapped Speaker-IDs/Namen im Markdown-Export; unbekannte Speaker behalten ihr Original-Label
  - `--output <datei>.meeting-export.json` schreibt ausschließlich einen validen `meeting-record/1`-Record unter `<workspace>/data/`; verlangt `--lease-id` und `--workspace-lock-root`, prüft den kanonischen Guard (in place, `allow_legacy=False`) und den Pfad **vor** Credentials/API, vor dem Staging und unmittelbar vor der Publikation und schreibt no-clobber. Freigabe/Ersatz der Lease nach Fetch oder Staging hinterlässt keine Datei. Der Export nutzt immer den vollen Feldkatalog. Markdown-Dateien, andere Endungen und Pfade außerhalb von `data/` werden abgewiesen.
- `sync-meetings-to-memory.mjs`
  - liest `meetings.json` nur lesend und delegiert jeden Meeting-Record an den kanonischen Writer
  - schreibt selbst keine Meeting-Dateien, kein Register, keine Frontmatter und keine Pfade
  - `--project`/`--topic`/`--event` (Aliase `--project-slug`/`--topic-slug`/`--event-slug`) sind vertrauenswürdige Routing-Optionen für den Writer; ohne Routing ist der Lauf ein gültiger unmapped Intake
  - explizit leere oder zu `ohne-channel` normalisierende Routingwerte werden fail-loud als `empty_project_slug` o. Ä. abgewiesen; ein **fehlendes** `--project-slug` ist kein Fehler
  - Writer-Konfiguration: `--meeting-writer`, `--python`, `--workspace-lock-root`, `--lease-id`, optional `--conversation-id`; Env-Fallback nur `MEETING_DESK_WRITER`/`MEETING_DESK_PYTHON`
- `probe-meeting-capabilities.mjs`
  - prüft für ein konkretes Meeting read-only, welche Felder/Artefakte im aktuellen Account/Plan tatsächlich befüllt oder gesperrt sind
  - Standard-Query fordert planabhängige Paid-Felder (`audio_url`, `video_url`, `analytics`) bewusst nicht an; `--include-paid-fields` fordert sie gezielt nach (auf einem Free-Plan bricht Fireflies die gesamte Query mit `paid_required` ab)
  - nicht abgefragte Capabilities werden als `null` ("nicht abgefragt") ausgewiesen, statt `false` zu behaupten
  - `--include-summary` fordert zusätzlich den Summary-Block an
  - Einsatz: kurze Capability-Checks, bevor neue Metadaten dauerhaft in den Sync übernommen werden
- `relocate-local-meeting.mjs` existiert nicht mehr. Umrouting/Verschieben ist Aufgabe des kanonischen Writers, nicht des Fireflies-Adapters.

Empfohlene Sync-Modi:
- Standardlauf ohne Zusatzoptionen
  - nur neue Meetings holen
- `--meeting-id <id> --mode all`
  - ein einzelnes Meeting gezielt neu holen
- `--refresh-changed --mode all`
  - bekannte Meetings erneut vom Server holen und auf Änderungen prüfen

Regeln für Update-Erkennung:
- Nicht auf ein erfundenes `updated_at` vertrauen, wenn die Doku kein belastbares Feld dafür zeigt.
- Stattdessen relevante Serverfelder lokal hashen und als `server_fingerprint` **lesen**; das Ergebnis gehört inert in `source_metadata` und wird nur vom Writer in den Registereintrag übernommen.
- Aus altem und neuem Fingerprint `server_change_status` ableiten: `new`, `unknown`, `changed`, `unchanged`.
- `server_changed_since_last_sync` nur als Kurzsignal für den letzten Vergleich verwenden.
- Webhooks sind nützlich für Ereignisse wie `meeting.transcribed` und `meeting.summarized`, ersetzen aber den Inhaltsvergleich nicht vollständig.
- Lokal gespeicherte Meetings/Dateien nicht automatisch löschen, auch wenn ein Meeting serverseitig nicht mehr verfügbar ist (Free-Plan-Limit mit ca. 800 Minuten; lokale Referenzen dienen als Langzeitarchiv). Lösch-/Aufräumpfade liegen nicht im Adapter.

### 8) Nachgelagerte LLM-Klassifikation durch den aufrufenden Agenten

Wenn der vom Writer geführte Registereintrag Review verlangt (`review_recommended: true`), soll der aufrufende Agent den Review-Fall nach dem Sync aktiv weiterbearbeiten.

Empfohlenes Vorgehen:
1. Den Writer-/Registerzustand (z. B. `review_input`, `classification_status`) lesen.
2. Prüfen, ob der Fall klar genug für eine direkte Agentenentscheidung ist.
3. Wenn nötig, zusätzliche Meeting-Ausschnitte, Summary oder Match-Listen heranziehen.
4. Wenn weiterhin Mehrdeutigkeit besteht oder der Nutzerkontext entscheidend ist, kurze Rückfrage im Chat stellen.
5. Danach die Entscheidung über den vertrauenswürdigen Writer-/Operator-Kanal anwenden (`--topic`, `--project`, `--event` oder den dafür vorgesehenen Writer-Vorgang), nicht durch direktes Schreiben des Adapters in `meetings.json`.

Regeln:
- Der Adapter schreibt **keine** finale Klassifikation, keinen Review-Status und keine Content-Freigabe.
- Eine Adapter-`review.recommended: true` darf Review nur zusätzlich anfordern, nie herabsetzen.
- `accepted` ist kein Adapter-Ergebnis; ein Import ist kein Content-Approval.
- Wenn neue Serveränderungen erkannt werden, entscheidet der Writer über die Reviewpflicht des geänderten Inhalts.

### 9) Summary-Audit-Standard für High-Stakes-Meetings

Bei Meetings mit hohem Einsatz muss die Fireflies-Summary gegen das Volltranskript geprüft werden, bevor sie als Planungsgrundlage dient. Der Audit ist eine Arbeitsregel, keine optionale Empfehlung.

Ein Transkript-Audit muss geprüft werden bei:
- Client-Commitments oder zugesagten Lieferungen an Externe
- Legal-, Tax- oder Compliance-Relevanz
- High-Stakes-Entscheidungen mit schwer umkehrbaren Folgen
- technischem Scoping, aus dem konkrete Architektur- oder UI-Entscheidungen abgeleitet werden

4-Punkte-Checkliste:
- [ ] Timelines & Urgency: Sind externe Deadlines und zeitlicher Druck vollständig erfasst?
- [ ] Negative Constraints & Boundaries: Sind explizite Grenzen ("Niemals X", "Nicht anfassen Y") erhalten?
- [ ] Technical & UI Specifics: Wurden Architekturentscheidungen nicht zu generischen Aussagen verallgemeinert?
- [ ] Action Item Attribution: Ist jede Aufgabe dem tatsächlichen Sprecher bzw. Verantwortlichen zugeordnet?

Dual-Evidence-Ablage:
- Summary und Volltranskript werden ausschließlich vom kanonischen Writer als Paar unter `memory/evidence/meetings/` (Fallback `memory/references/meetings/`) publiziert; der Adapter liefert `summary_md`, `transcript_md` und `transcript_raw_md` getrennt im Record.
- Erkennt der Audit Diskrepanzen oder Omissionen, wird der Summary-Datei der optionale Abschnitt `## Transkript-Audit & Ergänzungen` angehängt; Format, Auslöser und Beispielzeilen stehen in [`references/summary-format.md`](references/summary-format.md).

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
- Transcript-Datenmodell und kanonisches Register: `references/data-model.md`
- Record-Vertrag und Writer-Seam: `references/meeting-record-v1.md`
- Weitere Themen-Dateien bei Bedarf, zum Beispiel `graphql-basics.md`, `limits-and-gotchas.md`, `realtime-api.md`
