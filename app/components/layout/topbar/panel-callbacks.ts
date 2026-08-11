type BooleanStateSetter = (open: boolean) => void;

export interface TopBarPanelSetters {
  setFeedbackOpen: BooleanStateSetter;
  setNotificationsOpen: BooleanStateSetter;
  setMobileQuickOpen: BooleanStateSetter;
  setMobileSearchOpen: BooleanStateSetter;
  setCompactActionsOpen: BooleanStateSetter;
}

/** Opens feedback while collapsing competing topbar popovers. */
export function openFeedbackFromUserMenu(setters: TopBarPanelSetters): void {
  setters.setFeedbackOpen(true);
  setters.setNotificationsOpen(false);
}
