// Renderer logic for standalone Oyama Bridge app.
const bridgeRunningDot = document.getElementById("bridgeRunningDot");
const bridgeStatusValue = document.getElementById("bridgeStatusValue");
const bridgeRequestsValue = document.getElementById("bridgeRequestsValue");
const bridgeUptimeValue = document.getElementById("bridgeUptimeValue");
const startupStatusValue = document.getElementById("startupStatusValue");
const bridgeLastError = document.getElementById("bridgeLastError");
const bridgeMessage = document.getElementById("bridgeMessage");
const lastSavedInfo = document.getElementById("lastSavedInfo");
const titleEndpointValue = document.getElementById("titleEndpointValue");
const titleStatusValue = document.getElementById("titleStatusValue");
const titleModelValue = document.getElementById("titleModelValue");
const serviceModeValue = document.getElementById("serviceModeValue");
const latestLatencyValue = document.getElementById("latestLatencyValue");
const averageLatencyValue = document.getElementById("averageLatencyValue");
const errorCountValue = document.getElementById("errorCountValue");
const recentErrorValue = document.getElementById("recentErrorValue");
const requestSuccessRateValue = document.getElementById("requestSuccessRateValue");
const upstreamHealthValue = document.getElementById("upstreamHealthValue");
const ollamaModePill = document.getElementById("ollamaModePill");
const ollamaRuntimeStatusPill = document.getElementById("ollamaRuntimeStatusPill");
const ollamaRuntimeValue = document.getElementById("ollamaRuntimeValue");
const ollamaLaunchValue = document.getElementById("ollamaLaunchValue");
const ollamaIsolationValue = document.getElementById("ollamaIsolationValue");
const ollamaRuntimeHintValue = document.getElementById("ollamaRuntimeHintValue");
const selectedGpuValue = document.getElementById("selectedGpuValue");
const selectedGpuHintValue = document.getElementById("selectedGpuHintValue");
const gpuUsageValue = document.getElementById("gpuUsageValue");
const gpuTempValue = document.getElementById("gpuTempValue");
const gpuMemoryValue = document.getElementById("gpuMemoryValue");
const usageCostValue = document.getElementById("usageCostValue");
const usageCostHint = document.getElementById("usageCostHint");
const usageCurrentMonthValue = document.getElementById("usageCurrentMonthValue");
const usageCurrentRequestsValue = document.getElementById("usageCurrentRequestsValue");
const usageCurrentCostValue = document.getElementById("usageCurrentCostValue");
const usageCurrentTokensValue = document.getElementById("usageCurrentTokensValue");
const usageCurrentReceiptValue = document.getElementById("usageCurrentReceiptValue");
const usageCurrentUpdatedValue = document.getElementById("usageCurrentUpdatedValue");
const usageHistoryMeta = document.getElementById("usageHistoryMeta");
const usageHistoryBody = document.getElementById("usageHistoryBody");
const usageRefreshBtn = document.getElementById("usageRefreshBtn");
const gpuMonitorList = document.getElementById("gpuMonitorList");
const gpuMonitorMeta = document.getElementById("gpuMonitorMeta");
const latencyTrendChart = document.getElementById("latencyTrendChart");
const latencyTrendMeta = document.getElementById("latencyTrendMeta");
const statusMixChart = document.getElementById("statusMixChart");
const statusMixMeta = document.getElementById("statusMixMeta");
const gpuReportChart = document.getElementById("gpuReportChart");
const gpuReportMeta = document.getElementById("gpuReportMeta");
const selectedRequestStatus = document.getElementById("selectedRequestStatus");
const requestDetailBody = document.getElementById("requestDetailBody");
const settingsSidebar = document.getElementById("settingsSidebar");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const activeCudaDeviceValue = document.getElementById("activeCudaDeviceValue");
const commandSidebar = document.getElementById("commandSidebar");
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");

const requestLogBody = document.getElementById("requestLogBody");
const dashboardRequestLogBody = document.getElementById("dashboardRequestLogBody");
const errorLogBody = document.getElementById("errorLogBody");
const requestLogMeta = document.getElementById("requestLogMeta");
const generatedContentLogBody = document.getElementById("generatedContentLogBody");
const dashboardGeneratedLogBody = document.getElementById("dashboardGeneratedLogBody");
const generatedContentMeta = document.getElementById("generatedContentMeta");
const dashboardGeneratedMeta = document.getElementById("dashboardGeneratedMeta");

const bridgeStartBtn = document.getElementById("bridgeStartBtn");
const bridgeStopBtn = document.getElementById("bridgeStopBtn");
const bridgeRestartBtn = document.getElementById("bridgeRestartBtn");
const bridgeRefreshBtn = document.getElementById("bridgeRefreshBtn");
const dashboardStartBtn = document.getElementById("dashboardStartBtn");
const dashboardStopBtn = document.getElementById("dashboardStopBtn");
const clearLogBtn = document.getElementById("clearLogBtn");
const copyLatestGeneratedBtn = document.getElementById("copyLatestGeneratedBtn");

const saveAllBtn = document.getElementById("saveAllBtn");
const saveAllBtnSettings = document.getElementById("saveAllBtnSettings");

const crmSiteUrlInput = document.getElementById("crmSiteUrlInput");
const bridgeDomainUrlInput = document.getElementById("bridgeDomainUrlInput");
const bridgeUpstreamUrlInput = document.getElementById("bridgeUpstreamUrlInput");
const bridgePortInput = document.getElementById("bridgePortInput");
const bridgeAllowedOriginsInput = document.getElementById("bridgeAllowedOriginsInput");
const bridgeApiKeyInput = document.getElementById("bridgeApiKeyInput");
const bridgePublicBaseUrlInput = document.getElementById("bridgePublicBaseUrlInput");
const ollamaRuntimeModeSelect = document.getElementById("ollamaRuntimeModeSelect");
const ollamaExecutablePathInput = document.getElementById("ollamaExecutablePathInput");
const ollamaModeHelpText = document.getElementById("ollamaModeHelpText");
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
const trayHideBtn = document.getElementById("trayHideBtn");
const quitAppBtn = document.getElementById("quitAppBtn");

let bridgeState = null;
let startupState = null;
let runtimeTicker = null;
let gpuTelemetryTicker = null;
let detachBridgeEvents = null;
let displayRequestLog = [];
let displayErrorLog = [];
let displayGeneratedLog = [];
let requestFilter = "all";
let selectedRequestId = "";
let activePage = "dashboard";
let settingsOpen = false;
let sidebarOpen = false;
let lastPairing = null;
let chatHistory = [];
let draftSaveTimer = null;
let uiReadyForDraft = false;
let backgroundToolsState = null;
let usageHistoryState = null;
let usageRefreshTimer = null;

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
  return activePage;
}

function getActiveAuditTab() {
  return auditTabErrors?.classList.contains("active") ? "errors" : "requests";
}

function updateNavActive(targetName) {
  const target = String(targetName || activePage || "dashboard");
  document.querySelectorAll(".page-tab, .rail-icon, .sidebar-action[data-tab-target]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-tab-target") === target);
  });
}

function toggleSettingsSidebar(forceOpen) {
  settingsOpen = typeof forceOpen === "boolean" ? forceOpen : !settingsOpen;
  settingsSidebar?.classList.toggle("open", settingsOpen);
  settingsBackdrop?.classList.toggle("open", settingsOpen);
  settingsSidebar?.setAttribute("aria-hidden", settingsOpen ? "false" : "true");
  settingsBackdrop?.setAttribute("aria-hidden", settingsOpen ? "false" : "true");
  document.body.classList.toggle("settings-open", settingsOpen);
  updateNavActive(settingsOpen ? "settings" : activePage);
}

function toggleCommandSidebar(forceOpen) {
  sidebarOpen = typeof forceOpen === "boolean" ? forceOpen : !sidebarOpen;
  commandSidebar?.classList.toggle("open", sidebarOpen);
  document.body.classList.toggle("sidebar-open", sidebarOpen);
  sidebarToggleBtn?.setAttribute("aria-label", sidebarOpen ? "Close command sidebar" : "Open command sidebar");
  if (sidebarToggleBtn) sidebarToggleBtn.title = sidebarOpen ? "Close command sidebar" : "Open command sidebar";
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
      ollamaRuntimeModeSelect: safeInputValue(ollamaRuntimeModeSelect),
      ollamaExecutablePathInput: safeInputValue(ollamaExecutablePathInput),
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
  applyInputValue(ollamaRuntimeModeSelect, fields.ollamaRuntimeModeSelect);
  applyInputValue(ollamaExecutablePathInput, fields.ollamaExecutablePathInput);
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
  switchPage(typeof draft.section === "string" ? draft.section : "dashboard");
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

  if (startupLaunchEnabledInput) startupLaunchEnabledInput.checked = Boolean(startupState.startupLaunchEnabled);
  if (startHiddenInput) startHiddenInput.checked = Boolean(startupState.startHidden);
  if (bridgeAutostartInput) bridgeAutostartInput.checked = Boolean(startupState.bridgeAutostart);
}

function updateRuntimeSummary(runtime) {
  const isRunning = Boolean(runtime?.running);
  const requestCount = Number(runtime?.requestCount || 0);
  const uptimeMs = Number(runtime?.uptimeMs || 0);
  const lastError = String(runtime?.lastError || "").trim();
  const telemetry = runtime?.telemetry && typeof runtime.telemetry === "object" ? runtime.telemetry : {};
  const successCount = Number(telemetry.successCount || 0);
  const clientErrorCount = Number(telemetry.clientErrorCount || 0);
  const serverErrorCount = Number(telemetry.serverErrorCount || 0);
  const totalClassified = successCount + clientErrorCount + serverErrorCount;
  const successRate = totalClassified > 0 ? Math.round((successCount / totalClassified) * 100) : 0;

  if (bridgeRunningDot) {
    bridgeRunningDot.classList.remove("running", "error");
    if (isRunning) bridgeRunningDot.classList.add("running");
    if (!isRunning && lastError) bridgeRunningDot.classList.add("error");
  }

  if (bridgeStatusValue) {
    bridgeStatusValue.textContent = isRunning ? "Running" : (lastError ? "Stopped (error)" : "Stopped");
  }

  if (titleStatusValue) {
    titleStatusValue.textContent = isRunning ? "Running" : (lastError ? "Stopped: error" : "Stopped");
  }

  if (bridgeRequestsValue) {
    bridgeRequestsValue.textContent = requestCount.toLocaleString();
  }

  if (bridgeUptimeValue) {
    bridgeUptimeValue.textContent = isRunning ? formatUptime(uptimeMs) : "0m";
  }

  if (latestLatencyValue) {
    latestLatencyValue.textContent = `${Math.max(0, Number(telemetry.lastLatencyMs || 0))} ms`;
  }

  if (averageLatencyValue) {
    averageLatencyValue.textContent = `${Math.max(0, Number(telemetry.averageLatencyMs || 0))} ms avg`;
  }

  if (errorCountValue) {
    errorCountValue.textContent = (clientErrorCount + serverErrorCount).toLocaleString();
  }

  if (recentErrorValue) {
    recentErrorValue.textContent = `${Number(telemetry.recentErrorCount || 0).toLocaleString()} recent`;
  }

  if (requestSuccessRateValue) {
    requestSuccessRateValue.textContent = totalClassified > 0 ? `${successRate}% success` : "No traffic yet";
  }

  if (usageCostValue) {
    const currentMonth = usageHistoryState?.currentMonth;
    if (currentMonth && typeof currentMonth === "object") {
      const month = formatMonthLabel(currentMonth.month);
      usageCostValue.textContent = formatUsd(currentMonth.estimatedCostUsd);
      if (usageCostHint) usageCostHint.textContent = `${month} receipt estimate`;
    } else {
      const totalBytes = Math.max(0, Number(telemetry.totalBodyBytes || 0)) +
                         Math.max(0, Number(telemetry.totalResponseBytes || 0));
      const estimatedTokens = totalBytes / 4;
      const estimatedCostUsd = (estimatedTokens / 1000) * 0.010;
      usageCostValue.textContent = formatUsd(estimatedCostUsd);
      if (usageCostHint) usageCostHint.textContent = "OpenAI equivalent (est.)";
    }
  }

  if (upstreamHealthValue) {
    upstreamHealthValue.textContent = telemetry.upstreamUrl ? `Upstream ${telemetry.upstreamUrl}` : "Upstream pending";
  }

  setLastError(lastError, Boolean(lastError));

  if (bridgeStartBtn) bridgeStartBtn.disabled = isRunning;
  if (bridgeStopBtn) bridgeStopBtn.disabled = !isRunning;
  if (bridgeRestartBtn) bridgeRestartBtn.disabled = !isRunning;
  if (dashboardStartBtn) dashboardStartBtn.disabled = isRunning;
  if (dashboardStopBtn) dashboardStopBtn.disabled = !isRunning;
}

function getRuntimeChipTone(ollama) {
  if (ollama?.status === "managed-ready" || ollama?.status === "external-ready") return "ready";
  if (ollama?.status === "managed-starting") return "warming";
  if (ollama?.status === "managed-port-in-use") return "warning";
  if (ollama?.status === "error" || ollama?.status === "external-unreachable") return "danger";
  return "idle";
}

function renderOllamaState(ollama, config) {
  const mode = String(ollama?.mode || config?.ollamaRuntimeMode || "managed");
  const status = String(ollama?.status || "idle");
  const runtimeText = mode === "managed"
    ? (ollama?.managedByApp && ollama?.pid
      ? `Managed PID ${ollama.pid}`
      : "Managed local runtime")
    : `External upstream ${String(ollama?.upstreamUrl || config?.bridgeUpstreamUrl || "").replace(/^https?:\/\//, "")}`;
  const launchText = mode === "managed"
    ? `${String(ollama?.executablePath || config?.ollamaExecutablePath || "ollama")} serve`
    : `Bridge proxies ${String(ollama?.upstreamUrl || config?.bridgeUpstreamUrl || "")}`;
  const isolationText = String(ollama?.envHint || (String(config?.bridgeCudaDevice || "auto") === "auto"
    ? "Automatic GPU selection"
    : `CUDA_VISIBLE_DEVICES=${String(config?.bridgeCudaDevice || "auto")}`));

  let hintText = "Managed mode launches ollama serve with isolated device visibility.";
  if (mode === "external") {
    hintText = "External mode does not own the Ollama process. GPU selection falls back to per-request hints and cannot be strictly enforced from this app.";
  } else if (status === "managed-ready") {
    hintText = "Oyama Bridge owns the Ollama process right now, so the selected GPU visibility is enforced at process launch.";
  } else if (status === "managed-port-in-use") {
    hintText = ollama?.lastError || "Another Ollama service already owns the configured upstream URL. Managed GPU isolation is not guaranteed until that service is stopped.";
  } else if (status === "managed-starting") {
    hintText = "Starting a managed Ollama process and waiting for the health endpoint to come online.";
  } else if (status === "external-unreachable" || status === "error") {
    hintText = ollama?.lastError || "Ollama is not currently reachable.";
  }

  if (ollamaModePill) {
    ollamaModePill.textContent = mode === "managed" ? "Managed Ollama" : "External Ollama";
    ollamaModePill.className = `status-chip ${mode === "managed" ? "managed" : "external"}`;
  }

  if (ollamaRuntimeStatusPill) {
    ollamaRuntimeStatusPill.textContent = status
      .replace(/^managed-/, "")
      .replace(/^external-/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    ollamaRuntimeStatusPill.className = `status-chip ${getRuntimeChipTone(ollama)}`;
  }

  if (ollamaRuntimeValue) ollamaRuntimeValue.textContent = runtimeText;
  if (ollamaLaunchValue) ollamaLaunchValue.textContent = launchText;
  if (ollamaIsolationValue) ollamaIsolationValue.textContent = isolationText;
  if (ollamaRuntimeHintValue) ollamaRuntimeHintValue.textContent = hintText;
  if (ollamaModeHelpText) ollamaModeHelpText.textContent = hintText;

  if (upstreamHealthValue && mode === "managed") {
    upstreamHealthValue.textContent = ollama?.ready
      ? `Managed Ollama ${ollama?.version || "ready"}`
      : `Managed Ollama ${status.replace(/^managed-/, "")}`;
  }
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatUsd(value) {
  const amount = Math.max(0, Number(value || 0));
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

function formatMonthLabel(monthKey) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "Unknown month";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function scheduleUsageHistoryRefresh() {
  if (usageRefreshTimer) return;
  usageRefreshTimer = window.setTimeout(() => {
    usageRefreshTimer = null;
    void refreshUsageHistory(false);
  }, 1200);
}

function renderUsageHistory(history) {
  usageHistoryState = history && typeof history === "object" ? history : null;

  const currentMonth = usageHistoryState?.currentMonth && typeof usageHistoryState.currentMonth === "object"
    ? usageHistoryState.currentMonth
    : null;
  const months = Array.isArray(usageHistoryState?.months) ? usageHistoryState.months : [];

  if (usageCurrentMonthValue) usageCurrentMonthValue.textContent = currentMonth ? formatMonthLabel(currentMonth.month) : "-";
  if (usageCurrentRequestsValue) usageCurrentRequestsValue.textContent = `${Number(currentMonth?.requestCount || 0).toLocaleString()} requests`;
  if (usageCurrentCostValue) usageCurrentCostValue.textContent = formatUsd(currentMonth?.estimatedCostUsd || 0);
  if (usageCurrentTokensValue) {
    const totalTokens = Number(currentMonth?.estimatedInputTokens || 0) + Number(currentMonth?.estimatedOutputTokens || 0);
    usageCurrentTokensValue.textContent = `${Math.round(totalTokens).toLocaleString()} tokens est.`;
  }
  if (usageCurrentReceiptValue) usageCurrentReceiptValue.textContent = String(currentMonth?.receiptId || "-");
  if (usageCurrentUpdatedValue) {
    const updatedAt = String(currentMonth?.updatedAt || "");
    if (!updatedAt) {
      usageCurrentUpdatedValue.textContent = "No updates yet";
    } else {
      const date = new Date(updatedAt);
      usageCurrentUpdatedValue.textContent = Number.isNaN(date.getTime())
        ? updatedAt
        : `Updated ${date.toLocaleString()}`;
    }
  }

  if (usageCostValue && currentMonth) {
    usageCostValue.textContent = formatUsd(currentMonth.estimatedCostUsd || 0);
  }
  if (usageCostHint && currentMonth) {
    usageCostHint.textContent = `${formatMonthLabel(currentMonth.month)} receipt estimate`;
  }

  if (usageHistoryMeta) {
    const generatedAt = String(usageHistoryState?.generatedAt || "");
    const generatedDate = generatedAt ? new Date(generatedAt) : null;
    usageHistoryMeta.textContent = months.length
      ? `Tracking ${months.length} month${months.length === 1 ? "" : "s"} of usage. ${generatedDate && !Number.isNaN(generatedDate.getTime()) ? `Updated ${generatedDate.toLocaleString()}.` : ""}`
      : "Monthly estimated OpenAI equivalent costs based on bridge traffic.";
  }

  if (!usageHistoryBody) return;

  if (!months.length) {
    usageHistoryBody.innerHTML = '<tr><td class="empty" colspan="7">No monthly usage receipts yet.</td></tr>';
    return;
  }

  usageHistoryBody.innerHTML = months
    .map((month) => {
      const inputBytes = Math.max(0, Number(month.totalInputBytes || 0));
      const outputBytes = Math.max(0, Number(month.totalOutputBytes || 0));
      const estimatedTokens = Math.round(Number(month.estimatedInputTokens || 0) + Number(month.estimatedOutputTokens || 0));
      const generated = month.generatedAt ? new Date(month.generatedAt) : null;
      const generatedText = generated && !Number.isNaN(generated.getTime())
        ? generated.toLocaleDateString()
        : "-";

      return `
        <tr>
          <td>${escapeHtml(formatMonthLabel(month.month))}</td>
          <td><span class="mono-inline">${escapeHtml(String(month.receiptId || "-"))}</span></td>
          <td>${Number(month.requestCount || 0).toLocaleString()}</td>
          <td>${escapeHtml(`${formatBytes(inputBytes)} / ${formatBytes(outputBytes)}`)}</td>
          <td>${estimatedTokens.toLocaleString()}</td>
          <td>${escapeHtml(formatUsd(month.estimatedCostUsd || 0))}</td>
          <td>${escapeHtml(generatedText)}</td>
        </tr>
      `;
    })
    .join("");
}

async function refreshUsageHistory(showMessage = false) {
  if (typeof window.oyamaBridge.getUsageHistory !== "function") return;
  const history = await window.oyamaBridge.getUsageHistory();
  renderUsageHistory(history);
  if (showMessage) {
    setBridgeMessage("Usage receipts refreshed.");
  }
}

function parseMetricNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMiB(value) {
  const mib = parseMetricNumber(value);
  if (!Number.isFinite(mib)) return "-";
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GB`;
  return `${Math.round(mib)} MB`;
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function buildSparklineSvg(values, { stroke = "#34d399", fill = "rgba(52,211,153,0.12)", gradientId = "spkGrad" } = {}) {
  const width = 420;
  const height = 118;
  const padX = 10;
  const padY = 14;
  const chartH = height - padY * 2;
  const chartW = width - padX * 2;
  const safeValues = values.length ? values : [0];
  const maxValue = Math.max(1, ...safeValues);
  const step = safeValues.length > 1 ? chartW / (safeValues.length - 1) : 0;

  const pts = safeValues.map((v, i) => {
    const x = padX + i * step;
    const y = padY + chartH - (v / maxValue) * chartH;
    return [x, y];
  });

  // Smooth curve via cubic bezier control points
  let pathD = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cpx = (prev[0] + cur[0]) / 2;
    pathD += ` C ${cpx.toFixed(1)} ${prev[1].toFixed(1)}, ${cpx.toFixed(1)} ${cur[1].toFixed(1)}, ${cur[0].toFixed(1)} ${cur[1].toFixed(1)}`;
  }

  const areaD = `${pathD} L ${pts[pts.length - 1][0].toFixed(1)} ${padY + chartH} L ${padX} ${padY + chartH} Z`;

  // Horizontal grid lines at 25%, 50%, 75%
  const gridLines = [0.25, 0.5, 0.75].map((t) => {
    const y = (padY + chartH - t * chartH).toFixed(1);
    const label = Math.round(maxValue * t);
    return `
      <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#222" stroke-width="1"/>
      <text x="${padX + 2}" y="${(Number(y) - 2).toFixed(1)}" fill="#444" font-size="8" font-family="Consolas,monospace">${label}ms</text>`;
  }).join("");

  // Latest value label
  const lastPt = pts[pts.length - 1];
  const lastLabel = safeValues[safeValues.length - 1];

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Latency trend chart" style="overflow:visible">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <line x1="${padX}" y1="${padY + chartH}" x2="${width - padX}" y2="${padY + chartH}" stroke="#2a2a2a" stroke-width="1"/>
      <path d="${areaD}" fill="url(#${gradientId})"/>
      <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="3" fill="${stroke}"/>
      <text x="${(lastPt[0] + 5).toFixed(1)}" y="${(lastPt[1] + 4).toFixed(1)}" fill="${stroke}" font-size="9" font-family="Consolas,monospace">${lastLabel}ms</text>
    </svg>
  `;
}

function renderReportCharts(rows, network) {
  const requestRows = Array.isArray(rows) ? rows : [];
  const latencyValues = requestRows
    .slice(0, 28)
    .reverse()
    .map((entry) => Math.max(0, Number(entry.durationMs || 0)));

  if (latencyTrendChart) {
    latencyTrendChart.innerHTML = latencyValues.length
      ? buildSparklineSvg(latencyValues)
      : '<p class="empty">No latency samples yet.</p>';
  }

  if (latencyTrendMeta) {
    const latest = latencyValues.length ? latencyValues[latencyValues.length - 1] : 0;
    const max = latencyValues.length ? Math.max(...latencyValues) : 0;
    latencyTrendMeta.textContent = latencyValues.length
      ? `${latencyValues.length} samples | latest ${latest} ms | peak ${max} ms`
      : "Waiting for request data...";
  }

  const successCount = requestRows.filter((entry) => Number(entry.statusCode || 0) >= 200 && Number(entry.statusCode || 0) < 300).length;
  const clientErrorCount = requestRows.filter((entry) => Number(entry.statusCode || 0) >= 400 && Number(entry.statusCode || 0) < 500).length;
  const serverErrorCount = requestRows.filter((entry) => Number(entry.statusCode || 0) >= 500).length;
  const total = successCount + clientErrorCount + serverErrorCount;
  const successPct = total ? Math.round((successCount / total) * 100) : 0;
  const clientPct = total ? Math.round((clientErrorCount / total) * 100) : 0;
  const serverPct = total ? Math.max(0, 100 - successPct - clientPct) : 0;

  if (statusMixChart) {
    statusMixChart.innerHTML = total
      ? `
        <div class="donut" style="--success:${successPct}; --client:${clientPct}; --server:${serverPct};">
          <div>
            <strong>${successPct}%</strong>
            <span>success</span>
          </div>
        </div>
        <div class="chart-legend">
          <span><i class="legend-success"></i>${successCount} success</span>
          <span><i class="legend-client"></i>${clientErrorCount} client err</span>
          <span><i class="legend-server"></i>${serverErrorCount} server err</span>
        </div>
      `
      : '<p class="empty">No status data yet.</p>';
  }

  if (statusMixMeta) {
    statusMixMeta.textContent = total ? `${total} classified requests` : "No traffic yet.";
  }

  const telemetry = normalizeGpuTelemetry(Array.isArray(network?.gpuTelemetry)
    ? network.gpuTelemetry
    : (Array.isArray(network?.cudaDevices) ? network.cudaDevices : []));

  if (gpuReportMeta) {
    gpuReportMeta.textContent = telemetry.length ? `${telemetry.length} visible NVIDIA GPU${telemetry.length === 1 ? "" : "s"}` : "Waiting for GPU telemetry...";
  }

  if (gpuReportChart) {
    gpuReportChart.innerHTML = telemetry.length
      ? telemetry.map((gpu) => {
        const usage = clampNumber(parseMetricNumber(gpu.utilizationPct) ?? 0, 0, 100);
        const used = parseMetricNumber(gpu.memoryUsedMiB);
        const totalMemory = parseMetricNumber(gpu.memoryTotalMiB);
        const memoryPct = totalMemory && used !== null ? clampNumber(Math.round((used / totalMemory) * 100), 0, 100) : 0;
        const useFill = usage >= 90 ? "critical" : usage >= 70 ? "high" : "use";
        const memFill = memoryPct >= 90 ? "critical" : memoryPct >= 70 ? "high" : "mem";
        return `
          <div class="gpu-report-row">
            <div><strong>GPU ${escapeHtml(String(gpu.index))}</strong><span>${escapeHtml(gpu.name || "NVIDIA GPU")}</span></div>
            <div class="bar-pair"><span>Use</span><b class="${useFill}" style="width:${usage}%"></b><em>${usage}%</em></div>
            <div class="bar-pair"><span>Mem</span><b class="${memFill}" style="width:${memoryPct}%"></b><em>${memoryPct}%</em></div>
          </div>
        `;
      }).join("")
      : '<p class="empty">No GPU telemetry available.</p>';
  }
}

function normalizeGpuTelemetry(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((gpu) => {
      if (!gpu || typeof gpu !== "object") return null;
      const index = parseMetricNumber(gpu.index);
      if (!Number.isInteger(index) || index < 0) return null;
      return {
        ...gpu,
        index,
        uuid: String(gpu.uuid || ""),
        name: String(gpu.name || `GPU ${index}`),
        utilizationPct: parseMetricNumber(gpu.utilizationPct),
        temperatureC: parseMetricNumber(gpu.temperatureC),
        memoryUsedMiB: parseMetricNumber(gpu.memoryUsedMiB),
        memoryTotalMiB: parseMetricNumber(gpu.memoryTotalMiB ?? gpu.memory),
        powerDrawW: parseMetricNumber(gpu.powerDrawW),
      };
    })
    .filter(Boolean);
}

function getSelectedGpu(telemetry, selectedValue) {
  const rows = Array.isArray(telemetry) ? telemetry : [];
  const selected = String(selectedValue || "auto");
  if (selected === "auto") return rows[0] || null;
  return rows.find((gpu) => String(gpu?.index) === selected || String(gpu?.uuid || "") === selected) || null;
}

function renderGpuTelemetry(network) {
  const telemetry = normalizeGpuTelemetry(Array.isArray(network?.gpuTelemetry)
    ? network.gpuTelemetry
    : (Array.isArray(network?.cudaDevices) ? network.cudaDevices : []));
  const selected = String(network?.selectedCudaDevice || bridgeState?.config?.bridgeCudaDevice || "auto");
  const selectedGpu = getSelectedGpu(telemetry, selected);
  const hint = String(network?.cudaVisibleDevicesHint || "").trim();

  if (selectedGpuValue) {
    selectedGpuValue.textContent = selected === "auto"
      ? "Auto"
      : `GPU ${selected}`;
  }

  if (selectedGpuHintValue) {
    selectedGpuHintValue.textContent = hint || "Runtime decides";
  }

  if (gpuUsageValue) {
    const utilization = selectedGpu ? parseMetricNumber(selectedGpu.utilizationPct) : null;
    gpuUsageValue.textContent = utilization !== null
      ? `${utilization}%`
      : "-";
  }

  if (gpuTempValue) {
    const temperature = selectedGpu ? parseMetricNumber(selectedGpu.temperatureC) : null;
    gpuTempValue.textContent = temperature !== null
      ? `${temperature} C | ${selectedGpu.name || `GPU ${selectedGpu.index}`}`
      : "Temp pending";
  }

  if (gpuMemoryValue) {
    gpuMemoryValue.textContent = selectedGpu
      ? `${formatMiB(selectedGpu.memoryUsedMiB)} / ${formatMiB(selectedGpu.memoryTotalMiB)}`
      : "-";
  }

  if (gpuMonitorMeta) {
    gpuMonitorMeta.textContent = hint
      ? `${hint} must be set on the Ollama/runtime process for hard GPU isolation.`
      : "Auto mode: runtime can choose any visible GPU.";
  }

  if (!gpuMonitorList) return;

  if (!telemetry.length) {
    gpuMonitorList.innerHTML = '<p class="empty">No NVIDIA GPU telemetry available. Confirm nvidia-smi is installed and accessible.</p>';
    return;
  }

  gpuMonitorList.innerHTML = telemetry
    .map((gpu) => {
      const active = selected !== "auto" && String(gpu.index) === selected;
      const utilizationValue = parseMetricNumber(gpu.utilizationPct);
      const utilization = clampNumber(utilizationValue ?? 0, 0, 100);
      const memoryUsed = parseMetricNumber(gpu.memoryUsedMiB);
      const memoryTotal = parseMetricNumber(gpu.memoryTotalMiB);
      const memoryPct = memoryTotal && memoryUsed !== null ? clampNumber(Math.round((memoryUsed / memoryTotal) * 100), 0, 100) : 0;
      const tempValue = parseMetricNumber(gpu.temperatureC);
      const powerValue = parseMetricNumber(gpu.powerDrawW);
      const freqValue = parseMetricNumber(gpu.clockMHz || gpu.smClockMHz);
      const usageText = utilizationValue === null ? "—" : `${utilizationValue}%`;
      const memoryText = `${formatMiB(memoryUsed)} / ${formatMiB(memoryTotal)}`;
      const temp = tempValue === null ? "—" : `${tempValue}°C`;
      const power = powerValue === null ? "—" : `${powerValue.toFixed(1)} W`;
      const freq = freqValue === null ? "" : `${freqValue} MHz`;
      const useFillClass = utilization >= 90 ? "gpu-prog-fill critical" : utilization >= 70 ? "gpu-prog-fill high" : "gpu-prog-fill";
      const memFillClass = memoryPct >= 90 ? "gpu-prog-fill critical" : memoryPct >= 70 ? "gpu-prog-fill high" : "gpu-prog-fill mem";
      return `
        <article class="gpu-row ${active ? "active" : ""}">
          <div class="gpu-row-head">
            <strong>GPU ${escapeHtml(String(gpu.index))} &nbsp;—&nbsp; ${escapeHtml(gpu.name || "NVIDIA GPU")}</strong>
            <span>${active ? "Selected" : "Visible"}</span>
          </div>
          <div class="gpu-bars">
            <div>
              <span>Utilization <em>${escapeHtml(usageText)}</em></span>
              <div class="gpu-prog"><div class="${useFillClass}" style="width:${utilization}%"></div></div>
            </div>
            <div>
              <span>VRAM <em>${escapeHtml(memoryText)}</em></span>
              <div class="gpu-prog"><div class="${memFillClass}" style="width:${memoryPct}%"></div></div>
            </div>
          </div>
          <div class="gpu-row-foot">
            <div class="gpu-foot-stat"><span class="gpu-foot-label">Temp</span><span class="gpu-foot-value">${escapeHtml(temp)}</span></div>
            <div class="gpu-foot-stat"><span class="gpu-foot-label">Power</span><span class="gpu-foot-value">${escapeHtml(power)}</span></div>
            ${freq ? `<div class="gpu-foot-stat"><span class="gpu-foot-label">Clock</span><span class="gpu-foot-value">${escapeHtml(freq)}</span></div>` : ""}
            <span class="gpu-uuid">${escapeHtml(gpu.uuid || "No UUID")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function filterRequestRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (requestFilter === "all") return safeRows;
  if (requestFilter === "health") {
    return safeRows.filter((entry) => entry.routeGroup === "health" || String(entry.path || "").startsWith("/health"));
  }
  return safeRows.filter((entry) => String(entry.errorClass || "") === requestFilter);
}

function renderRequestDetail(entry) {
  if (!requestDetailBody) return;

  if (!entry) {
    if (selectedRequestStatus) {
      selectedRequestStatus.textContent = "None";
      selectedRequestStatus.className = "status-pill";
    }
    requestDetailBody.innerHTML = '<p class="empty">Select a request row to inspect safe metadata.</p>';
    return;
  }

  const statusCode = Number(entry.statusCode || 0);
  if (selectedRequestStatus) {
    selectedRequestStatus.textContent = String(statusCode || "-");
    selectedRequestStatus.className = `status-pill ${statusTone(statusCode)}`;
  }

  const rows = [
    ["Request ID", entry.requestId || entry.id || "-"],
    ["Method", String(entry.method || "-").toUpperCase()],
    ["Path", entry.path || "-"],
    ["Route group", entry.routeGroup || "-"],
    ["Error class", entry.errorClass || "-"],
    ["Origin", entry.origin || "Local / none"],
    ["Upstream", entry.upstreamHost || entry.upstreamUrl || "-"],
    ["Model", entry.model || "Not supplied"],
    ["CUDA requested", entry.cudaDeviceRequested || "auto"],
    ["CUDA applied", entry.cudaDeviceApplied || "Not applicable"],
    ["Content type", entry.contentType || "Not supplied"],
    ["Body bytes", formatBytes(entry.bodyBytes)],
    ["Response bytes", formatBytes(entry.responseBytes)],
    ["Latency", `${Math.max(0, Number(entry.durationMs || 0))} ms`],
    ["Time", entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-"],
    ["Generated preview", entry.generatedPreview ? `${entry.generatedPreview.length.toLocaleString()} chars` : "None"],
    ["Detail", entry.detail || "-"],
  ];

  requestDetailBody.innerHTML = rows
    .map(([label, value]) => `
      <div class="detail-row">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `)
    .join("");
}

function switchPage(pageName) {
  const nextPage = String(pageName || "dashboard");
  if (nextPage === "settings") {
    toggleSettingsSidebar(true);
    persistUiDraft(false);
    return;
  }

  const page = document.querySelector(`[data-tab-page="${CSS.escape(nextPage)}"]`);
  if (!page) return;

  activePage = nextPage;
  toggleSettingsSidebar(false);
  document.querySelectorAll("[data-tab-page]").forEach((item) => {
    item.classList.toggle("active", item === page);
  });
  updateNavActive(nextPage);
  persistUiDraft(false);

  if (nextPage === "usage") {
    void refreshUsageHistory(false);
  }
}

function renderDashboardRequestRows(rows) {
  if (!dashboardRequestLogBody) return;
  const safeRows = Array.isArray(rows) ? rows.slice(0, 8) : [];
  if (safeRows.length === 0) {
    dashboardRequestLogBody.innerHTML = '<tr><td class="empty" colspan="6">No bridge requests yet.</td></tr>';
    return;
  }

  dashboardRequestLogBody.innerHTML = safeRows
    .map((entry) => {
      const statusCode = Number(entry.statusCode || 0);
      const method = escapeHtml(String(entry.method || "-").toUpperCase());
      const path = escapeHtml(entry.path || "-");
      const routeGroup = escapeHtml(entry.routeGroup || "other");
      const model = escapeHtml(entry.model || "-");
      const latency = `${Math.max(0, Number(entry.durationMs || 0))} ms`;
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "-";
      return `
        <tr>
          <td><span class="status-pill ${statusTone(statusCode)}">${statusCode || "-"}</span></td>
          <td>${method}</td>
          <td>${path}<br /><span style="color:#64748b;">${routeGroup}</span></td>
          <td>${model}</td>
          <td>${latency}</td>
          <td>${escapeHtml(time)}</td>
        </tr>
      `;
    })
    .join("");
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
  updateActiveCudaReadout(cudaDevices, selected);
}

function updateActiveCudaReadout(cudaDevices, selectedValue) {
  const selected = String(selectedValue || "auto");
  const devices = Array.isArray(cudaDevices) ? cudaDevices : [];
  const device = devices.find((item) => String(item?.index) === selected);
  const label = selected === "auto"
    ? "Selected CUDA: auto"
    : `Selected CUDA: GPU ${selected}${device ? ` - ${device.name} (${device.memory})` : ""}`;

  if (activeCudaDeviceValue) activeCudaDeviceValue.textContent = label;
  if (bridgeCopyCuda) bridgeCopyCuda.value = selected;
}

function renderRequestLogRows(rows) {
  if (!requestLogBody) return;

  const filteredRows = filterRequestRows(rows);

  if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
    requestLogBody.innerHTML = '<tr><td class="empty" colspan="7">No bridge requests match this view.</td></tr>';
    if (requestLogMeta) requestLogMeta.textContent = "Waiting for traffic...";
    renderRequestDetail(null);
    return;
  }

  const selectedEntry = filteredRows.find((entry) => (entry.requestId || entry.id) === selectedRequestId) || filteredRows[0];
  selectedRequestId = selectedEntry ? (selectedEntry.requestId || selectedEntry.id || "") : "";
  renderRequestDetail(selectedEntry);

  const topTimestamp = filteredRows[0]?.timestamp ? new Date(filteredRows[0].timestamp) : null;
  if (requestLogMeta) {
    requestLogMeta.textContent = topTimestamp
      ? `${filteredRows.length.toLocaleString()} shown | Last activity ${topTimestamp.toLocaleTimeString()}`
      : "Live stream active";
  }

  requestLogBody.innerHTML = filteredRows
    .slice(0, 250)
    .map((entry) => {
      const statusCode = Number(entry.statusCode || 0);
      const requestId = escapeHtml(entry.requestId || entry.id || "");
      const method = escapeHtml(String(entry.method || "-").toUpperCase());
      const path = escapeHtml(entry.path || "-");
      const routeGroup = escapeHtml(entry.routeGroup || "other");
      const model = escapeHtml(entry.model || "-");
      const bytes = `${formatBytes(entry.bodyBytes)} / ${formatBytes(entry.responseBytes)}`;
      const latency = `${Math.max(0, Number(entry.durationMs || 0))} ms`;
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "-";
      const statusClass = statusTone(statusCode);
      const selectedClass = (entry.requestId || entry.id) === selectedRequestId ? " selected" : "";

      return `
        <tr class="request-row${selectedClass}" data-request-id="${requestId}">
          <td><span class="status-pill ${statusClass}">${statusCode || "-"}</span></td>
          <td>${method}</td>
          <td>${path}<br /><span style="color:#64748b;">${routeGroup}</span></td>
          <td>${model}</td>
          <td>${escapeHtml(bytes)}</td>
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

function buildGeneratedEntries(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows
    .filter((entry) => String(entry?.generatedPreview || "").trim())
    .map((entry) => ({
      id: String(entry.requestId || entry.id || ""),
      requestId: String(entry.requestId || entry.id || ""),
      timestamp: String(entry.timestamp || ""),
      method: String(entry.method || "POST").toUpperCase(),
      path: String(entry.path || "/"),
      routeGroup: String(entry.routeGroup || "generate"),
      model: String(entry.model || "-"),
      statusCode: Number(entry.statusCode || 0),
      durationMs: Number(entry.durationMs || 0),
      text: String(entry.generatedPreview || ""),
    }));
}

function renderGeneratedContentRows(rows) {
  const entries = buildGeneratedEntries(rows);
  displayGeneratedLog = entries.slice(0, 250);

  if (generatedContentMeta) {
    const latest = entries[0]?.timestamp ? new Date(entries[0].timestamp) : null;
    generatedContentMeta.textContent = entries.length
      ? `${entries.length.toLocaleString()} generated item${entries.length === 1 ? "" : "s"} | Latest ${latest ? latest.toLocaleTimeString() : "now"}`
      : "Assistant output from chat/generate calls appears here in memory.";
  }

  if (dashboardGeneratedMeta) {
    dashboardGeneratedMeta.textContent = entries.length
      ? `${entries.length.toLocaleString()} captured`
      : "Waiting for assistant output...";
  }

  const renderList = (target, limit) => {
    if (!target) return;
    const safeEntries = entries.slice(0, limit);
    if (safeEntries.length === 0) {
      target.innerHTML = '<p class="empty">No generated content captured yet.</p>';
      return;
    }

    target.innerHTML = safeEntries
      .map((entry) => {
        const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "-";
        const statusClass = statusTone(entry.statusCode);
        const title = `${entry.method} ${entry.path}`;
        const subline = `${entry.model || "-"} | ${entry.durationMs} ms | ${entry.routeGroup}`;
        return `
          <article class="generated-item" data-generated-id="${escapeHtml(entry.id)}">
            <div class="generated-item-header">
              <h3>${escapeHtml(title)}</h3>
              <span class="status-pill ${statusClass}">${entry.statusCode || "-"}</span>
            </div>
            <pre>${escapeHtml(entry.text)}</pre>
            <div class="generated-item-header">
              <span>${escapeHtml(subline)}</span>
              <span>${escapeHtml(time)}</span>
            </div>
          </article>
        `;
      })
      .join("");
  };

  renderList(generatedContentLogBody, 250);
  renderList(dashboardGeneratedLogBody, 3);
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
      pairingExpiresOutput.value = "Never expires";
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

  // expiresAt is null for non-expiring keys — only reject if a real date is present and past.
  if (typeof pairing.expiresAt === "string" && pairing.expiresAt) {
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
  if (ollamaRuntimeModeSelect) ollamaRuntimeModeSelect.value = config.ollamaRuntimeMode || "managed";
  if (ollamaExecutablePathInput) ollamaExecutablePathInput.value = config.ollamaExecutablePath || "ollama";
  if (bridgeModelInput) bridgeModelInput.value = config.bridgeModel || "";
  if (bridgeThinkingModelInput) bridgeThinkingModelInput.value = config.bridgeThinkingModel || "";
  if (bridgeTemperatureInput) bridgeTemperatureInput.value = String(config.bridgeTemperature ?? 0.3);
  if (bridgeTimeoutInput) bridgeTimeoutInput.value = String(config.bridgeTimeoutMs ?? 36500);
  if (bridgeAutostartInput) bridgeAutostartInput.checked = Boolean(config.bridgeAutostart);
  if (bridgeMinimizeOnCloseInput) bridgeMinimizeOnCloseInput.checked = Boolean(config.minimizeToTaskbarOnClose);
  if (bridgeSystemPromptBaseInput) bridgeSystemPromptBaseInput.value = config.bridgeSystemPromptBase || "";
  if (bridgeInternalChatPromptInput) bridgeInternalChatPromptInput.value = config.bridgeInternalChatPrompt || "";

  renderCudaSelector(network.cudaDevices || [], config.bridgeCudaDevice || "auto");
  renderGpuTelemetry(network);
  renderOllamaState(state.ollama || {}, config);
  updateRuntimeSummary(runtime);

  if (bridgeLocalEndpoint) bridgeLocalEndpoint.textContent = network.localEndpoint || "-";
  if (titleEndpointValue) titleEndpointValue.textContent = network.localEndpoint || "Local LLM service dashboard";
  if (titleModelValue) titleModelValue.textContent = config.bridgeModel ? `Model ${config.bridgeModel}` : "Model pending";
  if (serviceModeValue) {
    const serviceBits = [
      config.bridgeAutostart ? "Autostart" : "Manual start",
      config.ollamaRuntimeMode === "managed" ? "Managed Ollama" : "External Ollama",
      config.minimizeToTaskbarOnClose ? "Tray close" : "Window close",
    ];
    serviceModeValue.textContent = serviceBits.join(" | ");
  }
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
  renderDashboardRequestRows(displayRequestLog);
  renderErrorLogRows(displayErrorLog);
  renderGeneratedContentRows(displayRequestLog);
  renderReportCharts(displayRequestLog, network);
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
    ollamaRuntimeMode: ollamaRuntimeModeSelect?.value || "managed",
    ollamaExecutablePath: ollamaExecutablePathInput?.value || "ollama",
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

async function refreshGpuTelemetry() {
  if (typeof window.oyamaBridge.getGpuTelemetry !== "function") return;
  const telemetryState = await window.oyamaBridge.getGpuTelemetry();
  if (!telemetryState || typeof telemetryState !== "object") return;

  const nextNetwork = {
    ...(bridgeState?.network || {}),
    gpuTelemetry: telemetryState.gpuTelemetry || [],
    cudaDevices: telemetryState.gpuTelemetry || bridgeState?.network?.cudaDevices || [],
    selectedCudaDevice: telemetryState.selectedCudaDevice || bridgeState?.config?.bridgeCudaDevice || "auto",
    cudaVisibleDevicesHint: telemetryState.cudaVisibleDevicesHint || "",
  };

  if (bridgeState) bridgeState.network = nextNetwork;
  renderCudaSelector(nextNetwork.cudaDevices || [], nextNetwork.selectedCudaDevice || "auto");
  renderGpuTelemetry(nextNetwork);
  renderReportCharts(displayRequestLog, nextNetwork);
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

async function restartBridge() {
  if (bridgeRestartBtn) bridgeRestartBtn.disabled = true;
  try {
    const stopResult = await window.oyamaBridge.stopBridge();
    if (!stopResult?.ok) {
      setBridgeMessage(stopResult?.message || "Bridge failed to stop before restart.", true);
      if (stopResult?.state) renderBridgeState(stopResult.state);
      return;
    }

    const startResult = await window.oyamaBridge.startBridge();
    if (!startResult?.ok) {
      setBridgeMessage(startResult?.message || "Bridge failed to restart.", true);
      if (startResult?.state) renderBridgeState(startResult.state);
      return;
    }

    renderBridgeState(startResult.state);
    setBridgeMessage("Bridge restarted.");
  } finally {
    if (bridgeRestartBtn) bridgeRestartBtn.disabled = !Boolean(bridgeState?.runtime?.running);
  }
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
  renderDashboardRequestRows(displayRequestLog);
  renderGeneratedContentRows(displayRequestLog);
  renderReportCharts(displayRequestLog, bridgeState?.network || {});

  if (runtimeSnapshot) {
    updateRuntimeSummary(runtimeSnapshot);
    if (bridgeState && bridgeState.runtime) {
      bridgeState.runtime = runtimeSnapshot;
    }
  }

  scheduleUsageHistoryRefresh();
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
      return;
    }

      if (eventPayload.type === "ollama-runtime") {
        refreshBridgeState(false).catch(() => {
          // Keep UI usable if refresh fails.
        });
        return;
      }

    if (eventPayload.type === "navigate") {
      switchPage(eventPayload.page || "dashboard");
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
  switchPage("dashboard");
  switchAuditTab("requests");

  await refreshBridgeState(false);
  await refreshStartupSettings();
  await refreshBackgroundTools();
  await refreshUsageHistory(false);
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
    ollamaRuntimeModeSelect,
    ollamaExecutablePathInput,
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

  gpuTelemetryTicker = window.setInterval(() => {
    refreshGpuTelemetry().catch(() => {
      // GPU telemetry is best-effort and should not interrupt the dashboard.
    });
  }, 5000);
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

  if (gpuTelemetryTicker) {
    window.clearInterval(gpuTelemetryTicker);
    gpuTelemetryTicker = null;
  }

  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }

  if (usageRefreshTimer) {
    window.clearTimeout(usageRefreshTimer);
    usageRefreshTimer = null;
  }
});

bridgeStartBtn?.addEventListener("click", () => {
  void startBridge();
});

dashboardStartBtn?.addEventListener("click", () => {
  void startBridge();
});

bridgeStopBtn?.addEventListener("click", () => {
  void stopBridge();
});

dashboardStopBtn?.addEventListener("click", () => {
  void stopBridge();
});

bridgeRestartBtn?.addEventListener("click", () => {
  void restartBridge();
});

bridgeRefreshBtn?.addEventListener("click", () => {
  void refreshBridgeState(true);
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
  displayGeneratedLog = [];
  renderRequestLogRows(displayRequestLog);
  renderDashboardRequestRows(displayRequestLog);
  renderErrorLogRows(displayErrorLog);
  renderGeneratedContentRows(displayRequestLog);
  setBridgeMessage("Cleared local audit display. Live bridge stream is still active.");
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

bridgeCudaDeviceSelect?.addEventListener("change", () => {
  updateActiveCudaReadout(bridgeState?.network?.cudaDevices || [], bridgeCudaDeviceSelect.value || "auto");
  renderOllamaState({
    ...(bridgeState?.ollama || {}),
    mode: ollamaRuntimeModeSelect?.value || bridgeState?.ollama?.mode || "managed",
    selectedGpu: bridgeCudaDeviceSelect.value || "auto",
    envHint: bridgeCudaDeviceSelect.value === "auto"
      ? "Automatic GPU selection"
      : `CUDA_VISIBLE_DEVICES=${bridgeCudaDeviceSelect.value}`,
  }, {
    ...(bridgeState?.config || {}),
    bridgeCudaDevice: bridgeCudaDeviceSelect.value || "auto",
    ollamaRuntimeMode: ollamaRuntimeModeSelect?.value || bridgeState?.config?.ollamaRuntimeMode || "managed",
    ollamaExecutablePath: ollamaExecutablePathInput?.value || bridgeState?.config?.ollamaExecutablePath || "ollama",
  });
  persistUiDraft(false);
});

ollamaRuntimeModeSelect?.addEventListener("change", () => {
  renderOllamaState({
    ...(bridgeState?.ollama || {}),
    mode: ollamaRuntimeModeSelect.value || "managed",
    status: ollamaRuntimeModeSelect.value === "managed" ? "managed-starting" : "external-unreachable",
    envHint: bridgeCudaDeviceSelect?.value === "auto"
      ? "Automatic GPU selection"
      : `CUDA_VISIBLE_DEVICES=${bridgeCudaDeviceSelect?.value}`,
    executablePath: ollamaExecutablePathInput?.value || "ollama",
    upstreamUrl: bridgeUpstreamUrlInput?.value || bridgeState?.ollama?.upstreamUrl || "http://127.0.0.1:11434",
  }, {
    ...(bridgeState?.config || {}),
    bridgeCudaDevice: bridgeCudaDeviceSelect?.value || "auto",
    ollamaRuntimeMode: ollamaRuntimeModeSelect.value || "managed",
    ollamaExecutablePath: ollamaExecutablePathInput?.value || "ollama",
    bridgeUpstreamUrl: bridgeUpstreamUrlInput?.value || bridgeState?.config?.bridgeUpstreamUrl || "http://127.0.0.1:11434",
  });
  persistUiDraft(false);
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

requestLogBody?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-request-id]") : null;
  if (!(target instanceof HTMLElement)) return;
  selectedRequestId = target.dataset.requestId || "";
  renderRequestLogRows(displayRequestLog);
});

document.querySelectorAll("[data-request-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    requestFilter = button.getAttribute("data-request-filter") || "all";
    document.querySelectorAll("[data-request-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    selectedRequestId = "";
    renderRequestLogRows(displayRequestLog);
  });
});

document.querySelectorAll("[data-tab-target]").forEach((button) => {
  button.addEventListener("click", () => {
    switchPage(button.getAttribute("data-tab-target") || "dashboard");
  });
});

sidebarToggleBtn?.addEventListener("click", () => {
  toggleCommandSidebar();
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-scroll-target");
    const target = targetId ? document.getElementById(targetId) : null;
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
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

copyLatestGeneratedBtn?.addEventListener("click", () => {
  const latest = displayGeneratedLog[0];
  if (!latest?.text) {
    setBridgeMessage("No generated content is available to copy yet.", true);
    return;
  }
  void copyText(latest.text, "Latest generated content copied.");
});

usageRefreshBtn?.addEventListener("click", () => {
  void refreshUsageHistory(true);
});

settingsCloseBtn?.addEventListener("click", () => {
  toggleSettingsSidebar(false);
});

settingsBackdrop?.addEventListener("click", () => {
  toggleSettingsSidebar(false);
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

trayHideBtn?.addEventListener("click", () => {
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

quitAppBtn?.addEventListener("click", () => {
  window.oyamaBridge.quitApp();
});

window.addEventListener("resize", () => {
  void syncMaxButton();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsOpen) {
    toggleSettingsSidebar(false);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveAllState();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
