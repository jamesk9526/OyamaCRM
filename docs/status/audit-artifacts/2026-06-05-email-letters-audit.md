# Email and Letters Audit - 2026-06-05

## Scope

- OyamaEmail campaign/template workspace
- OyamaLetters builder/generation/signature/PDF paths
- Donation multi-select handoffs into email and letters

## Fixes Completed

| Finding | Status | Evidence |
|---|---|---|
| Donations multi-select only handed selected donors to letters, not email templates. | Fixed | `app/donations/page.tsx`, `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Temporary donation email recipients could be lost if the user entered queue/schedule flows that do not persist explicit recipients on the campaign record. | Fixed with truthful UI gate | Queue/schedule disabled for explicit temporary/manual/list audiences; immediate confirmed send remains available after review. |
| Letter PDFs previously risked dropping intentional blank lines, explicit spacing, dividers, line height, uploaded images, and uploaded signatures. | Fixed in current pass set | `server/src/routes/letters.ts`, `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/letters/LetterSignaturesManager.tsx`, `tests/unit/letters-pdf-layout.test.ts` |
| Signature blocks were required even when a template did not need a signature. | Fixed | Signature selection is optional and uploaded/drawn signature images render in server PDFs. |

## Remaining Gaps

| Area | Status | Notes |
|---|---|---|
| Persist explicit email audiences for later queue/schedule | Partially Working | Temporary/manual/list email selections can be reviewed and sent now. They need a persisted audience snapshot model before queue/schedule should be enabled. |
| Email wizard browser prompts | Partially Working | Some test-send, schedule, archive, and detail-workspace actions still use `window.prompt` / `window.confirm`. They are functional, but should be replaced with modal workflows for consistency and accessibility. |
| Email compliance footer review copy | Partially Working | Server compliance helpers append/validate unsubscribe/preference controls, but the wizard still summarizes this as a template-footer check. Needs clearer preflight detail. |
| Browser visual verification | Broken in this environment | In-app browser/node sandbox failed with `windows sandbox failed: spawn setup refresh`; source and command validation passed instead. |

## Validation Evidence

- `pnpm typecheck` passed.
- `pnpm exec vitest run tests/smoke/oyama-email-workspace-source.test.ts tests/smoke/letter-builder-ui-source.test.ts tests/unit/letters-pdf-layout.test.ts tests/smoke/donations-crud.test.ts` passed: 4 files, 29 tests.
