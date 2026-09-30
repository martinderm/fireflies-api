# TODO — Bekannte Altlasten

Präexistierende Befunde, die nicht durch den Run `daedalus/runs/2026-09-30-fireflies-api-issues-batch-a` verursacht wurden.

- `WS-A01` / `AGENTS.md` / "AGENTS.md is missing from workspace root" — Run-Referenz: `2026-09-30T171600Z-ffa-issues-batch-a` (Workspace-Lint full scope). Kein ICM-Root-Kontext im Repo vorhanden; System Map liegt unter `docs/system-map/README.md`. Entscheidung über Anlage eines Root-`AGENTS.md` steht dem Owner zu.
- `WS-G03` / `.agents/upstream.lock.json` / "Lockfile missing. Run upstream_lock.py generate" — Run-Referenz: `2026-09-30T171600Z-ffa-issues-batch-a`. Betrifft Upstream-Submodule-Governance, nicht Teil dieses Runs.
- `WS-C01` / Control Plane / "No topology-neutral workspace architecture profile exists; control-plane conformance is unassessed" — Run-Referenz: `2026-09-30T171600Z-ffa-issues-batch-a`. `.agents/workspace-architecture.json` existiert nicht; bewusste Entscheidung des Owners nötig.
- libuv-Assertion-Crash (exit `-1073740791`, `UV_HANDLE_CLOSING`) nach vollständigem printError-Envelope im echten API-Fehlerpfad auf Node v24.18.0/win32; an Base `d373cd1` identisch reproduziert (Review FFA-A-REV-002, Falsification). Workaround-Idee: `process.exitCode = 1` statt `process.exit()` in den Fehlerpfaden. Run-Referenz: `2026-09-30T171600Z-ffa-issues-batch-a`.

Befunde, die durch den Run verursacht und im Run bereits behoben wurden, sind hier nicht aufgeführt.