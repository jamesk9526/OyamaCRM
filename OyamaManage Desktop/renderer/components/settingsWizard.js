import { normalizeBaseUrl } from "../lib/connection-store.js";

export function createSettingsWizard({ initialConnection, onClose, onConnected }) {
  const overlay = document.createElement("div");
  overlay.className = "settings-modal-overlay";

  const modal = document.createElement("section");
  modal.className = "settings-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Oyama API connection wizard");

  const header = document.createElement("div");
  header.className = "settings-modal__header";
  header.innerHTML = `
    <div>
      <p class="settings-modal__eyebrow">Connection Wizard</p>
      <h2 class="settings-modal__title">Connect Oyama CRM</h2>
      <p class="settings-modal__subtitle">Enter your instance URL, detect the API, then open a login window inside the app.</p>
    </div>
    <button type="button" class="settings-modal__close" aria-label="Close settings">×</button>
  `;

  const body = document.createElement("div");
  body.className = "settings-modal__body";
  body.innerHTML = `
    <label class="settings-field">
      <span>Oyama CRM URL</span>
      <input type="url" spellcheck="false" placeholder="https://your-oyama-instance.com" />
    </label>
    <div class="settings-actions">
      <button type="button" class="settings-button settings-button--primary" data-action="detect">Detect Instance</button>
      <button type="button" class="settings-button" data-action="login" disabled>Open Login</button>
      <button type="button" class="settings-button" data-action="clear">Clear</button>
    </div>
    <div class="settings-status">
      <p class="settings-status__label">Status</p>
      <p class="settings-status__text" data-role="status-text"></p>
      <p class="settings-status__detail" data-role="status-detail"></p>
    </div>
  `;

  const footer = document.createElement("div");
  footer.className = "settings-modal__footer";
  footer.innerHTML = `
    <p class="settings-modal__footnote">Detection checks <code>/api/health</code> first, then <code>/health</code>.</p>
  `;

  modal.append(header, body, footer);
  overlay.append(modal);

  const input = body.querySelector("input");
  const statusText = body.querySelector('[data-role="status-text"]');
  const statusDetail = body.querySelector('[data-role="status-detail"]');
  const detectButton = body.querySelector('[data-action="detect"]');
  const loginButton = body.querySelector('[data-action="login"]');
  const clearButton = body.querySelector('[data-action="clear"]');
  const closeButton = header.querySelector(".settings-modal__close");

  if (!input || !statusText || !statusDetail || !detectButton || !loginButton || !clearButton || !closeButton) {
    throw new Error("Settings wizard failed to initialize.");
  }

  const state = {
    baseUrl: initialConnection?.baseUrl ?? "",
    details: initialConnection ?? null,
    loading: false,
    error: "",
    status: initialConnection?.baseUrl ? "Connected instance saved locally." : "Enter an Oyama CRM URL to begin.",
  };

  input.value = state.baseUrl;

  function describeConnection(details) {
    if (!details?.baseUrl) return "";
    const parts = [details.appName || "Oyama CRM"];
    if (details.version) parts.push(`v${details.version}`);
    if (details.environment) parts.push(details.environment);
    return `${parts.join(" • ")} • ${details.baseUrl}`;
  }

  function sync() {
    statusText.textContent = state.loading ? "Working..." : state.status;
    statusDetail.textContent = state.error || describeConnection(state.details);
    loginButton.disabled = !state.details?.baseUrl || state.loading;
    detectButton.disabled = state.loading;
    clearButton.disabled = state.loading;
    input.disabled = state.loading;
  }

  async function probe() {
    const baseUrl = normalizeBaseUrl(input.value);
    state.baseUrl = baseUrl;
    if (!baseUrl) {
      state.details = null;
      state.error = "Enter a valid URL like https://your-instance.com.";
      state.status = "No valid URL configured.";
      sync();
      return;
    }

    state.loading = true;
    state.error = "";
    state.status = "Detecting instance...";
    sync();

    try {
      const result = await window.oyamaDesktop.probeInstance(baseUrl);
      if (!result?.ok) {
        throw new Error(result?.message || "Could not detect this instance.");
      }
      state.details = {
        baseUrl,
        appName: result.appName || "Oyama CRM",
        version: result.version || "",
        environment: result.environment || "",
        status: result.status || "",
      };
      state.status = "Instance detected. You can open login now.";
      onConnected(state.details);
    } catch (error) {
      state.details = null;
      state.error = error instanceof Error ? error.message : "Could not detect this instance.";
      state.status = "Detection failed.";
    } finally {
      state.loading = false;
      sync();
    }
  }

  async function openLogin() {
    const baseUrl = state.details?.baseUrl || normalizeBaseUrl(input.value);
    if (!baseUrl) {
      state.error = "Detect an instance first.";
      sync();
      return;
    }

    state.loading = true;
    state.status = "Opening login window...";
    sync();

    try {
      await window.oyamaDesktop.openLoginWindow(baseUrl);
      state.status = "Login window opened. Sign in there, then return here.";
      state.error = "";
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Could not open the login window.";
    } finally {
      state.loading = false;
      sync();
    }
  }

  function clear() {
    input.value = "";
    state.baseUrl = "";
    state.details = null;
    state.error = "";
    state.status = "Enter an Oyama CRM URL to begin.";
    sync();
  }

  detectButton.addEventListener("click", () => void probe());
  loginButton.addEventListener("click", () => void openLogin());
  clearButton.addEventListener("click", clear);
  closeButton.addEventListener("click", onClose);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) onClose();
  });
  input.addEventListener("input", () => {
    state.baseUrl = normalizeBaseUrl(input.value);
    state.details = null;
    state.error = "";
    state.status = "Enter a valid URL and detect the instance.";
    sync();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void probe();
    }
  });

  sync();
  return overlay;
}
