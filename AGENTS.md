# OyamaCRM design and engineering guide

## Visual direction and UI flexibility

Design each screen around the user's main task. The user-supplied light blue DonorCRM reference establishes the preferred donor dashboard direction; it is a starting point for the wider product, not a fixed layout for every module. A current user request or a newer supplied reference takes precedence over older visual conventions.

- For the donor dashboard, retain the reference's compact top bar, slim light sidebar, horizontal donor tabs, illustrated welcome banner, summary cards, giving charts and operational cards as the preferred composition. Adapt proportions and ordering when real content, screen size or the requested workflow benefits.
- Across donor pages, favor readable navy typography, blue actions, light surfaces, quiet borders and restrained shadows. Reuse shared tokens and controls to keep related screens coherent.
- Agents may change layout, navigation placement, spacing, density, typography scale, corner radii, card structure and responsive breakpoints within the requested scope without seeking design approval for routine choices.
- Letters, Email, Events, builders and other specialized workspaces may use their own scoped visual treatment and task-specific layouts. Writing canvases, inspectors and print proofs do not need to follow dashboard composition.
- Remove redundant navigation and obsolete style overrides when they obstruct the design. Prefer component styles and scoped tokens over global rules that force unrelated screens into one appearance.
- Make the main action obvious, keep advanced tools discoverable, and use whitespace to separate tasks without pushing useful content below oversized headers or promotional panels.
- Keep public documents and printed output styled independently from application chrome. UI improvements must not silently change document layout or print fidelity.

## Implementation

Make normal in-scope changes without requesting permission. Refactor components and remove obsolete style rules when needed to improve the requested experience. Preserve working routes, capabilities and permission checks. Use real CRM data, meaningful loading/error/empty states and working actions; never copy a reference's sample numbers or add nonfunctional controls. Keep existing capabilities discoverable when rearranging a screen.

Use reusable components in app/components and feature logic with its module. Preserve unrelated user changes. Keep tenant and user authorization enforced server-side. Keep outbound communications and high-impact writes reviewable and validated.

## Verification

Inspect rendered desktop and mobile screens and compare before/after views. When an applicable reference is available, compare against it and explain material intentional departures. If it is unavailable, state that limit and verify against the task and the relevant design guidance instead. Check density, alignment, text contrast, wrapping, keyboard focus, navigation and real interactions. Run focused type/lint/test checks proportional to the change. Use synthetic data only in clearly identified tests and evidence. Report actual evidence and unresolved gaps honestly; do not claim pixel equivalence without a visual comparison.

Update docs/status/features.md and docs/status/production-readiness-checklist.md for material behavior changes. Store visual evidence under docs/status/audit-artifacts. Keep root Markdown limited to README.md, LICENSE.md and AGENTS.md. No destructive git operations without explicit authorization.
