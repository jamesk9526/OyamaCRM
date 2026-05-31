type BooleanStateSetter = (open: boolean) => void;

export interface TopBarPanelSetters {
  setAppsOpen: BooleanStateSetter;
  setFeedbackOpen: BooleanStateSetter;
  setNotificationsOpen: BooleanStateSetter;
  setMobileQuickOpen: BooleanStateSetter;
  setMobileSearchOpen: BooleanStateSetter;
  setCompactActionsOpen: BooleanStateSetter;
  setMessengerOpen: BooleanStateSetter;
}

/** Opens the app launcher and closes lightweight popovers/sheets that can overlap it. */
export function openAppsFromTopBarLauncher(setters: TopBarPanelSetters): void {
  setters.setAppsOpen(true);
  setters.setNotificationsOpen(false);
  setters.setMessengerOpen(false);
  setters.setMobileQuickOpen(false);
  setters.setMobileSearchOpen(false);
  setters.setCompactActionsOpen(false);
}

/** Opens apps from the user menu context while preserving existing modal states. */
export function openAppsFromUserMenu(setters: TopBarPanelSetters): void {
  setters.setAppsOpen(true);
  setters.setNotificationsOpen(false);
  setters.setMessengerOpen(false);
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
