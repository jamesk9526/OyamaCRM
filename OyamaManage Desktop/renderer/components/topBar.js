export function createTopBar({ onOpenSettings, connectionLabel = "" } = {}) {
  const topBar = document.createElement("header");
  topBar.className = "workspace-topbar";
  topBar.setAttribute("aria-label", "Top bar");
  topBar.innerHTML = `
    <div class="workspace-topbar__drag" aria-hidden="true">
      <img class="workspace-topbar__logo" src="./assets/oyama-crm-logo.png" alt="" />
      <div class="workspace-topbar__titlewrap">
        <p class="workspace-topbar__title">OyamaManage Desktop</p>
        ${connectionLabel ? `<p class="workspace-topbar__subtitle">${connectionLabel}</p>` : ""}
      </div>
    </div>
    <div class="workspace-topbar__actions">
      <button type="button" class="workspace-topbar__button">Settings</button>
      <button type="button" class="workspace-topbar__control" data-action="minimize" aria-label="Minimize window">—</button>
      <button type="button" class="workspace-topbar__control" data-action="maximize" aria-label="Maximize window">▢</button>
      <button type="button" class="workspace-topbar__control workspace-topbar__control--close" data-action="close" aria-label="Close window">×</button>
    </div>
  `;

  const settingsButton = topBar.querySelector(".workspace-topbar__button");
  if (settingsButton && typeof onOpenSettings === "function") {
    settingsButton.addEventListener("click", onOpenSettings);
  }

  topBar.querySelectorAll("[data-action]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (!action) return;
      void window.oyamaDesktop.windowControl(action);
    });
  });

  return topBar;
}
