---
type: object
cluster: policy
universe: live
status: verified
entity: SKILL.md
verified_at: 2026-10-03
revision: 3b90b8f8ae06a0e6d99ea69d68fc4982db4edf31
---

# Skill-Verhalten

SKILL.md trägt die Arbeitsregeln: Use-Case-Klärung, Auth-Annahmen, Doku-Kurating und die Nachgelagerung der Klassifikation.

## Why this shape
Fachliche Policy lebt im Skill-Vertrag, nicht im Code; der Sync bleibt technischer Intake.

## Shape
Kernregeln: Secrets nie versionieren (`.agents/secrets.json` bevorzugt, `integrations.fireflies.accounts["<email>"].apiKey`); Doku zuerst lokal kuratieren (`references/`, pro Datei ein Thema, Quelle+URL pro Eintrag); Integrationen klein halten (erst Workflow, dann Tool); Channels nur als Intake-Hinweis (`content beats channel`), Klassifikation nachgelagert durch den aufrufenden Agenten mit Feldern `project_slug`, `topic_slug`, `llm_review_status`, `resolved_by/at`; Meeting-Ablage als Dual Evidence unter `memory/evidence/meetings/` nach `references/data-model.md`. Summary-Audit-Standard für High-Stakes-Meetings: muss geprüft werden bei Client-Commitments, Legal/Tax/Compliance, High-Stakes-Entscheidungen oder technischem Scoping (4-Punkte-Checkliste Timelines & Urgency, Negative Constraints & Boundaries, Technical & UI Specifics, Action Item Attribution); Diskrepanzen werden als optionaler Abschnitt `## Transkript-Audit & Ergänzungen` an die Summary-Datei angehängt (Format in `references/summary-format.md`). Workflow-Orchestrierung übergeordnet bei `office-intelligence/meeting-desk`.

- [SKILL.md](../../../SKILL.md) — `SKILL.md:38` (Arbeitsweise), `SKILL.md:167` (Intake-Logik), `SKILL.md:191` (Nachgelagerte Klassifikation), `SKILL.md:242` (LLM-Review-Nachgang), `SKILL.md:108` (Lokale Meeting-Ablage), `SKILL.md:273` (Summary-Audit-Standard)

## Connected to
[Sync](sync.md), [CLI](cli.md), [Qualität](quality.md).

## If you change this
- **Hits:** meeting-desk-Workflows, Agent-Workspace-Erwartungen an meetings.json, Referenz-Kurating.
- **Does not hit:** Skript-Interna, solange Verhalten unverändert bleibt.

## Surfaces
SKILL.md wird von Agent-Workspaces über `.agents/skills/fireflies-api` gelinkt gelesen; README.md ist die kompakte Einstiegsseite.

## See
Meeting-Datenmodell: [references/data-model.md](../../../references/data-model.md). [Änderungsrouting](../effects/CONTEXT.md).