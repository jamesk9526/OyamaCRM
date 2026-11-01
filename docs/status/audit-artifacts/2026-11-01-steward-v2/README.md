# Steward v2 evidence — November 1, 2026

Application browser captures use synthetic intercepted QA data. Desktop captures use an isolated temporary profile and synthetic feedback; they do not overwrite the installed app's profile.

| View | Screenshot |
| --- | --- |
| Chathead | [Desktop](chathead-desktop.png) |
| Response and feedback | [Desktop](chathead-response-desktop.png) |
| Quick actions and memory | [Desktop](chathead-actions-desktop.png) |
| Chathead mobile | [Mobile](chathead-mobile.png) |
| Master improvements log | [Desktop](master-improvements-desktop.png), [mobile](master-improvements-mobile.png) |
| Packaged bridge dashboard | [Desktop](bridge-dashboard.png) |
| Packaged bridge improvements | [Desktop](bridge-improvements.png) |

`workspace-desktop.png` and `workspace-mobile.png`, if present, are earlier pre-chathead audit captures; the chathead files above are the final UI.

## Verification

- 104 focused unit/API tests passed across 15 suites: Steward Paths, playbooks, prompt policy, action execution, private thinking/finalization, extractive compaction, feedback permissions/persistence, and model-free API paths.
- 15 Node desktop tests passed, including auth/CORS, GPU/request settings, runtime ownership, feedback persistence/restart/retry, and local support playbooks.
- Both web/server TypeScript checks passed; focused ESLint and diff whitespace checks passed.
- `checks.json` records chathead browser checks: open/close/focus, streaming response, errors, reviewed workflows, feedback submission, responsive geometry, and contextual events. The master log was captured with synthetic data.
- `bridge-checks.json` records the packaged executable check, with no renderer errors. Feedback survived an unconnected sync. The source app was also exercised before packaging.
- `model-check.json` records four live synthetic model cases, private thinking character count, bounded final completion when thinking exhausted its budget, CUDA discovery on the RTX 5060 Ti, and model state/VRAM. It is not a comprehensive accuracy benchmark. It does not contain private reasoning text.
- `installer.json` records installer size and SHA-256. The NSIS build completed and the packaged executable launched successfully. No signing certificate was supplied.

## Boundaries

No production deployment, live outbound communication, fresh-machine installation, or production feedback pairing was performed. API tests use mocked persistence for feedback and playbooks; failure and tenant boundaries were exercised without altering live organization data. Paths checks cover focused workflow behavior and compilation, not every operational scenario against a live tenant.

See [the operating guide](../../../modules/steward-v2.md) for setup, feedback connection, memory/thinking behavior, and current limitations.
