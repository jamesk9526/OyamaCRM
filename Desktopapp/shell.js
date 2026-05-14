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
const settingsBridge = document.getElementById("settingsBridge");
const settingsQuit = document.getElementById("settingsQuit");

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

const bridgeModal = document.getElementById("bridgeModal");
const bridgeCloseBtn = document.getElementById("bridgeCloseBtn");
const bridgeCancelBtn = document.getElementById("bridgeCancelBtn");
const bridgeSaveBtn = document.getElementById("bridgeSaveBtn");
const bridgeStartBtn = document.getElementById("bridgeStartBtn");
const bridgeStopBtn = document.getElementById("bridgeStopBtn");
const bridgeRefreshBtn = document.getElementById("bridgeRefreshBtn");
const bridgeStatusBadge = document.getElementById("bridgeStatusBadge");
const bridgeMessage = document.getElementById("bridgeMessage");
const bridgePairingInput = document.getElementById("bridgePairingInput");
const bridgeApplyPairingBtn = document.getElementById("bridgeApplyPairingBtn");
const bridgeImportKeyBtn = document.getElementById("bridgeImportKeyBtn");
const bridgeImportKeyInput = document.getElementById("bridgeImportKeyInput");

const bridgeDomainUrlInput = document.getElementById("bridgeDomainUrlInput");
const bridgeUpstreamUrlInput = document.getElementById("bridgeUpstreamUrlInput");
const bridgePortInput = document.getElementById("bridgePortInput");
const bridgeAllowedOriginsInput = document.getElementById("bridgeAllowedOriginsInput");
const bridgeApiKeyInput = document.getElementById("bridgeApiKeyInput");
const bridgePublicBaseUrlInput = document.getElementById("bridgePublicBaseUrlInput");
const bridgeModelInput = document.getElementById("bridgeModelInput");
const bridgeThinkingModelInput = document.getElementById("bridgeThinkingModelInput");
const bridgeCudaDeviceSelect = document.getElementById("bridgeCudaDeviceSelect");
const bridgeTemperatureInput = document.getElementById("bridgeTemperatureInput");
const bridgeTimeoutInput = document.getElementById("bridgeTimeoutInput");
const bridgeAutostartInput = document.getElementById("bridgeAutostartInput");
const bridgeMinimizeOnCloseInput = document.getElementById("bridgeMinimizeOnCloseInput");

const bridgeLocalEndpoint = document.getElementById("bridgeLocalEndpoint");
const bridgeLanEndpoints = document.getElementById("bridgeLanEndpoints");
const bridgePublicEndpoint = document.getElementById("bridgePublicEndpoint");

const bridgeCopyEndpoint = document.getElementById("bridgeCopyEndpoint");
const bridgeCopyApiKey = document.getElementById("bridgeCopyApiKey");
const bridgeCopyModel = document.getElementById("bridgeCopyModel");
const bridgeCopyThinkingModel = document.getElementById("bridgeCopyThinkingModel");
const bridgeCopyCuda = document.getElementById("bridgeCopyCuda");
const bridgeCopyTemperature = document.getElementById("bridgeCopyTemperature");
const bridgeCopyTimeout = document.getElementById("bridgeCopyTimeout");

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
const bridgeCopyButtons = Array.from(document.querySelectorAll("[data-copy-target]"));

const DEFAULT_SHELL_COLOR = "#16a34a";
let activeShellColor = DEFAULT_SHELL_COLOR;
let currentStep = 1;
let boundUrl = "";
let draftUrl = "";
let appLocked = false;
let inactivityTimerId = null;
let bridgeState = null;

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

function setBridgeMessage(text, isError = false) {
  if (!bridgeMessage) return;
  bridgeMessage.textContent = text;
  bridgeMessage.classList.toggle("error", isError);
}

function closeBridgeModal() {
  if (!bridgeModal) return;
  bridgeModal.classList.add("hidden");
}

function setBridgeStatusBadge(runtime) {
  if (!bridgeStatusBadge) return;

  bridgeStatusBadge.classList.remove("running", "error");
  if (runtime?.running) {
    bridgeStatusBadge.classList.add("running");
    const uptimeMinutes = Math.max(0, Math.round((Number(runtime.uptimeMs || 0) / 60000) * 10) / 10);
    bridgeStatusBadge.textContent = `Running (${uptimeMinutes} min)`;
    return;
  }

  if (runtime?.lastError) {
    bridgeStatusBadge.classList.add("error");
    bridgeStatusBadge.textContent = "Stopped (error)";
    return;
  }

  bridgeStatusBadge.textContent = "Stopped";
}

function renderCudaSelector(cudaDevices, selectedValue) {
  if (!bridgeCudaDeviceSelect) return;
  const currentValue = String(selectedValue || "auto");
  bridgeCudaDeviceSelect.innerHTML = "";

  const autoOption = document.createElement("option");
  autoOption.value = "auto";
  autoOption.textContent = "Auto";
  bridgeCudaDeviceSelect.appendChild(autoOption);

  (cudaDevices || []).forEach((device) => {
    if (!device || typeof device.index !== "number") return;
    const option = document.createElement("option");
    option.value = String(device.index);
    option.textContent = `GPU ${device.index} - ${device.name} (${device.memory})`;
    bridgeCudaDeviceSelect.appendChild(option);
  });

  bridgeCudaDeviceSelect.value = currentValue;
}

function renderBridgeState(state) {
  if (!state) return;
  bridgeState = state;

  const config = state.config || {};
  const runtime = state.runtime || {};
  const network = state.network || {};
  const appValues = state.appValues || {};

  if (bridgeDomainUrlInput) bridgeDomainUrlInput.value = config.bridgeDomainUrl || "";
  if (bridgeUpstreamUrlInput) bridgeUpstreamUrlInput.value = config.bridgeUpstreamUrl || "";
  if (bridgePortInput) bridgePortInput.value = String(config.bridgePort || 43110);
  if (bridgeAllowedOriginsInput) bridgeAllowedOriginsInput.value = config.bridgeAllowedOrigins || "";
  if (bridgeApiKeyInput) bridgeApiKeyInput.value = config.bridgeApiKey || "";
  if (bridgePublicBaseUrlInput) bridgePublicBaseUrlInput.value = config.bridgePublicBaseUrl || "";
  if (bridgeModelInput) bridgeModelInput.value = config.bridgeModel || "";
  if (bridgeThinkingModelInput) bridgeThinkingModelInput.value = config.bridgeThinkingModel || "";
  if (bridgeTemperatureInput) bridgeTemperatureInput.value = String(config.bridgeTemperature ?? 0.3);
  if (bridgeTimeoutInput) bridgeTimeoutInput.value = String(config.bridgeTimeoutMs ?? 36500);
  if (bridgeAutostartInput) bridgeAutostartInput.checked = Boolean(config.bridgeAutostart);
  if (bridgeMinimizeOnCloseInput) bridgeMinimizeOnCloseInput.checked = Boolean(config.minimizeToTaskbarOnClose);

  renderCudaSelector(network.cudaDevices || [], config.bridgeCudaDevice || "auto");
  setBridgeStatusBadge(runtime);

  if (bridgeStartBtn) bridgeStartBtn.disabled = Boolean(runtime.running);
  if (bridgeStopBtn) bridgeStopBtn.disabled = !runtime.running;

  if (bridgeLocalEndpoint) bridgeLocalEndpoint.textContent = network.localEndpoint || "-";
  if (bridgeLanEndpoints) bridgeLanEndpoints.textContent = (network.lanEndpoints || []).join(" | ") || "No LAN IP detected";
  if (bridgePublicEndpoint) bridgePublicEndpoint.textContent = network.publicEndpointCandidate || "No public IP detected";

  if (bridgeCopyEndpoint) bridgeCopyEndpoint.value = appValues.endpointUrl || "";
  if (bridgeCopyApiKey) bridgeCopyApiKey.value = appValues.apiKey || "";
  if (bridgeCopyModel) bridgeCopyModel.value = appValues.model || "";
  if (bridgeCopyThinkingModel) bridgeCopyThinkingModel.value = appValues.thinkingModel || "";
  if (bridgeCopyCuda) bridgeCopyCuda.value = appValues.cudaDevice || "auto";
  if (bridgeCopyTemperature) bridgeCopyTemperature.value = String(appValues.temperature ?? "");
  if (bridgeCopyTimeout) bridgeCopyTimeout.value = String(appValues.timeoutMs ?? "");
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

function parsePairingObject(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  if (parsed.kind === "oyama.bridge.pairing" && parsed.bridgeConfig && typeof parsed.bridgeConfig === "object") {
    return parsed;
  }

  if (parsed.data && typeof parsed.data === "object") {
    const nested = parsePairingObject(parsed.data);
    if (nested) return nested;
  }

  if (parsed.connectionKey && typeof parsed.connectionKey === "object") {
    const nested = parsePairingObject(parsed.connectionKey);
    if (nested) return nested;
  }

  if (typeof parsed.pairingToken === "string" && parsed.pairingToken.trim()) {
    try {
      const decoded = decodeBase64Url(parsed.pairingToken.trim());
      return parsePairingObject(JSON.parse(decoded));
    } catch {
      return null;
    }
  }

  return null;
}

function parsePairingPayload(rawInput) {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) {
    throw new Error("Paste a pairing URL, token, or key payload first.");
  }

  if (trimmed.startsWith("{")) {
    let parsedJson;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      throw new Error("Pairing JSON is not valid.");
    }

    const pairingFromJson = parsePairingObject(parsedJson);
    if (!pairingFromJson) {
      throw new Error("Pairing payload JSON is missing bridge configuration.");
    }
    return pairingFromJson;
  }

  let tokenCandidate = trimmed;
  try {
    const parsedUrl = new URL(trimmed);
    tokenCandidate =
      parsedUrl.searchParams.get("bridgePair") ||
      parsedUrl.searchParams.get("pairingToken") ||
      parsedUrl.searchParams.get("connectionKey") ||
      "";
    if (!tokenCandidate) {
      throw new Error("Pairing URL does not include a bridgePair token.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("bridgePair token")) {
      throw error;
    }
  }

  try {
    const decoded = decodeBase64Url(tokenCandidate);
    const parsed = JSON.parse(decoded);
    const pairingFromToken = parsePairingObject(parsed);
    if (!pairingFromToken) {
      throw new Error("Decoded pairing token does not contain bridge configuration.");
    }
    return pairingFromToken;
  } catch {
    throw new Error("Pairing token could not be decoded. Paste the full pairing URL or key JSON.");
  }
}

async function applyBridgePairing(rawInput, sourceLabel = "Pairing") {
  const pairing = parsePairingPayload(rawInput);
  const bridgeConfig = pairing.bridgeConfig || {};

  const configPayload = {
    bridgeEnabled: true,
    bridgeAutostart: bridgeConfig.bridgeAutostart !== false,
    bridgeDomainUrl: String(bridgeConfig.bridgeDomainUrl || ""),
    bridgeUpstreamUrl: String(bridgeConfig.bridgeUpstreamUrl || "http://127.0.0.1:11434"),
    bridgePort: Number(bridgeConfig.bridgePort || 43110),
    bridgeAllowedOrigins: String(bridgeConfig.bridgeAllowedOrigins || ""),
    bridgeApiKey: String(bridgeConfig.bridgeApiKey || ""),
    bridgePublicBaseUrl: String(bridgeConfig.bridgePublicBaseUrl || ""),
    bridgeModel: String(bridgeConfig.bridgeModel || "llama3.2:3b"),
    bridgeThinkingModel: String(bridgeConfig.bridgeThinkingModel || "deepseek-r1:8b"),
    bridgeCudaDevice: String(bridgeConfig.bridgeCudaDevice || "auto"),
    bridgeTemperature: Number(bridgeConfig.bridgeTemperature ?? 0.3),
    bridgeTimeoutMs: Number(bridgeConfig.bridgeTimeoutMs || 36500),
  };

  const saveResult = await window.oyamaDesktop.setBridgeConfig(configPayload);
  if (!saveResult.ok) {
    throw new Error(saveResult.message || "Unable to apply pairing settings.");
  }

  renderBridgeState(saveResult.state);

  if (configPayload.bridgeAutostart) {
    const startResult = await window.oyamaDesktop.startBridge();
    if (!startResult.ok) {
      renderBridgeState(startResult.state || saveResult.state);
      throw new Error(startResult.message || "Pairing applied but bridge failed to start.");
    }
    renderBridgeState(startResult.state);
    setBridgeMessage(`${sourceLabel} applied. Bridge started and ready.`);
    return;
  }

  setBridgeMessage(`${sourceLabel} applied. Click Start Bridge when ready.`);
}

async function refreshBridgeState(showMessage = false) {
  const state = await window.oyamaDesktop.getBridgeState();
  renderBridgeState(state);
  if (showMessage) {
    setBridgeMessage("Bridge state refreshed.");
  }
}

async function openBridgeModal() {
  if (!bridgeModal) return;
  closeSettingsMenu();
  bridgeModal.classList.remove("hidden");
  setBridgeMessage("");
  await refreshBridgeState(false);
}

async function saveBridgeSettings() {
  const payload = {
    minimizeToTaskbarOnClose: Boolean(bridgeMinimizeOnCloseInput?.checked),
    bridgeAutostart: Boolean(bridgeAutostartInput?.checked),
    bridgeDomainUrl: bridgeDomainUrlInput?.value || "",
    bridgeUpstreamUrl: bridgeUpstreamUrlInput?.value || "",
    bridgePort: Number(bridgePortInput?.value || "0"),
    bridgeAllowedOrigins: bridgeAllowedOriginsInput?.value || "",
    bridgeApiKey: bridgeApiKeyInput?.value || "",
    bridgePublicBaseUrl: bridgePublicBaseUrlInput?.value || "",
    bridgeModel: bridgeModelInput?.value || "",
    bridgeThinkingModel: bridgeThinkingModelInput?.value || "",
    bridgeCudaDevice: bridgeCudaDeviceSelect?.value || "auto",
    bridgeTemperature: Number(bridgeTemperatureInput?.value || "0"),
    bridgeTimeoutMs: Number(bridgeTimeoutInput?.value || "0"),
  };

  const result = await window.oyamaDesktop.setBridgeConfig(payload);
  if (!result.ok) {
    setBridgeMessage(result.message || "Unable to save bridge settings.", true);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge settings saved.");
}

async function startBridge() {
  const result = await window.oyamaDesktop.startBridge();
  if (!result.ok) {
    setBridgeMessage(result.message || "Bridge failed to start.", true);
    if (result.state) renderBridgeState(result.state);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge started. Use the Endpoint URL value in your domain AI settings.");
}

async function stopBridge() {
  const result = await window.oyamaDesktop.stopBridge();
  if (!result.ok) {
    setBridgeMessage(result.message || "Bridge failed to stop.", true);
    if (result.state) renderBridgeState(result.state);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge stopped.");
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
  if (boundUrlLabel) {
    boundUrlLabel.textContent = url;
  }
  if (crmView.getAttribute("src") !== url) {
    crmView.setAttribute("src", url);
  }
  updateNavButtons();
}

function setWebStatus(state, label) {
  if (!webStatusDot) return;

  webStatusDot.classList.remove("loading", "online", "error");
  webStatusDot.classList.add(state);
  if (webStatusLabel) {
    webStatusLabel.textContent = label;
  }
  webStatusDot.setAttribute("title", label);
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
    if (activeUrl && boundUrlLabel) {
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
    if (activeUrl && boundUrlLabel) {
      boundUrlLabel.textContent = activeUrl;
    }
    updateNavButtons();
  });

  crmView.addEventListener("did-navigate-in-page", () => {
    const activeUrl = crmView.getURL();
    if (activeUrl && boundUrlLabel) {
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

if (changeUrlBtn) {
  changeUrlBtn.addEventListener("click", () => {
    showSetup(boundUrl, 2);
  });
}

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

if (settingsBridge) {
  settingsBridge.addEventListener("click", () => {
    closeSettingsMenu();
    void window.oyamaDesktop.openBridgeWindow();
  });
}

if (settingsQuit) {
  settingsQuit.addEventListener("click", () => {
    window.oyamaDesktop.quitApp();
  });
}

if (bridgeCloseBtn) {
  bridgeCloseBtn.addEventListener("click", () => {
    closeBridgeModal();
  });
}

if (bridgeCancelBtn) {
  bridgeCancelBtn.addEventListener("click", () => {
    closeBridgeModal();
  });
}

if (bridgeRefreshBtn) {
  bridgeRefreshBtn.addEventListener("click", () => {
    void refreshBridgeState(true);
  });
}

if (bridgeSaveBtn) {
  bridgeSaveBtn.addEventListener("click", () => {
    void saveBridgeSettings();
  });
}

if (bridgeStartBtn) {
  bridgeStartBtn.addEventListener("click", () => {
    void startBridge();
  });
}

if (bridgeStopBtn) {
  bridgeStopBtn.addEventListener("click", () => {
    void stopBridge();
  });
}

if (bridgeApplyPairingBtn) {
  bridgeApplyPairingBtn.addEventListener("click", () => {
    void (async () => {
      setBridgeMessage("");
      try {
        await applyBridgePairing(bridgePairingInput?.value || "", "Pairing URL");
      } catch (error) {
        setBridgeMessage(error instanceof Error ? error.message : "Pairing failed.", true);
      }
    })();
  });
}

if (bridgeImportKeyBtn && bridgeImportKeyInput) {
  bridgeImportKeyBtn.addEventListener("click", () => {
    bridgeImportKeyInput.click();
  });

  bridgeImportKeyInput.addEventListener("change", () => {
    void (async () => {
      const file = bridgeImportKeyInput.files && bridgeImportKeyInput.files[0];
      bridgeImportKeyInput.value = "";
      if (!file) return;

      setBridgeMessage("");

      try {
        const text = await file.text();
        if (bridgePairingInput) {
          bridgePairingInput.value = text;
        }
        await applyBridgePairing(text, "Connection key file");
      } catch (error) {
        setBridgeMessage(error instanceof Error ? error.message : "Connection key import failed.", true);
      }
    })();
  });
}

bridgeCopyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy-target");
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLInputElement)) return;

    const value = target.value || "";
    if (!value) {
      setBridgeMessage("Nothing to copy yet.", true);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setBridgeMessage(`Copied ${targetId.replace(/^bridgeCopy/, "")} value.`);
    } catch {
      setBridgeMessage("Clipboard copy failed. Select the text manually and copy.", true);
    }
  });
});

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
    if (bridgeModal && !bridgeModal.classList.contains("hidden")) {
      closeBridgeModal();
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
