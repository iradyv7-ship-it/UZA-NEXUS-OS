# UZA Nexus OS

Operating system for UZA Solutions Ltd. **v1 scope: UZA Bulk, China → Kigali/Goma.**

## Why the repo looks like this

Built by parallel Claude Code subagents that cannot communicate with each other.
Shared knowledge therefore lives in files, not conversation:

- `CLAUDE.md` — loaded into every agent at startup; the business rules
- `packages/contracts` — the shared kernel; only `contracts-guardian` writes here
- `docs/integration-contract.md` — how modules stay compatible
- `tests/conformance/SPEC.md` — 30 assertions every module is measured against
- `reference/` — the Python spike that validated the design; the oracle
- `docs/TOOLING.md` — every tool, service and credential needed through to launch

## Start here

`BOOTSTRAP.md`

## Run the oracle

```bash
cd reference && python3 run_scenarios.py    # expect 30 passed, 0 failed
```
