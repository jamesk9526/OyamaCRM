// Renderer logic for standalone Oyama Bridge app.
const bridgeRunningDot = document.getElementById("bridgeRunningDot");
const bridgeStatusValue = document.getElementById("bridgeStatusValue");
const bridgeRequestsValue = document.getElementById("bridgeRequestsValue");
const bridgeUptimeValue = document.getElementById("bridgeUptimeValue");
const startupStatusValue = document.getElementById("startupStatusValue");
const bridgeLastError = document.getElementById("bridgeLastError");
const bridgeMessage = document.getElementById("bridgeMessage");
const lastSavedInfo = document.getElementById("lastSavedInfo");

const requestLogBody = document.getElementById("requestLogBody");
const errorLogBody = document.getElementById("errorLogBody");
const requestLogMeta = document.getElementById("requestLogMeta");

const bridgeStartBtn = document.getElementById("bridgeStartBtn");
const bridgeStopBtn = document.getElementById("bridgeStopBtn");
const bridgeRefreshBtn = document.getElementById("bridgeRefreshBtn");
const bridgeSaveBtn = document.getElementById("bridgeSaveBtn");
const clearLogBtn = document.getElementById("clearLogBtn");

const toggleStartupBtn = document.getElementById("toggleStartupBtn");
const toggleHiddenBtn = document.getElementById("toggleHiddenBtn");
const toggleAutostartBtn = document.getElementById("toggleAutostartBtn");
const saveAllBtn = document.getElementById("saveAllBtn");
const toggleStartupBtnSettings = document.getElementById("toggleStartupBtnSettings");
const toggleHiddenBtnSettings = document.getElementById("toggleHiddenBtnSettings");
const toggleAutostartBtnSettings = document.getElementById("toggleAutostartBtnSettings");
const saveAllBtnSettings = document.getElementById("saveAllBtnSettings");

const crmSiteUrlInput = document.getElementById("crmSiteUrlInput");
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
const startupLaunchEnabledInput = document.getElementById("startupLaunchEnabledInput");
const startHiddenInput = document.getElementById("startHiddenInput");

const bridgeSystemPromptBaseInput = document.getElementById("bridgeSystemPromptBaseInput");
const bridgeInternalChatPromptInput = document.getElementById("bridgeInternalChatPromptInput");

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

const pairingInput = document.getElementById("pairingInput");
const pairingApplyBtn = document.getElementById("pairingApplyBtn");
const pairingImportKeyBtn = document.getElementById("pairingImportKeyBtn");
const pairingImportKeyInput = document.getElementById("pairingImportKeyInput");
const pairingCopyTokenBtn = document.getElementById("pairingCopyTokenBtn");
const pairingExpiresOutput = document.getElementById("pairingExpiresOutput");
const pairingTokenOutput = document.getElementById("pairingTokenOutput");
const pairingJsonOutput = document.getElementById("pairingJsonOutput");

const auditTabRequests = document.getElementById("auditTabRequests");
const auditTabErrors = document.getElementById("auditTabErrors");
const auditRequestsPanel = document.getElementById("auditRequestsPanel");
const auditErrorsPanel = document.getElementById("auditErrorsPanel");

const bridgeChatInput = document.getElementById("bridgeChatInput");
const bridgeChatLog = document.getElementById("bridgeChatLog");
const bridgeChatSendBtn = document.getElementById("bridgeChatSendBtn");
const bridgeChatClearBtn = document.getElementById("bridgeChatClearBtn");

const backupEnabledInput = document.getElementById("backupEnabledInput");
const backupDirectoryInput = document.getElementById("backupDirectoryInput");
const backupIntervalHoursInput = document.getElementById("backupIntervalHoursInput");
const backupRetentionDaysInput = document.getElementById("backupRetentionDaysInput");
const backupIncludeLogsInput = document.getElementById("backupIncludeLogsInput");
const backupPassphraseInput = document.getElementById("backupPassphraseInput");
const backupLastRunOutput = document.getElementById("backupLastRunOutput");
const backupLastFileOutput = document.getElementById("backupLastFileOutput");
const backupStatusOutput = document.getElementById("backupStatusOutput");
const backupSaveBtn = document.getElementById("backupSaveBtn");
const backupRunNowBtn = document.getElementById("backupRunNowBtn");

const minBtn = document.getElementById("minBtn");
const maxBtn = document.getElementById("maxBtn");
const closeBtn = document.getElementById("closeBtn");

let bridgeState = null;
let startupState = null;
let runtimeTicker = null;
let detachBridgeEvents = null;
let displayRequestLog = [];
let displayErrorLog = [];
let lastPairing = null;
let chatHistory = [];
let draftSaveTimer = null;
let uiReadyForDraft = false;
let backgroundToolsState = null;

const UI_DRAFT_KEY = "oyamaBridge.uiDraft.v1";
const MAX_CHAT_HISTORY = 60;

function setBridgeMessage(text, isError = false) {
  if (!bridgeMessage) return;
  bridgeMessage.textContent = text || "";
  bridgeMessage.classList.toggle("error", Boolean(isError));
}

function setLastError(text, isError) {
  if (!bridgeLastError) return;
  bridgeLastError.textContent = text || "";
  bridgeLastError.classList.toggle("error", Boolean(isError));
}

function setLastSavedInfo(label, isoDate) {
  if (!lastSavedInfo) return;

  if (!label) {
    lastSavedInfo.textContent = "Last saved: not yet";
    return;
  }

  if (!isoDate) {
    lastSavedInfo.textContent = `Last saved: ${label}`;
    return;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    lastSavedInfo.textContent = `Last saved: ${label}`;
    return;
  }

  lastSavedInfo.textContent = `Last saved: ${label} at ${date.toLocaleTimeString()}`;
}

function getActiveSection() {
  return "live-logs";
}

function getActiveAuditTab() {
  return auditTabErrors?.classList.contains("active") ? "errors" : "requests";
}

function readDraftStore() {
  try {
    const raw = localStorage.getItem(UI_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safeInputValue(element) {
  if (!element) return "";
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    return Boolean(element.checked);
  }
  return String(element.value || "");
}

function applyInputValue(element, value) {
  if (!element || value == null) return;
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }
  element.value = String(value);
}

function collectUiDraft() {
  const now = new Date().toISOString();
  const safeChat = chatHistory
    .slice(-MAX_CHAT_HISTORY)
    .map((item) => ({
      role: String(item?.role || "assistant"),
      text: String(item?.text || "").slice(0, 6000),
      timestamp: String(item?.timestamp || now),
    }));

  return {
    version: 1,
    savedAt: now,
    section: getActiveSection(),
    auditTab: getActiveAuditTab(),
    fields: {
      crmSiteUrlInput: safeInputValue(crmSiteUrlInput),
      bridgeDomainUrlInput: safeInputValue(bridgeDomainUrlInput),
      bridgeUpstreamUrlInput: safeInputValue(bridgeUpstreamUrlInput),
      bridgePortInput: safeInputValue(bridgePortInput),
      bridgeAllowedOriginsInput: safeInputValue(bridgeAllowedOriginsInput),
      bridgeApiKeyInput: safeInputValue(bridgeApiKeyInput),
      bridgePublicBaseUrlInput: safeInputValue(bridgePublicBaseUrlInput),
      bridgeModelInput: safeInputValue(bridgeModelInput),
      bridgeThinkingModelInput: safeInputValue(bridgeThinkingModelInput),
      bridgeCudaDeviceSelect: safeInputValue(bridgeCudaDeviceSelect),
      bridgeTemperatureInput: safeInputValue(bridgeTemperatureInput),
      bridgeTimeoutInput: safeInputValue(bridgeTimeoutInput),
      bridgeAutostartInput: safeInputValue(bridgeAutostartInput),
      bridgeMinimizeOnCloseInput: safeInputValue(bridgeMinimizeOnCloseInput),
      startupLaunchEnabledInput: safeInputValue(startupLaunchEnabledInput),
      startHiddenInput: safeInputValue(startHiddenInput),
      bridgeSystemPromptBaseInput: safeInputValue(bridgeSystemPromptBaseInput),
      bridgeInternalChatPromptInput: safeInputValue(bridgeInternalChatPromptInput),
      pairingInput: safeInputValue(pairingInput),
      pairingTokenOutput: safeInputValue(pairingTokenOutput),
      pairingJsonOutput: safeInputValue(pairingJsonOutput),
      pairingExpiresOutput: safeInputValue(pairingExpiresOutput),
      bridgeChatInput: safeInputValue(bridgeChatInput),
      backupEnabledInput: safeInputValue(backupEnabledInput),
      backupDirectoryInput: safeInputValue(backupDirectoryInput),
      backupIntervalHoursInput: safeInputValue(backupIntervalHoursInput),
      backupRetentionDaysInput: safeInputValue(backupRetentionDaysInput),
      backupIncludeLogsInput: safeInputValue(backupIncludeLogsInput),
    },
    chatHistory: safeChat,
  };
}

function persistUiDraft(immediate = false) {
  if (!uiReadyForDraft) return;

  const commit = () => {
    draftSaveTimer = null;
    const draft = collectUiDraft();
    localStorage.setItem(UI_DRAFT_KEY, JSON.stringify(draft));
    setLastSavedInfo("Auto-save", draft.savedAt);
  };

  if (immediate) {
    if (draftSaveTimer) {
      window.clearTimeout(draftSaveTimer);
      draftSaveTimer = null;
    }
    commit();
    return;
  }

  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer);
  }

  draftSaveTimer = window.setTimeout(commit, 350);
}

function renderChatHistory() {
  if (!bridgeChatLog) return;
  bridgeChatLog.innerHTML = "";

  if (!chatHistory.length) {
    bridgeChatLog.innerHTML = '<div class="empty">No messages yet.</div>';
    return;
  }

  chatHistory.forEach((entry) => {
    const role = String(entry?.role || "assistant");
    const text = String(entry?.text || "");
    const item = document.createElement("div");
    item.className = `chat-item ${role}`;
    item.textContent = text;
    bridgeChatLog.appendChild(item);
  });

  bridgeChatLog.scrollTop = bridgeChatLog.scrollHeight;
}

function restoreUiDraft() {
  const draft = readDraftStore();
  if (!draft) {
    setLastSavedInfo(null);
    renderChatHistory();
    return;
  }

  const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};

  applyInputValue(crmSiteUrlInput, fields.crmSiteUrlInput);
  applyInputValue(bridgeDomainUrlInput, fields.bridgeDomainUrlInput);
  applyInputValue(bridgeUpstreamUrlInput, fields.bridgeUpstreamUrlInput);
  applyInputValue(bridgePortInput, fields.bridgePortInput);
  applyInputValue(bridgeAllowedOriginsInput, fields.bridgeAllowedOriginsInput);
  applyInputValue(bridgeApiKeyInput, fields.bridgeApiKeyInput);
  applyInputValue(bridgePublicBaseUrlInput, fields.bridgePublicBaseUrlInput);
  applyInputValue(bridgeModelInput, fields.bridgeModelInput);
  applyInputValue(bridgeThinkingModelInput, fields.bridgeThinkingModelInput);
  applyInputValue(bridgeCudaDeviceSelect, fields.bridgeCudaDeviceSelect);
  applyInputValue(bridgeTemperatureInput, fields.bridgeTemperatureInput);
  applyInputValue(bridgeTimeoutInput, fields.bridgeTimeoutInput);
  applyInputValue(bridgeAutostartInput, fields.bridgeAutostartInput);
  applyInputValue(bridgeMinimizeOnCloseInput, fields.bridgeMinimizeOnCloseInput);
  applyInputValue(startupLaunchEnabledInput, fields.startupLaunchEnabledInput);
  applyInputValue(startHiddenInput, fields.startHiddenInput);
  applyInputValue(bridgeSystemPromptBaseInput, fields.bridgeSystemPromptBaseInput);
  applyInputValue(bridgeInternalChatPromptInput, fields.bridgeInternalChatPromptInput);
  applyInputValue(pairingInput, fields.pairingInput);
  applyInputValue(pairingTokenOutput, fields.pairingTokenOutput);
  applyInputValue(pairingJsonOutput, fields.pairingJsonOutput);
  applyInputValue(pairingExpiresOutput, fields.pairingExpiresOutput);
  applyInputValue(bridgeChatInput, fields.bridgeChatInput);
  applyInputValue(backupEnabledInput, fields.backupEnabledInput);
  applyInputValue(backupDirectoryInput, fields.backupDirectoryInput);
  applyInputValue(backupIntervalHoursInput, fields.backupIntervalHoursInput);
  applyInputValue(backupRetentionDaysInput, fields.backupRetentionDaysInput);
  applyInputValue(backupIncludeLogsInput, fields.backupIncludeLogsInput);

  chatHistory = Array.isArray(draft.chatHistory)
    ? draft.chatHistory
      .map((entry) => ({
        role: String(entry?.role || "assistant"),
        text: String(entry?.text || "").slice(0, 6000),
        timestamp: String(entry?.timestamp || ""),
      }))
      .slice(-MAX_CHAT_HISTORY)
    : [];

  renderChatHistory();

  switchAuditTab(draft.auditTab === "errors" ? "errors" : "requests");
  setLastSavedInfo("Auto-save", draft.savedAt);
  setBridgeMessage("Restored your previous workspace draft.");
}

function formatUptime(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function statusTone(statusCode) {
  const code = Number(statusCode || 0);
  if (code >= 200 && code < 300) return "status-2";
  if (code >= 400 && code < 500) return "status-4";
  if (code >= 500) return "status-5";
  return "";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateStartupButtons() {
  if (!startupState) return;

  if (startupStatusValue) {
    startupStatusValue.textContent = startupState.startupLaunchEnabled ? "Enabled" : "Disabled";
  }

  if (toggleStartupBtn) {
    toggleStartupBtn.textContent = startupState.startupLaunchEnabled ? "Disable Computer Startup" : "Enable Computer Startup";
  }

  if (toggleStartupBtnSettings) {
    toggleStartupBtnSettings.textContent = startupState.startupLaunchEnabled ? "Disable Computer Startup" : "Enable Computer Startup";
  }

  if (toggleHiddenBtn) {
    toggleHiddenBtn.textContent = startupState.startHidden ? "Disable Start Hidden" : "Enable Start Hidden";
  }

  if (toggleHiddenBtnSettings) {
    toggleHiddenBtnSettings.textContent = startupState.startHidden ? "Disable Start Hidden" : "Enable Start Hidden";
  }

  if (toggleAutostartBtn) {
    toggleAutostartBtn.textContent = startupState.bridgeAutostart ? "Disable Bridge Autostart" : "Enable Bridge Autostart";
  }

  if (toggleAutostartBtnSettings) {
    toggleAutostartBtnSettings.textContent = startupState.bridgeAutostart ? "Disable Bridge Autostart" : "Enable Bridge Autostart";
  }

  if (startupLaunchEnabledInput) startupLaunchEnabledInput.checked = Boolean(startupState.startupLaunchEnabled);
  if (startHiddenInput) startHiddenInput.checked = Boolean(startupState.startHidden);
  if (bridgeAutostartInput) bridgeAutostartInput.checked = Boolean(startupState.bridgeAutostart);
}

function updateRuntimeSummary(runtime) {
  const isRunning = Boolean(runtime?.running);
  const requestCount = Number(runtime?.requestCount || 0);
  const uptimeMs = Number(runtime?.uptimeMs || 0);
  const lastError = String(runtime?.lastError || "").trim();

  if (bridgeRunningDot) {
    bridgeRunningDot.classList.remove("running", "error");
    if (isRunning) bridgeRunningDot.classList.add("running");
    if (!isRunning && lastError) bridgeRunningDot.classList.add("error");
  }

  if (bridgeStatusValue) {
    bridgeStatusValue.textContent = isRunning ? "Running" : (lastError ? "Stopped (error)" : "Stopped");
  }

  if (bridgeRequestsValue) {
    bridgeRequestsValue.textContent = requestCount.toLocaleString();
  }

  if (bridgeUptimeValue) {
    bridgeUptimeValue.textContent = isRunning ? formatUptime(uptimeMs) : "0m";
  }

  setLastError(lastError, Boolean(lastError));

  if (bridgeStartBtn) bridgeStartBtn.disabled = isRunning;
  if (bridgeStopBtn) bridgeStopBtn.disabled = !isRunning;
}

function renderCudaSelector(cudaDevices, selectedValue) {
  if (!bridgeCudaDeviceSelect) return;
  const selected = String(selectedValue || "auto");

  bridgeCudaDeviceSelect.innerHTML = "";

  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = "Auto";
  bridgeCudaDeviceSelect.appendChild(auto);

  (cudaDevices || []).forEach((device) => {
    if (!device || typeof device.index !== "number") return;
    const option = document.createElement("option");
    option.value = String(device.index);
    option.textContent = `GPU ${device.index} - ${device.name} (${device.memory})`;
    bridgeCudaDeviceSelect.appendChild(option);
  });

  bridgeCudaDeviceSelect.value = selected;
}

function renderRequestLogRows(rows) {
  if (!requestLogBody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    requestLogBody.innerHTML = '<tr><td class="empty" colspan="5">No bridge requests yet.</td></tr>';
    if (requestLogMeta) requestLogMeta.textContent = "Waiting for traffic...";
    return;
  }

  const topTimestamp = rows[0]?.timestamp ? new Date(rows[0].timestamp) : null;
  if (requestLogMeta) {
    requestLogMeta.textContent = topTimestamp
      ? `Last activity ${topTimestamp.toLocaleTimeString()}`
      : "Live stream active";
  }

  requestLogBody.innerHTML = rows
    .slice(0, 250)
    .map((entry) => {
      const statusCode = Number(entry.statusCode || 0);
      const method = escapeHtml(String(entry.method || "-").toUpperCase());
      const path = escapeHtml(entry.path || "-");
      const detail = escapeHtml(entry.detail || "");
      const latency = `${Math.max(0, Number(entry.durationMs || 0))} ms`;
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "-";
      const statusClass = statusTone(statusCode);

      return `
        <tr>
          <td><span class="status-pill ${statusClass}">${statusCode || "-"}</span></td>
          <td>${method}</td>
          <td title="${detail}">${path}${detail ? `<br /><span style="color:#94b8a6;">${detail}</span>` : ""}</td>
          <td>${latency}</td>
          <td>${escapeHtml(time)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderErrorLogRows(rows) {
  if (!errorLogBody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    errorLogBody.innerHTML = '<tr><td class="empty" colspan="4">No bridge errors logged.</td></tr>';
    return;
  }

  errorLogBody.innerHTML = rows
    .slice(0, 180)
    .map((entry) => {
      const level = escapeHtml(String(entry.level || "error").toUpperCase());
      const code = escapeHtml(entry.code || "BRIDGE_ERROR");
      const message = escapeHtml(entry.message || "Bridge error.");
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "-";
      return `
        <tr>
          <td><span class="status-pill status-5">${level}</span></td>
          <td>${code}</td>
          <td>${message}</td>
          <td>${escapeHtml(time)}</td>
        </tr>
      `;
    })
    .join("");
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const missing = normalized.length % 4;
  const padded = normalized + (missing ? "=".repeat(4 - missing) : "");
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
      const decoded = decodeBase64Url(parsed.pairingToken.trim().split(".")[0]);
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
    throw new Error("Paste a pairing URL, raw token, or key JSON first.");
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
      throw new Error("Pairing JSON does not include bridge configuration.");
    }

    return {
      pairing: pairingFromJson,
      rawToken: typeof parsedJson.pairingToken === "string" ? parsedJson.pairingToken.trim() : "",
    };
  }

  let tokenCandidate = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    let parsedUrl;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new Error("Pairing URL is invalid.");
    }

    tokenCandidate =
      parsedUrl.searchParams.get("bridgePair") ||
      parsedUrl.searchParams.get("pairingToken") ||
      parsedUrl.searchParams.get("connectionKey") ||
      "";

    if (!tokenCandidate) {
      throw new Error("Pairing URL does not include a bridgePair token.");
    }
  }

  try {
    const decoded = decodeBase64Url(tokenCandidate.split(".")[0]);
    const parsed = JSON.parse(decoded);
    const pairing = parsePairingObject(parsed);
    if (!pairing) {
      throw new Error("Decoded pairing token does not include bridge configuration.");
    }

    return {
      pairing,
      rawToken: tokenCandidate,
    };
  } catch {
    throw new Error("Pairing token could not be decoded. Paste full CRM pairing URL or key JSON.");
  }
}

function populateSettingsFromPairing(bridgeConfig) {
  const safeConfig = bridgeConfig && typeof bridgeConfig === "object" ? bridgeConfig : {};

  if (bridgeDomainUrlInput && typeof safeConfig.bridgeDomainUrl === "string") {
    bridgeDomainUrlInput.value = safeConfig.bridgeDomainUrl;
  }

  if (bridgeUpstreamUrlInput && typeof safeConfig.bridgeUpstreamUrl === "string") {
    bridgeUpstreamUrlInput.value = safeConfig.bridgeUpstreamUrl;
  }

  if (bridgePortInput && safeConfig.bridgePort != null) {
    bridgePortInput.value = String(safeConfig.bridgePort);
  }

  if (bridgeAllowedOriginsInput && typeof safeConfig.bridgeAllowedOrigins === "string") {
    bridgeAllowedOriginsInput.value = safeConfig.bridgeAllowedOrigins;
  }

  if (bridgeApiKeyInput && typeof safeConfig.bridgeApiKey === "string") {
    bridgeApiKeyInput.value = safeConfig.bridgeApiKey;
  }

  if (bridgePublicBaseUrlInput && typeof safeConfig.bridgePublicBaseUrl === "string") {
    bridgePublicBaseUrlInput.value = safeConfig.bridgePublicBaseUrl;
  }

  if (bridgeModelInput && typeof safeConfig.bridgeModel === "string") {
    bridgeModelInput.value = safeConfig.bridgeModel;
  }

  if (bridgeThinkingModelInput && typeof safeConfig.bridgeThinkingModel === "string") {
    bridgeThinkingModelInput.value = safeConfig.bridgeThinkingModel;
  }

  if (bridgeCudaDeviceSelect && safeConfig.bridgeCudaDevice != null) {
    bridgeCudaDeviceSelect.value = String(safeConfig.bridgeCudaDevice || "auto");
  }

  if (bridgeTemperatureInput && safeConfig.bridgeTemperature != null) {
    bridgeTemperatureInput.value = String(safeConfig.bridgeTemperature);
  }

  if (bridgeTimeoutInput && safeConfig.bridgeTimeoutMs != null) {
    bridgeTimeoutInput.value = String(safeConfig.bridgeTimeoutMs);
  }

  if (bridgeAutostartInput) {
    bridgeAutostartInput.checked = safeConfig.bridgeAutostart !== false;
  }

  if (crmSiteUrlInput && typeof safeConfig.bridgeDomainUrl === "string") {
    try {
      const parsed = new URL(safeConfig.bridgeDomainUrl);
      crmSiteUrlInput.value = `${parsed.protocol}//${parsed.host}`;
    } catch {
      // Keep existing CRM URL when bridgeDomainUrl cannot be normalized.
    }
  }
}

function renderPairing(pairing, rawToken) {
  lastPairing = pairing;
  if (pairingTokenOutput) pairingTokenOutput.value = String(rawToken || "");
  if (pairingJsonOutput) pairingJsonOutput.value = JSON.stringify(pairing || {}, null, 2);

  if (pairingExpiresOutput) {
    const expiresAt = pairing && typeof pairing.expiresAt === "string" ? pairing.expiresAt : "";
    if (!expiresAt) {
      pairingExpiresOutput.value = "No expiry provided by token.";
    } else {
      const date = new Date(expiresAt);
      pairingExpiresOutput.value = Number.isNaN(date.getTime())
        ? `Expires: ${expiresAt}`
        : `Expires: ${date.toLocaleString()}`;
    }
  }
}

async function applyBridgePairing(rawInput, sourceLabel = "Pairing") {
  const parsed = parsePairingPayload(rawInput);
  const pairing = parsed.pairing;
  const bridgeConfig = pairing.bridgeConfig && typeof pairing.bridgeConfig === "object"
    ? pairing.bridgeConfig
    : null;

  if (!bridgeConfig) {
    throw new Error("Pairing token is missing bridgeConfig.");
  }

  if (typeof pairing.expiresAt === "string") {
    const expiryDate = new Date(pairing.expiresAt);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) {
      throw new Error(`Pairing token expired at ${expiryDate.toLocaleString()}. Generate a new pairing key in CRM.`);
    }
  }

  populateSettingsFromPairing(bridgeConfig);
  renderPairing(pairing, parsed.rawToken);

  const savePayload = {
    crmSiteUrl: crmSiteUrlInput?.value || "",
    minimizeToTaskbarOnClose: Boolean(bridgeMinimizeOnCloseInput?.checked),
    bridgeEnabled: true,
    bridgeAutostart: bridgeConfig.bridgeAutostart !== false,
    bridgeDomainUrl: String(bridgeConfig.bridgeDomainUrl || bridgeDomainUrlInput?.value || ""),
    bridgeUpstreamUrl: String(bridgeConfig.bridgeUpstreamUrl || bridgeUpstreamUrlInput?.value || "http://127.0.0.1:11434"),
    bridgePort: Number(bridgeConfig.bridgePort || bridgePortInput?.value || "43110"),
    bridgeAllowedOrigins: String(bridgeConfig.bridgeAllowedOrigins || bridgeAllowedOriginsInput?.value || ""),
    bridgeApiKey: String(bridgeConfig.bridgeApiKey || bridgeApiKeyInput?.value || ""),
    bridgePublicBaseUrl: String(bridgeConfig.bridgePublicBaseUrl || bridgePublicBaseUrlInput?.value || ""),
    bridgeModel: String(bridgeConfig.bridgeModel || bridgeModelInput?.value || "llama3.2:3b"),
    bridgeThinkingModel: String(bridgeConfig.bridgeThinkingModel || bridgeThinkingModelInput?.value || "deepseek-r1:8b"),
    bridgeCudaDevice: String(bridgeConfig.bridgeCudaDevice || "auto"),
    bridgeTemperature: Number(bridgeConfig.bridgeTemperature ?? bridgeTemperatureInput?.value ?? 0.3),
    bridgeTimeoutMs: Number(bridgeConfig.bridgeTimeoutMs || bridgeTimeoutInput?.value || "36500"),
    bridgeSystemPromptBase: bridgeSystemPromptBaseInput?.value || "",
    bridgeInternalChatPrompt: bridgeInternalChatPromptInput?.value || "",
  };

  const saveResult = await window.oyamaBridge.setConfig(savePayload);
  if (!saveResult?.ok) {
    throw new Error(saveResult?.message || "Unable to apply pairing settings.");
  }

  renderBridgeState(saveResult.state);

  if (savePayload.bridgeAutostart) {
    const startResult = await window.oyamaBridge.startBridge();
    if (!startResult?.ok) {
      renderBridgeState(startResult.state || saveResult.state);
      throw new Error(startResult?.message || "Pairing was saved but bridge failed to start.");
    }

    renderBridgeState(startResult.state);
    persistUiDraft(true);
    setLastSavedInfo("Pairing applied", new Date().toISOString());
    setBridgeMessage(`${sourceLabel} applied. Settings filled and bridge started.`);
    return;
  }

  persistUiDraft(true);
  setLastSavedInfo("Pairing applied", new Date().toISOString());
  setBridgeMessage(`${sourceLabel} applied. Settings were auto-filled and saved.`);
}

function renderBridgeState(state) {
  if (!state) return;
  bridgeState = state;

  const config = state.config || {};
  const runtime = state.runtime || {};
  const network = state.network || {};
  const appValues = state.appValues || {};

  if (crmSiteUrlInput) crmSiteUrlInput.value = config.crmSiteUrl || "";
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
  if (bridgeSystemPromptBaseInput) bridgeSystemPromptBaseInput.value = config.bridgeSystemPromptBase || "";
  if (bridgeInternalChatPromptInput) bridgeInternalChatPromptInput.value = config.bridgeInternalChatPrompt || "";

  renderCudaSelector(network.cudaDevices || [], config.bridgeCudaDevice || "auto");
  updateRuntimeSummary(runtime);

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

  displayRequestLog = Array.isArray(runtime.requestLog) ? runtime.requestLog.slice(0, 250) : displayRequestLog;
  displayErrorLog = Array.isArray(runtime.errorLog) ? runtime.errorLog.slice(0, 180) : displayErrorLog;

  renderRequestLogRows(displayRequestLog);
  renderErrorLogRows(displayErrorLog);
}

function collectConfigPayload() {
  return {
    crmSiteUrl: crmSiteUrlInput?.value || "",
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
    bridgeSystemPromptBase: bridgeSystemPromptBaseInput?.value || "",
    bridgeInternalChatPrompt: bridgeInternalChatPromptInput?.value || "",
  };
}

async function refreshBridgeState(showMessage = false) {
  const state = await window.oyamaBridge.getBridgeState();
  renderBridgeState(state);
  if (showMessage) {
    setBridgeMessage("Bridge state refreshed.");
  }
}

async function refreshStartupSettings() {
  startupState = await window.oyamaBridge.getStartupSettings();
  updateStartupButtons();
}

function renderBackgroundToolsState(tools) {
  if (!tools || typeof tools !== "object") return;
  backgroundToolsState = tools;

  if (backupEnabledInput) backupEnabledInput.checked = Boolean(tools.enabled);
  if (backupDirectoryInput) backupDirectoryInput.value = String(tools.backupDirectory || "");
  if (backupIntervalHoursInput) backupIntervalHoursInput.value = String(tools.intervalHours || 24);
  if (backupRetentionDaysInput) backupRetentionDaysInput.value = String(tools.retentionDays || 30);
  if (backupIncludeLogsInput) backupIncludeLogsInput.checked = Boolean(tools.includeLogs);

  if (backupLastRunOutput) {
    if (tools.lastRunAt) {
      const date = new Date(tools.lastRunAt);
      backupLastRunOutput.value = Number.isNaN(date.getTime()) ? String(tools.lastRunAt) : date.toLocaleString();
    } else {
      backupLastRunOutput.value = "Not run yet";
    }
  }

  if (backupLastFileOutput) backupLastFileOutput.value = String(tools.lastFilePath || "None yet");
  if (backupStatusOutput) {
    backupStatusOutput.value = tools.lastError
      ? `${String(tools.lastStatus || "Failed")} - ${String(tools.lastError)}`
      : String(tools.lastStatus || "Idle");
  }
}

function collectBackgroundToolsPayload() {
  return {
    enabled: Boolean(backupEnabledInput?.checked),
    backupDirectory: String(backupDirectoryInput?.value || ""),
    intervalHours: Number(backupIntervalHoursInput?.value || "24"),
    retentionDays: Number(backupRetentionDaysInput?.value || "30"),
    includeLogs: Boolean(backupIncludeLogsInput?.checked),
  };
}

async function refreshBackgroundTools() {
  if (typeof window.oyamaBridge.getBackgroundTools !== "function") return;
  const tools = await window.oyamaBridge.getBackgroundTools();
  renderBackgroundToolsState(tools);
}

async function saveBackgroundTools(showSuccessMessage = true) {
  if (typeof window.oyamaBridge.setBackgroundTools !== "function") return;

  const result = await window.oyamaBridge.setBackgroundTools(collectBackgroundToolsPayload());
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Unable to save background tools settings.", true);
    return false;
  }

  renderBackgroundToolsState(result.tools || {});
  if (result.state) renderBridgeState(result.state);
  persistUiDraft(true);
  setLastSavedInfo("Background tools", new Date().toISOString());
  if (showSuccessMessage) {
    setBridgeMessage("Background tools settings saved.");
  }

  return true;
}

async function saveAllState() {
  const bridgeSaved = await saveSettings();
  const backgroundSaved = await saveBackgroundTools(false);

  if (bridgeSaved && backgroundSaved) {
    setBridgeMessage("All settings saved.");
    return;
  }

  if (bridgeSaved && backgroundSaved === undefined) {
    setBridgeMessage("Core settings saved. Background tools are unavailable in this build.");
  }
}

async function runSecureBackup() {
  if (typeof window.oyamaBridge.runSecureBackup !== "function") return;
  const passphrase = String(backupPassphraseInput?.value || "");
  if (passphrase.length < 10) {
    setBridgeMessage("Enter a passphrase with at least 10 characters before running backup.", true);
    return;
  }

  if (backupRunNowBtn) backupRunNowBtn.disabled = true;
  try {
    const result = await window.oyamaBridge.runSecureBackup({ passphrase });

    if (!result?.ok) {
      renderBackgroundToolsState(result.tools || backgroundToolsState || {});
      setBridgeMessage(result?.message || "Secure backup failed.", true);
      return;
    }

    if (backupPassphraseInput) backupPassphraseInput.value = "";
    renderBackgroundToolsState(result.tools || {});
    if (result.state) renderBridgeState(result.state);
    persistUiDraft(true);
    setLastSavedInfo("Secure backup", new Date().toISOString());
    setBridgeMessage(`Secure backup created: ${result.filePath || "completed"}`);
  } finally {
    if (backupRunNowBtn) backupRunNowBtn.disabled = false;
  }
}

async function saveSettings() {
  const bridgeResult = await window.oyamaBridge.setConfig(collectConfigPayload());
  if (!bridgeResult?.ok) {
    setBridgeMessage(bridgeResult?.message || "Unable to save bridge settings.", true);
    return false;
  }

  const startupResult = await window.oyamaBridge.setStartupSettings({
    startupLaunchEnabled: Boolean(startupLaunchEnabledInput?.checked),
    startHidden: Boolean(startHiddenInput?.checked),
    bridgeAutostart: Boolean(bridgeAutostartInput?.checked),
  });

  if (!startupResult?.ok) {
    setBridgeMessage(startupResult?.message || "Saved bridge settings, but startup settings failed.", true);
    renderBridgeState(bridgeResult.state);
    await refreshStartupSettings();
    return false;
  }

  startupState = startupResult.startup;
  renderBridgeState(startupResult.state);
  updateStartupButtons();
  persistUiDraft(true);
  setLastSavedInfo("Config + startup", new Date().toISOString());
  setBridgeMessage("Bridge and startup settings saved.");
  return true;
}

async function startBridge() {
  const result = await window.oyamaBridge.startBridge();
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Bridge failed to start.", true);
    if (result?.state) renderBridgeState(result.state);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge started.");
}

async function stopBridge() {
  const result = await window.oyamaBridge.stopBridge();
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Bridge failed to stop.", true);
    if (result?.state) renderBridgeState(result.state);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge stopped.");
}

async function setStartupPatch(patch, successMessage) {
  const result = await window.oyamaBridge.setStartupSettings(patch);
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Unable to update startup settings.", true);
    return;
  }

  startupState = result.startup;
  updateStartupButtons();
  if (result.state) renderBridgeState(result.state);
  persistUiDraft(true);
  setLastSavedInfo("Startup settings", new Date().toISOString());
  setBridgeMessage(successMessage);
}

async function copyText(text, successLabel) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    setBridgeMessage(successLabel);
  } catch {
    setBridgeMessage("Clipboard copy failed on this system.", true);
  }
}

function appendRequestLog(entry, runtimeSnapshot) {
  if (!entry || typeof entry !== "object") return;
  displayRequestLog = [entry, ...displayRequestLog.filter((row) => row.id !== entry.id)].slice(0, 250);
  renderRequestLogRows(displayRequestLog);

  if (runtimeSnapshot) {
    updateRuntimeSummary(runtimeSnapshot);
    if (bridgeState && bridgeState.runtime) {
      bridgeState.runtime = runtimeSnapshot;
    }
  }
}

function appendErrorLog(entry, runtimeSnapshot) {
  if (!entry || typeof entry !== "object") return;
  displayErrorLog = [entry, ...displayErrorLog.filter((row) => row.id !== entry.id)].slice(0, 180);
  renderErrorLogRows(displayErrorLog);

  if (runtimeSnapshot) {
    updateRuntimeSummary(runtimeSnapshot);
    if (bridgeState && bridgeState.runtime) {
      bridgeState.runtime = runtimeSnapshot;
    }
  }
}

function attachBridgeEventStream() {
  if (typeof window.oyamaBridge.onBridgeEvent !== "function") return;

  detachBridgeEvents = window.oyamaBridge.onBridgeEvent((eventPayload) => {
    if (!eventPayload || typeof eventPayload !== "object") return;

    if (eventPayload.type === "request") {
      appendRequestLog(eventPayload.entry, eventPayload.runtime);
      return;
    }

    if (eventPayload.type === "error") {
      appendErrorLog(eventPayload.entry, eventPayload.runtime);
      return;
    }

    if (eventPayload.type === "runtime") {
      updateRuntimeSummary(eventPayload.runtime || {});
      if (bridgeState && bridgeState.runtime) {
        bridgeState.runtime = eventPayload.runtime || bridgeState.runtime;
      }
      return;
    }

    if (eventPayload.type === "config") {
      refreshBridgeState(false).catch(() => {
        // Keep UI usable if refresh fails.
      });
    }
  });
}

function wireCopyButtons() {
  const copyButtons = Array.from(document.querySelectorAll("[data-copy-target]"));
  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-copy-target");
      if (!targetId) return;

      const input = document.getElementById(targetId);
      if (!(input instanceof HTMLInputElement)) return;
      await copyText(input.value || "", "Copied value to clipboard.");
    });
  });
}

function switchAuditTab(tab) {
  const showRequests = tab === "requests";
  auditTabRequests?.classList.toggle("active", showRequests);
  auditTabErrors?.classList.toggle("active", !showRequests);
  auditRequestsPanel?.classList.toggle("active", showRequests);
  auditErrorsPanel?.classList.toggle("active", !showRequests);
  persistUiDraft(false);
}

function pushChatMessage(role, text) {
  chatHistory.push({
    role: String(role || "assistant"),
    text: String(text || ""),
    timestamp: new Date().toISOString(),
  });
  chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
  renderChatHistory();
  persistUiDraft(false);
}

async function sendBridgeChat() {
  const prompt = String(bridgeChatInput?.value || "").trim();
  if (!prompt) return;

  pushChatMessage("user", prompt);
  if (bridgeChatInput) bridgeChatInput.value = "";
  persistUiDraft(false);
  if (bridgeChatSendBtn) bridgeChatSendBtn.disabled = true;

  const result = await window.oyamaBridge.bridgeChat({ prompt });
  if (!result?.ok) {
    pushChatMessage("error", result?.message || "Bridge chat failed.");
    setBridgeMessage(result?.message || "Bridge chat failed.", true);
    if (result?.state) renderBridgeState(result.state);
  } else {
    pushChatMessage("assistant", result.reply || "(No reply text returned.)");
    if (result?.state) renderBridgeState(result.state);
  }

  if (bridgeChatSendBtn) bridgeChatSendBtn.disabled = false;
}

async function syncMaxButton() {
  if (!maxBtn) return;
  const maximized = await window.oyamaBridge.isMaximized();
  maxBtn.textContent = maximized ? "o" : "[]";
}

async function bootstrap() {
  uiReadyForDraft = false;
  attachBridgeEventStream();
  wireCopyButtons();
  switchAuditTab("requests");

  await refreshBridgeState(false);
  await refreshStartupSettings();
  await refreshBackgroundTools();
  await syncMaxButton();
  restoreUiDraft();

  const trackedInputs = [
    crmSiteUrlInput,
    bridgeDomainUrlInput,
    bridgeUpstreamUrlInput,
    bridgePortInput,
    bridgeAllowedOriginsInput,
    bridgeApiKeyInput,
    bridgePublicBaseUrlInput,
    bridgeModelInput,
    bridgeThinkingModelInput,
    bridgeCudaDeviceSelect,
    bridgeTemperatureInput,
    bridgeTimeoutInput,
    bridgeAutostartInput,
    bridgeMinimizeOnCloseInput,
    startupLaunchEnabledInput,
    startHiddenInput,
    bridgeSystemPromptBaseInput,
    bridgeInternalChatPromptInput,
    pairingInput,
    bridgeChatInput,
    backupEnabledInput,
    backupDirectoryInput,
    backupIntervalHoursInput,
    backupRetentionDaysInput,
    backupIncludeLogsInput,
  ].filter(Boolean);

  trackedInputs.forEach((input) => {
    input.addEventListener("input", () => {
      persistUiDraft(false);
    });
    input.addEventListener("change", () => {
      persistUiDraft(false);
    });
  });

  uiReadyForDraft = true;

  runtimeTicker = window.setInterval(() => {
    if (bridgeState?.runtime?.running) {
      updateRuntimeSummary(bridgeState.runtime);
      bridgeState.runtime.uptimeMs = Number(bridgeState.runtime.uptimeMs || 0) + 1000;
    }
  }, 1000);
}

window.addEventListener("beforeunload", () => {
  persistUiDraft(true);

  if (detachBridgeEvents) {
    detachBridgeEvents();
    detachBridgeEvents = null;
  }

  if (runtimeTicker) {
    window.clearInterval(runtimeTicker);
    runtimeTicker = null;
  }

  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }
});

bridgeStartBtn?.addEventListener("click", () => {
  void startBridge();
});

bridgeStopBtn?.addEventListener("click", () => {
  void stopBridge();
});

bridgeRefreshBtn?.addEventListener("click", () => {
  void refreshBridgeState(true);
});

bridgeSaveBtn?.addEventListener("click", () => {
  void saveSettings();
});

saveAllBtn?.addEventListener("click", () => {
  void saveAllState();
});

saveAllBtnSettings?.addEventListener("click", () => {
  void saveAllState();
});

clearLogBtn?.addEventListener("click", () => {
  displayRequestLog = [];
  displayErrorLog = [];
  renderRequestLogRows(displayRequestLog);
  renderErrorLogRows(displayErrorLog);
  setBridgeMessage("Cleared local audit display. Live bridge stream is still active.");
});

toggleStartupBtn?.addEventListener("click", () => {
  void setStartupPatch(
    { startupLaunchEnabled: !Boolean(startupState?.startupLaunchEnabled) },
    "Computer startup preference updated."
  );
});

toggleStartupBtnSettings?.addEventListener("click", () => {
  void setStartupPatch(
    { startupLaunchEnabled: !Boolean(startupState?.startupLaunchEnabled) },
    "Computer startup preference updated."
  );
});

toggleHiddenBtn?.addEventListener("click", () => {
  void setStartupPatch(
    { startHidden: !Boolean(startupState?.startHidden) },
    "Start hidden preference updated."
  );
});

toggleHiddenBtnSettings?.addEventListener("click", () => {
  void setStartupPatch(
    { startHidden: !Boolean(startupState?.startHidden) },
    "Start hidden preference updated."
  );
});

toggleAutostartBtn?.addEventListener("click", () => {
  void setStartupPatch(
    { bridgeAutostart: !Boolean(startupState?.bridgeAutostart) },
    "Bridge autostart preference updated."
  );
});

toggleAutostartBtnSettings?.addEventListener("click", () => {
  void setStartupPatch(
    { bridgeAutostart: !Boolean(startupState?.bridgeAutostart) },
    "Bridge autostart preference updated."
  );
});

startupLaunchEnabledInput?.addEventListener("change", () => {
  void setStartupPatch({ startupLaunchEnabled: Boolean(startupLaunchEnabledInput.checked) }, "Computer startup preference updated.");
});

startHiddenInput?.addEventListener("change", () => {
  void setStartupPatch({ startHidden: Boolean(startHiddenInput.checked) }, "Start hidden preference updated.");
});

bridgeAutostartInput?.addEventListener("change", () => {
  void setStartupPatch({ bridgeAutostart: Boolean(bridgeAutostartInput.checked) }, "Bridge autostart preference updated.");
});

pairingApplyBtn?.addEventListener("click", () => {
  void (async () => {
    setBridgeMessage("");
    try {
      await applyBridgePairing(pairingInput?.value || "", "Pairing token");
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : "Pairing failed.", true);
    }
  })();
});

pairingImportKeyBtn?.addEventListener("click", () => {
  pairingImportKeyInput?.click();
});

pairingImportKeyInput?.addEventListener("change", () => {
  void (async () => {
    const file = pairingImportKeyInput.files && pairingImportKeyInput.files[0];
    pairingImportKeyInput.value = "";
    if (!file) return;

    setBridgeMessage("");

    try {
      const text = await file.text();
      if (pairingInput) {
        pairingInput.value = text;
      }
      persistUiDraft(false);
      await applyBridgePairing(text, "Connection key file");
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : "Connection key import failed.", true);
    }
  })();
});

pairingCopyTokenBtn?.addEventListener("click", () => {
  const token = pairingTokenOutput?.value || "";
  if (!token) {
    setBridgeMessage("No pairing token is loaded yet.", true);
    return;
  }
  void copyText(token, "Pairing token copied.");
});

auditTabRequests?.addEventListener("click", () => {
  switchAuditTab("requests");
});

auditTabErrors?.addEventListener("click", () => {
  switchAuditTab("errors");
});

bridgeChatSendBtn?.addEventListener("click", () => {
  void sendBridgeChat();
});

backupSaveBtn?.addEventListener("click", () => {
  void saveBackgroundTools(true);
});

backupRunNowBtn?.addEventListener("click", () => {
  void runSecureBackup();
});

bridgeChatClearBtn?.addEventListener("click", () => {
  chatHistory = [];
  renderChatHistory();
  persistUiDraft(true);
});

bridgeChatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendBridgeChat();
  }
});

minBtn?.addEventListener("click", () => {
  window.oyamaBridge.minimize();
});

maxBtn?.addEventListener("click", () => {
  window.oyamaBridge.toggleMaximize();
  window.setTimeout(() => {
    void syncMaxButton();
  }, 60);
});

closeBtn?.addEventListener("click", () => {
  window.oyamaBridge.close();
});

window.addEventListener("resize", () => {
  void syncMaxButton();
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveAllState();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
