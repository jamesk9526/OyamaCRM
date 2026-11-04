# Communications navigation restoration

Restored OyamaLetters (`/oyama-letters`) and OyamaEmail (`/oyama-email`) immediately after oyamaCreate in shared donor navigation and in the Apps launcher. Existing standalone page components and server authorization remain unchanged.

## Verification

- `pnpm exec vitest run tests/unit/crm-sidebar-navigation.test.ts`: 14 tests passed. Existing transition assertions now require the standalone links and shared daily navigation retains all specialist destinations without duplicates.
- Targeted ESLint on both changed components and the navigation test: passed.
- `pnpm typecheck:web`: passed.
- `git diff --check`: passed.
- Inspected `after-desktop.png` (Apps), `after-donor-desktop.png` (1440px donor navigation) and `after-mobile.png` (390px navigation dialog). Labels fit, all three destinations are adjacent, and spacing and contrast follow the existing controls. No visual redesign or reference comparison was required for this link restoration.
- Synthetic browser responses supplied an administrator fixture; API writes were blocked. Desktop/mobile link visibility, keyboard focus on Letters and absence of mobile document overflow were checked successfully in the first donor pass. The synthetic settings fixture shows a custom-field load error; it is unrelated to the restored navigation.

## Limits

Initial sandbox network failures prevented a before screenshot. Later browser runs timed out during destination click-through and, on repeat, donor-shell readiness. Full authenticated workspace interaction and deployment verification are not claimed. No deployment, outbound communication or CRM data write was performed.
