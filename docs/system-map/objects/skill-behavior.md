---
type: object
cluster: policy
universe: live
status: verified
entity: SKILL.md
verified_at: 2026-10-21
revision: c8c22cc+oi35-working-tree
---

# Skill-Verhalten

SKILL.md trägt die Arbeitsregeln: Use-Case-Klärung, Auth-Annahmen, Doku-Kurating, Record-Transformation und die Grenze zum kanonischen Writer.

## Why this shape
Fachliche Policy lebt im Skill-Vertrag, nicht im Code. Der Adapter bleibt technischer Intake; Klassifikation, Register, Review und Content-Status gehören dem meeting-desk-Writer und dem aufrufenden Agenten.

## Shape
Kernregeln: Secrets nie versionieren (`.agents/secrets.json` bevorzugt, `integrations.fireflies.accounts["<email>"].apiKey`); Doku zuerst lokal kuratieren (`references/`, pro Datei ein Thema, Quelle+URL pro Eintrag); Integrationen klein halten. Der Adapter transformiert Fireflies-API-Daten in `meeting-record/1` und schreibt **keine** Meeting-Dateien oder `meetings.json`; `relocate-local-meeting.mjs` wurde entfernt. Der Sync liest das Register nur (Modus, Alias-Identität, Account-Bindung, Fingerprint) und delegiert jeden Record an `ingest_meeting.py`.

Trusted Writer-Konfiguration: `--meeting-writer`, `--python`, `--workspace-lock-root`, `--lease-id`, optional `--conversation-id`; Env-Fallback nur `MEETING_DESK_WRITER`/`MEETING_DESK_PYTHON`. Capabilities (`meeting-record/1`/`meeting-desk/1`) werden vor API-Import geprüft. Erfolg verlangt Exit 0, `action: ingest_meeting` und Plain-Object-`paths`; Exit 2 = Rejection, Exit 3 = `recovery_required`; Timeout, Signal, malformed/contradictory Envelopes und andere Nonzero-Exits nach möglichem Apply = `outcome_unknown` mit `recoveryRequired`, kein blinder Retry, kein Legacy-Fallback. Batch-Fehler bleiben pro Meeting sichtbar. Ein nichtleer gebundener Register-Account bei unbekanntem aktuellem Account stoppt vor API/Writer; `duration_minutes` wird nicht aus numerischen Strings geraten, der Rohwert bleibt inert erhalten.

Routing: `--topic`/`--project`/`--event` (plus `-slug`-Aliase) sind vertrauenswürdige Operator-Optionen. Ohne Routing ist der Lauf ein gültiger unmapped Intake. `classification_hint` bleibt leer; `review.recommended` ist `true` und fordert nur zusätzlich Review an. `accepted` ist kein Adapterergebnis. Der Ad-hoc-Export ist auf `.meeting-export.json` unter `<workspace>/data/` mit Trusted Lease/Lock-Root und no-clobber begrenzt; er importiert den Shared Guard `workspace_lock_guard.py` in place (`allow_legacy=False`) und prüft Lease + Pfad vor Credentials/API, vor Staging und unmittelbar vor Publikation. Die Lease-ID ist eine kooperative Zusicherung, keine kryptografische Identität; Markdown-Dateien und freie Pfade werden vor API abgewiesen. IDs bleiben opak (Leerzeichen/`/`/`\` erhalten), sind auf 512 Zeichen begrenzt und werden nie als Dateipfadbestandteile verwendet.

Meeting-Ablage: `memory/evidence/meetings/` (Fallback `memory/references/meetings/`) wird ausschließlich vom Writer gepflegt; Raw bleibt bytegenau, Frontmatter/Register sind Writer-Ausgabe. Summary-Audit-Standard für High-Stakes-Meetings bleibt eine Arbeitsregel (Timelines & Urgency, Negative Constraints & Boundaries, Technical & UI Specifics, Action Item Attribution); Diskrepanzen werden als `## Transkript-Audit & Ergänzungen` an die Writer-Summary angehängt. Workflow-Orchestrierung übergeordnet bei `office-intelligence/meeting-desk`.

- [SKILL.md](../../../SKILL.md) - `SKILL.md:39` (Kanonischer Writer), `SKILL.md:141` (Record-Export/Ablage), `SKILL.md:186` (Intake-Logik), `SKILL.md:211` (Nachgelagerte Klassifikation), `SKILL.md:274` (Review-Nachgang), `SKILL.md:291` (Summary-Audit)

## Connected to
[Sync](sync.md), [CLI](cli.md), [Record](record.md), [Writer](writer.md), [Qualität](quality.md).

## If you change this
- **Hits:** meeting-desk-Workflows, Agent-Workspace-Erwartungen an `meetings.json`, Referenz-Kurating, Writer-Vertrag.
- **Does not hit:** Skript-Interna, solange Verhalten unverändert bleibt.

## Surfaces
SKILL.md wird von Agent-Workspaces über `.agents/skills/fireflies-api` gelinkt gelesen; README.md ist die kompakte Einstiegsseite.

## See
[Record-Vertrag](../../../references/meeting-record-v1.md), [Datenmodell](../../../references/data-model.md). [Änderungsrouting](../effects/CONTEXT.md).
