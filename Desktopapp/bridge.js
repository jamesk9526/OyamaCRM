// Renderer logic for dedicated Oyama Bridge Server window.
const bridgeRunningDot = document.getElementById("bridgeRunningDot");
const bridgeStatusValue = document.getElementById("bridgeStatusValue");
const bridgeRequestsValue = document.getElementById("bridgeRequestsValue");
const bridgeUptimeValue = document.getElementById("bridgeUptimeValue");
const bridgeLastError = document.getElementById("bridgeLastError");
const bridgeMessage = document.getElementById("bridgeMessage");
const requestLogBody = document.getElementById("requestLogBody");
const requestLogMeta = document.getElementById("requestLogMeta");

const bridgeStartBtn = document.getElementById("bridgeStartBtn");
const bridgeStopBtn = document.getElementById("bridgeStopBtn");
const bridgeRefreshBtn = document.getElementById("bridgeRefreshBtn");
const bridgeSaveBtn = document.getElementById("bridgeSaveBtn");
const clearLogBtn = document.getElementById("clearLogBtn");

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
const startupPageSelect = document.getElementById("startupPageSelect");

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

const openMainWindowBtn = document.getElementById("openMainWindowBtn");
const setBridgeMainBtn = document.getElementById("setBridgeMainBtn");

const minBtn = document.getElementById("minBtn");
const maxBtn = document.getElementById("maxBtn");
const closeBtn = document.getElementById("closeBtn");

let bridgeState = null;
let runtimeTicker = null;
let detachBridgeEvents = null;
let displayLog = [];

function setBridgeMessage(text, isError = false) {
  if (!bridgeMessage) return;
  bridgeMessage.textContent = text;
  bridgeMessage.classList.toggle("error", Boolean(isError));
}

function setLastError(text, isError) {
  if (!bridgeLastError) return;
  bridgeLastError.textContent = text || "";
  bridgeLastError.classList.toggle("error", Boolean(isError));
}

function formatUptime(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
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
          <td title="${detail}">${path}${detail ? `<br /><span style="color:#64748b;">${detail}</span>` : ""}</td>
          <td>${latency}</td>
          <td>${escapeHtml(time)}</td>
        </tr>
      `;
    })
    .join("");
}

function collectPayload() {
  return {
    startupPage: startupPageSelect?.value || "crm",
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
}

function renderBridgeState(state) {
  if (!state) return;
  bridgeState = state;

  const config = state.config || {};
  const runtime = state.runtime || {};
  const network = state.network || {};
  const appValues = state.appValues || {};

  if (startupPageSelect) startupPageSelect.value = config.startupPage === "bridge" ? "bridge" : "crm";
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

  displayLog = Array.isArray(runtime.requestLog) ? runtime.requestLog.slice(0, 250) : displayLog;
  renderRequestLogRows(displayLog);

  if (setBridgeMainBtn) {
    setBridgeMainBtn.textContent = config.startupPage === "bridge"
      ? "Bridge Is Startup Page"
      : "Use Bridge As Startup";
  }
}

async function refreshBridgeState(showMessage = false) {
  const state = await window.oyamaDesktop.getBridgeState();
  renderBridgeState(state);
  if (showMessage) {
    setBridgeMessage("Bridge state refreshed.");
  }
}

async function saveBridgeSettings() {
  const result = await window.oyamaDesktop.setBridgeConfig(collectPayload());
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Unable to save bridge settings.", true);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge settings saved.");
}

async function setBridgeAsStartup() {
  const result = await window.oyamaDesktop.setBridgeConfig({ startupPage: "bridge" });
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Unable to set bridge startup mode.", true);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge window is now the startup main page.");
}

async function startBridge() {
  const result = await window.oyamaDesktop.startBridge();
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Bridge failed to start.", true);
    if (result?.state) renderBridgeState(result.state);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge started.");
}

async function stopBridge() {
  const result = await window.oyamaDesktop.stopBridge();
  if (!result?.ok) {
    setBridgeMessage(result?.message || "Bridge failed to stop.", true);
    if (result?.state) renderBridgeState(result.state);
    return;
  }

  renderBridgeState(result.state);
  setBridgeMessage("Bridge stopped.");
}

function appendRequestLog(entry, runtimeSnapshot) {
  if (!entry || typeof entry !== "object") return;

  displayLog = [entry, ...displayLog.filter((row) => row.id !== entry.id)].slice(0, 250);
  renderRequestLogRows(displayLog);

  if (runtimeSnapshot) {
    updateRuntimeSummary(runtimeSnapshot);
  }
}

function attachBridgeEventStream() {
  if (typeof window.oyamaDesktop.onBridgeEvent !== "function") return;

  detachBridgeEvents = window.oyamaDesktop.onBridgeEvent((eventPayload) => {
    if (!eventPayload || typeof eventPayload !== "object") return;

    if (eventPayload.type === "request") {
      appendRequestLog(eventPayload.entry, eventPayload.runtime);
      return;
    }

    if (eventPayload.type === "runtime") {
      updateRuntimeSummary(eventPayload.runtime || {});
      return;
    }

    if (eventPayload.type === "config") {
      refreshBridgeState(false).catch(() => {
        // Keep UI usable even if config refresh fails.
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

      try {
        await navigator.clipboard.writeText(input.value || "");
        setBridgeMessage("Copied value to clipboard.");
      } catch {
        setBridgeMessage("Clipboard copy failed on this system.", true);
      }
    });
  });
}

async function syncMaxButton() {
  if (!maxBtn) return;
  const maximized = await window.oyamaDesktop.isMaximized();
  maxBtn.textContent = maximized ? "o" : "[]";
}

async function bootstrap() {
  attachBridgeEventStream();
  wireCopyButtons();
  await refreshBridgeState(false);
  await syncMaxButton();

  runtimeTicker = window.setInterval(() => {
    if (bridgeState?.runtime?.running) {
      updateRuntimeSummary(bridgeState.runtime);
      bridgeState.runtime.uptimeMs = Number(bridgeState.runtime.uptimeMs || 0) + 1000;
    }
  }, 1000);
}

window.addEventListener("beforeunload", () => {
  if (detachBridgeEvents) {
    detachBridgeEvents();
    detachBridgeEvents = null;
  }

  if (runtimeTicker) {
    window.clearInterval(runtimeTicker);
    runtimeTicker = null;
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
  void saveBridgeSettings();
});

clearLogBtn?.addEventListener("click", () => {
  displayLog = [];
  renderRequestLogRows(displayLog);
  setBridgeMessage("Cleared local request display. Server log stream is still active.");
});

openMainWindowBtn?.addEventListener("click", async () => {
  await window.oyamaDesktop.openMainWindow();
  setBridgeMessage("CRM shell window opened.");
});

setBridgeMainBtn?.addEventListener("click", () => {
  void setBridgeAsStartup();
});

minBtn?.addEventListener("click", () => {
  window.oyamaDesktop.minimize();
});

maxBtn?.addEventListener("click", async () => {
  window.oyamaDesktop.toggleMaximize();
  window.setTimeout(() => {
    void syncMaxButton();
  }, 60);
});

closeBtn?.addEventListener("click", () => {
  window.oyamaDesktop.close();
});

window.addEventListener("resize", () => {
  void syncMaxButton();
});

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
