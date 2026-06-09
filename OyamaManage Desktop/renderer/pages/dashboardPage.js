function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatConstituentName(item) {
  const organizationName = String(item?.organizationName ?? "").trim();
  if (organizationName) return organizationName;
  const fullName = [item?.firstName ?? "", item?.lastName ?? ""].join(" ").trim();
  if (fullName) return fullName;
  const contactName = [item?.contactFirstName ?? "", item?.contactLastName ?? ""].join(" ").trim();
  return contactName || "Unnamed Constituent";
}

function formatSecondaryLine(item) {
  const parts = [
    String(item?.email ?? "").trim(),
    String(item?.phone ?? "").trim(),
    String(item?.donorStatus ?? "").trim(),
  ].filter(Boolean);
  return parts.join(" • ") || "No contact details";
}

function createStatePanel(title, body, actionLabel, onAction) {
  const panel = document.createElement("section");
  panel.className = "desktop-empty-state";
  panel.innerHTML = `
    <p class="desktop-empty-state__eyebrow">Desktop Client</p>
    <h2 class="desktop-empty-state__title">${title}</h2>
    <p class="desktop-empty-state__body">${body}</p>
  `;

  if (actionLabel && typeof onAction === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "desktop-primary-button";
    button.textContent = actionLabel;
    button.addEventListener("click", onAction);
    panel.append(button);
  }

  return panel;
}

function createSummaryStat(label, value) {
  const stat = document.createElement("article");
  stat.className = "desktop-stat";
  stat.innerHTML = `
    <p class="desktop-stat__label">${label}</p>
    <p class="desktop-stat__value">${value}</p>
  `;
  return stat;
}

function createMetaRow(label, value) {
  const row = document.createElement("div");
  row.className = "desktop-meta-row";
  row.innerHTML = `
    <dt>${label}</dt>
    <dd>${value}</dd>
  `;
  return row;
}

function createTagPill(label, color) {
  const pill = document.createElement("span");
  pill.className = "desktop-tag";
  pill.textContent = label;
  if (color) {
    pill.style.setProperty("--desktop-tag-accent", color);
  }
  return pill;
}

export function createDashboardPage({
  connection,
  dashboard,
  selectedConstituentId,
  onSelectConstituent,
  onRefresh,
  onOpenSettings,
} = {}) {
  const page = document.createElement("section");
  page.className = "desktop-dashboard";
  page.setAttribute("aria-label", "Dashboard");

  if (!connection?.baseUrl) {
    page.append(
      createStatePanel(
        "Connect an Oyama CRM instance",
        "This desktop client uses the existing web API. Open Settings, connect your instance URL, and sign in before the dashboard can load live constituents.",
        "Open Settings",
        onOpenSettings,
      ),
    );
    return page;
  }

  if (dashboard?.loading && !dashboard?.data) {
    page.append(
      createStatePanel(
        "Loading constituents",
        "Refreshing the signed-in desktop session and requesting the current user plus the first constituent page from the API.",
      ),
    );
    return page;
  }

  if (dashboard?.error && !dashboard?.data) {
    page.append(
      createStatePanel(
        "Desktop data unavailable",
        dashboard.error,
        "Open Settings",
        onOpenSettings,
      ),
    );
    return page;
  }

  const data = dashboard?.data ?? {};
  const health = data.health ?? {};
  const user = data.user ?? {};
  const constituentPayload = data.constituents ?? {};
  const items = Array.isArray(constituentPayload.items)
    ? constituentPayload.items
    : Array.isArray(constituentPayload)
      ? constituentPayload
      : [];
  const selected = items.find((item) => item?.id === selectedConstituentId) || items[0] || null;
  const organizationName = user.organization?.name || connection.appName || "Oyama CRM";
  const total = Number(constituentPayload.total ?? items.length ?? 0);
  const active = Number(constituentPayload.summary?.active ?? 0);
  const lapsed = Number(constituentPayload.summary?.lapsed ?? 0);

  const header = document.createElement("header");
  header.className = "desktop-dashboard__header";
  header.innerHTML = `
    <div class="desktop-dashboard__heading">
      <p class="desktop-dashboard__eyebrow">OyamaManage Desktop</p>
      <h1 class="desktop-dashboard__title">Constituent workspace</h1>
      <p class="desktop-dashboard__subtitle">Desktop-first donor management against the live Oyama API. This slice focuses only on connected-user context and constituent loading.</p>
    </div>
  `;

  const headerActions = document.createElement("div");
  headerActions.className = "desktop-dashboard__actions";
  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "desktop-secondary-button";
  settingsButton.textContent = "Settings";
  settingsButton.addEventListener("click", () => onOpenSettings?.());
  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "desktop-primary-button";
  refreshButton.textContent = dashboard?.loading ? "Refreshing..." : "Refresh";
  refreshButton.disabled = Boolean(dashboard?.loading);
  refreshButton.addEventListener("click", () => onRefresh?.());
  headerActions.append(settingsButton, refreshButton);
  header.append(headerActions);
  page.append(header);

  const stats = document.createElement("section");
  stats.className = "desktop-dashboard__stats";
  stats.append(
    createSummaryStat("Loaded", String(items.length)),
    createSummaryStat("Directory Total", String(total)),
    createSummaryStat("Active Donors", String(active)),
    createSummaryStat("Lapsed", String(lapsed)),
    createSummaryStat("Operator", [user.firstName || "", user.lastName || ""].join(" ").trim() || user.email || "Unknown"),
    createSummaryStat("API", health.status || "Unknown"),
  );
  page.append(stats);

  const workspace = document.createElement("section");
  workspace.className = "desktop-dashboard__workspace";

  const listPane = document.createElement("aside");
  listPane.className = "desktop-directory";
  listPane.innerHTML = `
    <div class="desktop-panel-header">
      <div>
        <p class="desktop-panel-header__eyebrow">Constituents</p>
        <h2 class="desktop-panel-header__title">${organizationName}</h2>
      </div>
      <p class="desktop-panel-header__meta">${items.length} loaded</p>
    </div>
  `;

  const list = document.createElement("div");
  list.className = "desktop-directory__list";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "desktop-directory__empty";
    empty.textContent = "No constituents were returned by the API for this session.";
    list.append(empty);
  } else {
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `desktop-directory__item${selected?.id === item.id ? " desktop-directory__item--active" : ""}`;
      button.innerHTML = `
        <span class="desktop-directory__name">${formatConstituentName(item)}</span>
        <span class="desktop-directory__meta">${formatSecondaryLine(item)}</span>
      `;
      button.addEventListener("click", () => onSelectConstituent?.(item.id));
      list.append(button);
    }
  }

  listPane.append(list);

  const detailPane = document.createElement("section");
  detailPane.className = "desktop-record";

  if (!selected) {
    detailPane.append(
      createStatePanel(
        "No constituent selected",
        "The connected instance did not return any constituent rows for the first page.",
      ),
    );
  } else {
    const recordHeader = document.createElement("header");
    recordHeader.className = "desktop-record__hero";
    recordHeader.innerHTML = `
      <div>
        <p class="desktop-record__eyebrow">Selected Record</p>
        <h2 class="desktop-record__title">${formatConstituentName(selected)}</h2>
        <p class="desktop-record__subtitle">${formatSecondaryLine(selected)}</p>
      </div>
      <div class="desktop-record__status">
        <span class="desktop-record__statuschip">${selected.donorStatus || selected.type || "Constituent"}</span>
      </div>
    `;
    detailPane.append(recordHeader);

    const detailGrid = document.createElement("div");
    detailGrid.className = "desktop-record__grid";

    const profileCard = document.createElement("article");
    profileCard.className = "desktop-record-card";
    profileCard.innerHTML = `
      <div class="desktop-panel-header">
        <div>
          <p class="desktop-panel-header__eyebrow">Profile</p>
          <h3 class="desktop-panel-header__title">Core details</h3>
        </div>
      </div>
    `;
    const profileMeta = document.createElement("dl");
    profileMeta.className = "desktop-meta-list";
    profileMeta.append(
      createMetaRow("Email", selected.email || "Not available"),
      createMetaRow("Phone", selected.phone || "Not available"),
      createMetaRow("Type", selected.type || "Unknown"),
      createMetaRow("Entity", selected.entityKind || "PERSON"),
      createMetaRow("Address", [selected.addressLine1, selected.city, selected.state, selected.zip].filter(Boolean).join(", ") || "Not available"),
      createMetaRow("Contact", [selected.contactFirstName || "", selected.contactLastName || ""].join(" ").trim() || "Not available"),
    );
    profileCard.append(profileMeta);

    const givingCard = document.createElement("article");
    givingCard.className = "desktop-record-card";
    givingCard.innerHTML = `
      <div class="desktop-panel-header">
        <div>
          <p class="desktop-panel-header__eyebrow">Giving</p>
          <h3 class="desktop-panel-header__title">Fundraising snapshot</h3>
        </div>
      </div>
    `;
    const givingMeta = document.createElement("dl");
    givingMeta.className = "desktop-meta-list";
    givingMeta.append(
      createMetaRow("Lifetime", formatMoney(selected.totalLifetimeGiving)),
      createMetaRow("YTD", formatMoney(selected.totalYtdGiving)),
      createMetaRow("Last Gift", selected.lastGiftDate ? `${selected.lastGiftDate} • ${formatMoney(selected.lastGiftAmount)}` : "No gift recorded"),
      createMetaRow("Gift Count", String(selected.giftCount ?? 0)),
      createMetaRow("Engagement", String(selected.engagementScore ?? 0)),
      createMetaRow("Do Not Mail", selected.doNotMail ? "Yes" : "No"),
    );
    givingCard.append(givingMeta);

    const systemCard = document.createElement("article");
    systemCard.className = "desktop-record-card desktop-record-card--wide";
    systemCard.innerHTML = `
      <div class="desktop-panel-header">
        <div>
          <p class="desktop-panel-header__eyebrow">Desktop Session</p>
          <h3 class="desktop-panel-header__title">Instance context</h3>
        </div>
      </div>
    `;
    const systemMeta = document.createElement("dl");
    systemMeta.className = "desktop-meta-list";
    systemMeta.append(
      createMetaRow("Organization", organizationName),
      createMetaRow("Instance", connection.baseUrl),
      createMetaRow("Version", health.version || "Unknown"),
      createMetaRow("Environment", health.environment || "Unknown"),
      createMetaRow("Database", health.database || "Unknown"),
      createMetaRow("Last Refresh", formatDateTime(data.fetchedAt)),
    );
    systemCard.append(systemMeta);

    if (Array.isArray(selected.tags) && selected.tags.length > 0) {
      const tagRow = document.createElement("div");
      tagRow.className = "desktop-record-card__tags";
      for (const entry of selected.tags) {
        const name = entry?.tag?.name;
        if (!name) continue;
        tagRow.append(createTagPill(name, entry?.tag?.color || ""));
      }
      systemCard.append(tagRow);
    }

    detailGrid.append(profileCard, givingCard, systemCard);
    detailPane.append(detailGrid);
  }

  workspace.append(listPane, detailPane);
  page.append(workspace);
  return page;
}
