# oyamaCreate guidance and block preview verification — 2026-11-04

All CRM users, recipient totals and communications in this evidence are synthetic browser fixtures. No live send, publication, release or CRM write occurred.

## Changes and cause

- Replaced the Home promotional copy with four numbered instructions, using existing campaign creation and template actions.
- Added task-specific instructions to Content, Audience, Review, Delivery and Results, with next-step navigation through the existing editor flush guard. Campaign setup explains the next action after saving.
- Giving summary appeared to insert “Yes, I want to help” because `AtomicBlock` rendered a single-node design while retaining the full pack’s enabled attached reply slip. Every atomic preview could append that same reply slip. `blockPreviewDesign` disables the slip only for that individual preview. Campaign data and full-pack rendering remain intact.
- Gallery cards now display their purpose, explain cursor placement and donor preview, preserve the writing cursor on mouse selection, select the inserted block and report which block was added. A selected block is retained when inserting the next gallery choice. Giving summary settings explain selecting a CRM recipient and applying their preview.

## Actual checks

- 62 tests pass across `create-studio-block-preview`, `create-studio` and `create-studio-block-actions`. New cases assert correct giving totals, absent reply-choice content in the block, retained reply choices in full-pack rendering, and block-specific missing-data guidance.
- Web TypeScript check and targeted ESLint pass. `git diff --check` passes.
- Chromium inserted and persisted all 26 gallery block types and verified earlier blocks remained in the saved document. [Block acceptance results](block-checks.json).
- Focused browser reproduction against original source confirms the reply choices appear inside Giving summary. The corrected version displays $125 across one recorded gift and no reply choices inside the block. Full-pack renderer still includes the slip. [Before](before-giving-summary-desktop.png), [after](after-giving-summary-desktop.png), [original reproduction results](before-giving-summary-checks.json), [corrected results](after-giving-summary-checks.json).
- Home/setup and final campaign instructions checked at 1440 and 390 pixels. Next-step actions navigate without writing or releasing anything. The final screens have no document horizontal overflow. [Desktop Home before](before-home-1440.png), [after](after-home-1440.png), [phone Home before](before-home-390.png), [after](after-home-390.png).
- Representative helper text measures 4.94:1 contrast. Keyboard focus has a visible outline and Enter activates the next-step button. [Accessibility results](accessibility-checks.json).
- Desktop/phone block views were inspected. The mobile gallery and Giving summary settings remain available through their panel controls.

## Limits and environment

No external design reference was supplied for this workspace change; comparison used the existing Create UI and repository guidance. The numbered Home guide intentionally uses more vertical space to explain the workflow. App styling is scoped outside public documents and print output.

The original mobile campaign-content capture timed out; before/after phone comparisons cover Home/setup and the targeted Giving summary reproduction. Earlier development-server attempts encountered loopback restrictions, stale HMR chunks and a partially written Next manifest during source swapping. A fresh isolated `.next-create-guidance` build completed the final desktop flow with no console errors or warnings, but subsequent repeat phone runs hit Windows `UNKNOWN` file-open errors for the generated `app/layout.js` chunk. An earlier complete desktop/phone run passed; the latest phone rerun could not finish. The temporary build and generated configuration changes were removed. Production build, deployed authentication/permissions, actual donor records, providers and physical printing were not exercised for this UI change.

Browser scripts are retained here for reproducibility. Set `PLAYWRIGHT_BROWSERS_PATH` to the installed browser cache if required and `CREATE_UI_WEB` to the local app origin. `block-browser.mjs` supports `BLOCK_TARGETED=1` for the focused reproduction; default checks all 26 gallery blocks. `guidance-browser.mjs` supports `GUIDANCE_PHASE=after` and `GUIDANCE_WIDTH=1440` or `390`. Original-source captures used temporary original files with guaranteed restoration in a Python `finally` block.
