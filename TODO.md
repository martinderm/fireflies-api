# TODO — Bekannte Altlasten

Nur echte, behebenswerte Altlasten. Präexistierende Befunde, die nicht durch den Run `daedalus/runs/2026-09-30-fireflies-api-issues-batch-a` verursacht wurden, aber behoben werden sollten, stehen hier mit Run-Referenz.

## Offene Altlasten

- libuv-Assertion-Crash (exit `-1073740791`, `UV_HANDLE_CLOSING`) nach vollständigem printError-Envelope im echten API-Fehlerpfad auf Node v24.18.0/win32; an Base `d373cd1` identisch reproduziert (Review FFA-A-REV-002, Falsification). Workaround-Idee: `process.exitCode = 1` statt `process.exit()` in den Fehlerpfaden. Run-Referenz: `2026-09-30T171600Z-ffa-issues-batch-a`.

## Keine Altlasten — kontextfremde Linter-Findings (bewusste Nicht-Anwendung)

Der Workspace-Linter (`WS-*`) bewertet Agent-Workspaces. Dieses Repo ist ein Skill-Adapter-Repository im Shared-Skills-Submodule (`https://github.com/martinderm/fireflies-api`), kein Agent-Workspace; die folgenden Findings sind deshalb keine Schulden, sondern strukturell nicht anwendbar:

- `WS-A01` (AGENTS.md missing): Ein Root-`AGENTS.md` ist für konsumierende Agent-Workspaces gedacht; der Einstieg hier ist `SKILL.md` bzw. `README.md`.
- `WS-G03` (upstream.lock.json missing): Gilt für Fach-Workspaces, die Standards/Skills konsumieren. Skill-Repos sind Upstream, nicht Konsument.
- `WS-C01` (workspace-architecture.json missing): Control-Plane-Deklaration ist pro Agent-Workspace; ein Skill-Adapter hat keine operative Control Plane (bewusst `none`).
- `WS-M03` (broken README-Link) wurde im Run `d706980` behoben.
- `WS-H01`/`WS-H02` (INFO): Editor-Convinienece, nicht relevant.

## Erledigt im Run

- Secrets-Fallback (`7759190`), Transcript-CLI (`dc0d4c2` + Fix), System Map (`542bd4d` … `615a4a0`), Hygiene (`53bf5fb`).