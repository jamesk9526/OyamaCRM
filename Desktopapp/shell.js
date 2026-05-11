// Renderer logic for setup flow, shell color customization, and CRM webview binding.
const setupPane = document.getElementById("setupPane");
const crmPane = document.getElementById("crmPane");
const urlInput = document.getElementById("urlInput");
const setupMessage = document.getElementById("setupMessage");
const crmView = document.getElementById("crmView");
const boundUrlLabel = document.getElementById("boundUrlLabel");
const changeUrlBtn = document.getElementById("changeUrlBtn");
const navBackBtn = document.getElementById("navBackBtn");
const navForwardBtn = document.getElementById("navForwardBtn");
const navReloadBtn = document.getElementById("navReloadBtn");
const webStatusDot = document.getElementById("webStatusDot");
const webStatusLabel = document.getElementById("webStatusLabel");
const webLoadBar = document.getElementById("webLoadBar");

const minBtn = document.getElementById("minBtn");
const maxBtn = document.getElementById("maxBtn");
const closeBtn = document.getElementById("closeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");
const settingsChangeUrl = document.getElementById("settingsChangeUrl");
const settingsSecurity = document.getElementById("settingsSecurity");

const securityModal = document.getElementById("securityModal");
const securityCloseBtn = document.getElementById("securityCloseBtn");
const securityCancelBtn = document.getElementById("securityCancelBtn");
const securitySaveBtn = document.getElementById("securitySaveBtn");
const securityEnablePin = document.getElementById("securityEnablePin");
const securityStartupLock = document.getElementById("securityStartupLock");
const securityTimeoutSelect = document.getElementById("securityTimeoutSelect");
const securityPinInput = document.getElementById("securityPinInput");
const securityPinConfirmInput = document.getElementById("securityPinConfirmInput");
const securityMessage = document.getElementById("securityMessage");

const lockOverlay = document.getElementById("lockOverlay");
const lockReason = document.getElementById("lockReason");
const unlockPinInput = document.getElementById("unlockPinInput");
const unlockBtn = document.getElementById("unlockBtn");
const unlockMessage = document.getElementById("unlockMessage");

const setupStepPills = {
  1: document.getElementById("setupStepPill1"),
  2: document.getElementById("setupStepPill2"),
  3: document.getElementById("setupStepPill3")
};
const setupSteps = {
  1: document.getElementById("setupStep1"),
  2: document.getElementById("setupStep2"),
  3: document.getElementById("setupStep3")
};

const setupNext1 = document.getElementById("setupNext1");
const setupBack2 = document.getElementById("setupBack2");
const setupNext2 = document.getElementById("setupNext2");
const setupBack3 = document.getElementById("setupBack3");
const setupFinish = document.getElementById("setupFinish");

const colorButtons = Array.from(document.querySelectorAll("[data-shell-color]"));

const DEFAULT_SHELL_COLOR = "#16a34a";
let activeShellColor = DEFAULT_SHELL_COLOR;
let currentStep = 1;
let boundUrl = "";
let draftUrl = "";
let appLocked = false;
let inactivityTimerId = null;

let securityState = {
  pinEnabled: false,
  pinHash: "",
  pinLockOnStartup: true,
  pinTimeoutMinutes: 15
};

function setSetupMessage(text, isError = false) {
  setupMessage.textContent = text;
  setupMessage.classList.toggle("error", isError);
}

function closeSettingsMenu() {
  settingsMenu.classList.add("hidden");
  settingsBtn.setAttribute("aria-expanded", "false");
}

function setSecurityMessage(text, isError = false) {
  if (!securityMessage) return;
  securityMessage.textContent = text;
  securityMessage.classList.toggle("error", isError);
}

function setUnlockMessage(text, isError = false) {
  if (!unlockMessage) return;
  unlockMessage.textContent = text;
  unlockMessage.classList.toggle("error", isError);
}

function openSecurityModal() {
  if (!securityModal) return;
  closeSettingsMenu();
  securityModal.classList.remove("hidden");

  securityEnablePin.checked = Boolean(securityState.pinEnabled);
  securityStartupLock.checked = Boolean(securityState.pinLockOnStartup);
  securityTimeoutSelect.value = String(securityState.pinTimeoutMinutes || 15);
  securityPinInput.value = "";
  securityPinConfirmInput.value = "";
  setSecurityMessage("");
  securityPinInput.focus();
}

function closeSecurityModal() {
  if (!securityModal) return;
  securityModal.classList.add("hidden");
}

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function applySecurityFromConfig(config) {
  securityState = {
    pinEnabled: Boolean(config.pinEnabled),
    pinHash: typeof config.pinHash === "string" ? config.pinHash : "",
    pinLockOnStartup: config.pinLockOnStartup !== false,
    pinTimeoutMinutes: Number(config.pinTimeoutMinutes || 15) || 15
  };
}

function lockApp(reason = "Enter your PIN to continue.") {
  if (!securityState.pinEnabled || !securityState.pinHash) return;
  if (!lockOverlay) return;

  appLocked = true;
  document.body.classList.add("app-locked");
  lockOverlay.classList.remove("hidden");
  lockReason.textContent = reason;
  unlockPinInput.value = "";
  setUnlockMessage("");
  unlockPinInput.focus();
}

function unlockApp() {
  appLocked = false;
  document.body.classList.remove("app-locked");
  lockOverlay.classList.add("hidden");
  setUnlockMessage("");
  resetInactivityTimer();
}

async function tryUnlock() {
  if (!securityState.pinEnabled || !securityState.pinHash) {
    unlockApp();
    return;
  }

  const entered = unlockPinInput.value.trim();
  if (!/^\d{4,8}$/.test(entered)) {
    setUnlockMessage("Enter a valid 4-8 digit PIN.", true);
    return;
  }

  const candidateHash = await hashPin(entered);
  if (candidateHash !== securityState.pinHash) {
    setUnlockMessage("Incorrect PIN. Try again.", true);
    return;
  }

  unlockApp();
}

function clearInactivityTimer() {
  if (inactivityTimerId) {
    clearTimeout(inactivityTimerId);
    inactivityTimerId = null;
  }
}

function resetInactivityTimer() {
  clearInactivityTimer();
  if (!securityState.pinEnabled || appLocked) return;

  const timeoutMs = Math.max(1, securityState.pinTimeoutMinutes) * 60 * 1000;
  inactivityTimerId = setTimeout(() => {
    lockApp("Locked after inactivity.");
  }, timeoutMs);
}

function toggleSettingsMenu() {
  const shouldOpen = settingsMenu.classList.contains("hidden");
  settingsMenu.classList.toggle("hidden", !shouldOpen);
  settingsBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbToHex(r, g, b) {
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const toHex = (value) => clamp(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shadeHex(hex, delta) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + delta, g + delta, b + delta);
}

function applyShellColor(color) {
  activeShellColor = color;
  document.documentElement.style.setProperty("--oyama-green", color);
  document.documentElement.style.setProperty("--oyama-green-dark", shadeHex(color, -28));

  colorButtons.forEach((button) => {
    const btnColor = (button.dataset.shellColor || "").toLowerCase();
    button.classList.toggle("selected", btnColor === color.toLowerCase());
  });
}

async function saveShellColor(color) {
  const result = await window.oyamaDesktop.setShellColor(color);
  if (!result.ok) {
    setSetupMessage(result.message || "Unable to save shell color.", true);
    return false;
  }
  applyShellColor(result.color);
  return true;
}

async function syncMaxButton() {
  const isMax = await window.oyamaDesktop.isMaximized();
  maxBtn.textContent = isMax ? "o" : "+";
  maxBtn.title = isMax ? "Restore" : "Maximize";
}

function renderSetupStep(step) {
  currentStep = step;
  Object.entries(setupSteps).forEach(([key, element]) => {
    element.classList.toggle("hidden", Number(key) !== step);
  });
  Object.entries(setupStepPills).forEach(([key, element]) => {
    element.classList.toggle("active", Number(key) === step);
  });
}

function showSetup(existingUrl = "", startingStep = 1) {
  crmPane.classList.add("hidden");
  setupPane.classList.remove("hidden");
  closeSettingsMenu();

  draftUrl = existingUrl || boundUrl || "";
  urlInput.value = draftUrl;

  setSetupMessage(startingStep === 1 ? "" : "Update URL or shell color, then launch CRM.");
  renderSetupStep(startingStep);

  setTimeout(() => {
    if (startingStep >= 2) {
      urlInput.focus();
    }
  }, 0);
}

function showCrm(url) {
  boundUrl = url;
  setupPane.classList.add("hidden");
  crmPane.classList.remove("hidden");
  closeSettingsMenu();
  boundUrlLabel.textContent = url;
  if (crmView.getAttribute("src") !== url) {
    crmView.setAttribute("src", url);
  }
  updateNavButtons();
}

function setWebStatus(state, label) {
  if (!webStatusDot || !webStatusLabel) return;

  webStatusDot.classList.remove("loading", "online", "error");
  webStatusDot.classList.add(state);
  webStatusLabel.textContent = label;
}

function setLoadProgress(active) {
  if (!webLoadBar) return;
  webLoadBar.classList.toggle("active", active);
}

function updateNavButtons() {
  if (!crmView || !navBackBtn || !navForwardBtn) return;

  try {
    navBackBtn.disabled = !crmView.canGoBack();
    navForwardBtn.disabled = !crmView.canGoForward();
  } catch {
    navBackBtn.disabled = true;
    navForwardBtn.disabled = true;
  }
}

function bindWebviewEvents() {
  if (!crmView) return;

  crmView.addEventListener("did-start-loading", () => {
    setWebStatus("loading", "Loading");
    setLoadProgress(true);
    updateNavButtons();
  });

  crmView.addEventListener("did-stop-loading", () => {
    setWebStatus("online", "Live");
    setLoadProgress(false);
    updateNavButtons();

    const activeUrl = crmView.getURL();
    if (activeUrl) {
      boundUrlLabel.textContent = activeUrl;
    }
  });

  crmView.addEventListener("did-fail-load", () => {
    setWebStatus("error", "Connection issue");
    setLoadProgress(false);
    updateNavButtons();
  });

  crmView.addEventListener("did-navigate", () => {
    const activeUrl = crmView.getURL();
    if (activeUrl) {
      boundUrlLabel.textContent = activeUrl;
    }
    updateNavButtons();
  });

  crmView.addEventListener("did-navigate-in-page", () => {
    const activeUrl = crmView.getURL();
    if (activeUrl) {
      boundUrlLabel.textContent = activeUrl;
    }
    updateNavButtons();
  });
}

function validateUrl(rawUrl) {
  const cleaned = rawUrl.trim();
  try {
    const parsed = new URL(cleaned);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, message: "Only http/https URLs are supported." };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, message: "Please enter a valid URL." };
  }
}

async function finishSetupAndLaunch() {
  const validation = validateUrl(draftUrl || urlInput.value || "");
  if (!validation.ok) {
    setSetupMessage(validation.message, true);
    renderSetupStep(2);
    return;
  }

  const saveUrlResult = await window.oyamaDesktop.setBoundUrl(validation.url);
  if (!saveUrlResult.ok) {
    setSetupMessage(saveUrlResult.message || "Unable to save URL.", true);
    return;
  }

  const colorOk = await saveShellColor(activeShellColor);
  if (!colorOk) return;

  setSetupMessage("Saved. Launching CRM...");
  showCrm(saveUrlResult.url);
}

async function bootstrap() {
  const config = await window.oyamaDesktop.getConfig();
  const configUrl = typeof config.boundUrl === "string" ? config.boundUrl : "";
  const configColor = typeof config.shellColor === "string" ? config.shellColor : DEFAULT_SHELL_COLOR;

  applyShellColor(configColor);
  applySecurityFromConfig(config);
  boundUrl = configUrl;

  if (configUrl) {
    showCrm(configUrl);
  } else {
    showSetup("", 1);
  }

  syncMaxButton();
  resetInactivityTimer();

  if (securityState.pinEnabled && securityState.pinLockOnStartup) {
    lockApp("Unlock with your PIN to use OyamaCRM Desktop.");
  }
}

setupNext1.addEventListener("click", () => {
  renderSetupStep(2);
  setTimeout(() => urlInput.focus(), 0);
});

setupBack2.addEventListener("click", () => {
  renderSetupStep(1);
  setSetupMessage("");
});

setupNext2.addEventListener("click", () => {
  const validation = validateUrl(urlInput.value);
  if (!validation.ok) {
    setSetupMessage(validation.message, true);
    return;
  }
  draftUrl = validation.url;
  setSetupMessage("");
  renderSetupStep(3);
});

setupBack3.addEventListener("click", () => {
  renderSetupStep(2);
  setSetupMessage("");
});

setupFinish.addEventListener("click", () => {
  finishSetupAndLaunch();
});

changeUrlBtn.addEventListener("click", () => {
  showSetup(boundUrl, 2);
});

if (navBackBtn) {
  navBackBtn.addEventListener("click", () => {
    if (crmView && crmView.canGoBack()) {
      crmView.goBack();
    }
  });
}

if (navForwardBtn) {
  navForwardBtn.addEventListener("click", () => {
    if (crmView && crmView.canGoForward()) {
      crmView.goForward();
    }
  });
}

if (navReloadBtn) {
  navReloadBtn.addEventListener("click", () => {
    if (crmView) {
      crmView.reload();
    }
  });
}

settingsBtn.addEventListener("click", () => {
  toggleSettingsMenu();
});

settingsChangeUrl.addEventListener("click", () => {
  showSetup(boundUrl, 2);
});

if (settingsSecurity) {
  settingsSecurity.addEventListener("click", () => {
    openSecurityModal();
  });
}

securityCloseBtn.addEventListener("click", () => {
  closeSecurityModal();
});

securityCancelBtn.addEventListener("click", () => {
  closeSecurityModal();
});

securitySaveBtn.addEventListener("click", async () => {
  const enablePin = securityEnablePin.checked;
  const startupLock = securityStartupLock.checked;
  const timeoutMinutes = Number.parseInt(securityTimeoutSelect.value, 10) || 15;

  let pinHash = securityState.pinHash;
  const pin = securityPinInput.value.trim();
  const pinConfirm = securityPinConfirmInput.value.trim();

  if (enablePin) {
    if (pin || pinConfirm || !pinHash) {
      if (!/^\d{4,8}$/.test(pin)) {
        setSecurityMessage("PIN must be 4-8 digits.", true);
        return;
      }
      if (pin !== pinConfirm) {
        setSecurityMessage("PIN confirmation does not match.", true);
        return;
      }
      pinHash = await hashPin(pin);
    }
  }

  const result = await window.oyamaDesktop.setLockSettings({
    pinEnabled: enablePin,
    pinHash,
    pinLockOnStartup: startupLock,
    pinTimeoutMinutes: timeoutMinutes
  });

  if (!result.ok) {
    setSecurityMessage(result.message || "Unable to save security settings.", true);
    return;
  }

  securityState.pinEnabled = enablePin;
  securityState.pinHash = enablePin ? pinHash : "";
  securityState.pinLockOnStartup = startupLock;
  securityState.pinTimeoutMinutes = timeoutMinutes;

  setSecurityMessage("Security settings saved.");
  resetInactivityTimer();
  setTimeout(closeSecurityModal, 250);
});

unlockBtn.addEventListener("click", () => {
  void tryUnlock();
});

unlockPinInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void tryUnlock();
  }
});

colorButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const color = (button.dataset.shellColor || "").toLowerCase();
    if (!color) return;

    const ok = await saveShellColor(color);
    if (!ok) return;

    if (!setupPane.classList.contains("hidden")) {
      setSetupMessage("Shell color updated.");
    }
  });
});

document.addEventListener("click", (event) => {
  if (settingsMenu.classList.contains("hidden")) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (settingsMenu.contains(target) || settingsBtn.contains(target)) return;
  closeSettingsMenu();
});

document.addEventListener("keydown", (event) => {
  resetInactivityTimer();

  if (event.key === "Escape") {
    if (!securityModal.classList.contains("hidden")) {
      closeSecurityModal();
      return;
    }
    closeSettingsMenu();
  }
});

["mousemove", "mousedown", "touchstart", "click", "wheel"].forEach((evt) => {
  document.addEventListener(evt, () => {
    if (appLocked) return;
    resetInactivityTimer();
  }, { passive: true });
});

minBtn.addEventListener("click", () => window.oyamaDesktop.minimize());
maxBtn.addEventListener("click", async () => {
  window.oyamaDesktop.toggleMaximize();
  setTimeout(syncMaxButton, 50);
});
closeBtn.addEventListener("click", () => window.oyamaDesktop.close());

window.addEventListener("resize", () => {
  syncMaxButton();
});

bindWebviewEvents();

bootstrap();
