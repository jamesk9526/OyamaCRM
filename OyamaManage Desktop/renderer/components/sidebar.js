export function createSidebar({ activeItem = "dashboard", onSelect } = {}) {
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-sidebar";
  sidebar.setAttribute("aria-label", "Sidebar");
  sidebar.innerHTML = `
    <div class="workspace-sidebar__brand">
      <img class="workspace-sidebar__logo" src="./assets/oyama-crm-logo.png" alt="Oyama CRM" />
    </div>
    <nav class="workspace-sidebar__nav" aria-label="Primary navigation">
      <button
        type="button"
        class="workspace-sidebar__navitem${activeItem === "dashboard" ? " workspace-sidebar__navitem--active" : ""}"
        data-nav="dashboard"
        aria-current="${activeItem === "dashboard" ? "page" : "false"}"
      >
        <span class="workspace-sidebar__navicon">D</span>
        <span class="workspace-sidebar__navlabel">Dashboard</span>
      </button>
    </nav>
  `;

  sidebar.querySelectorAll("[data-nav]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      onSelect?.(button.dataset.nav || "dashboard");
    });
  });

  return sidebar;
}
