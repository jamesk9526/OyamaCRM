# Steward AI Workspace Plan

Last updated: 2026-05-10

## UI Audit Summary
Current Steward implementation includes:
- Top-bar launch control.
- Docked panel with thread history, mode pills, streaming responses.
- Minimize and close behavior.
- Link to dedicated steward-ai-workspace route.

## Needed Improvements
- Stronger window-state controls for collapsed, docked, popout, and maximized modes.
- Taller and less cramped chat space.
- Better shell alignment with top bar and viewport edges.
- Cleaner, lighter dock styling for readability and reduced visual weight.

## Behavior Model
- collapsed: panel hidden.
- dock-right: professional right-docked assistant panel.
- popout: in-app floating window (not OS-level popout).
- maximized: large in-app assistant workspace panel.

## Chat History and State
- Multi-thread local history remains in localStorage.
- Layout mode changes preserve thread/message state.
- Clear conversation now requires explicit confirmation.

## Steward to OGentic Handoff
- Steward stores handoff payload in sessionStorage:
  - prompt
  - sourceRoute
  - contextType
  - createdAt
- OGentic reads handoff on open and displays incoming context.

## Next Steps
1. Add role-aware safeguards for high-risk actions.
2. Persist chat/thread state server-side.
3. Wire real OGentic tools to backend APIs.
