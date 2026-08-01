type BooleanStateSetter = (open: boolean) => void;

export interface TopBarPanelSetters {
  setFeedbackOpen: BooleanStateSetter;
  setNotificationsOpen: BooleanStateSetter;
  setMobileQuickOpen: BooleanStateSetter;
  setMobileSearchOpen: BooleanStateSetter;
  setCompactActionsOpen: BooleanStateSetter;
  setMessengerOpen: BooleanStateSetter;
}

/** Opens feedback while collapsing competing topbar popovers. */
export function openFeedbackFromUserMenu(setters: TopBarPanelSetters): void {
  setters.setFeedbackOpen(true);
  setters.setNotificationsOpen(false);
  setters.setMessengerOpen(false);
}

/** Opens donor messages while ensuring notifications popover is closed. */
export function openMessagesFromUserMenu(setters: TopBarPanelSetters): void {
  setters.setMessengerOpen(true);
  setters.setNotificationsOpen(false);
}
