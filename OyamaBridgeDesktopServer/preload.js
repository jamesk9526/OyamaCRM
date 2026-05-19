// Preload bridge for renderer-safe IPC calls.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oyamaBridge", {
  getConfig: () => ipcRenderer.invoke("oyama-bridge:get-config"),
  setConfig: (payload) => ipcRenderer.invoke("oyama-bridge:set-config", payload),
  getBridgeState: () => ipcRenderer.invoke("oyama-bridge:get-bridge-state"),
  getGpuTelemetry: () => ipcRenderer.invoke("oyama-bridge:get-gpu-telemetry"),
  buildPairing: (payload) => ipcRenderer.invoke("oyama-bridge:build-pairing", payload),
  bridgeChat: (payload) => ipcRenderer.invoke("oyama-bridge:chat", payload),
  getBackgroundTools: () => ipcRenderer.invoke("oyama-bridge:get-background-tools"),
  setBackgroundTools: (payload) => ipcRenderer.invoke("oyama-bridge:set-background-tools", payload),
  runSecureBackup: (payload) => ipcRenderer.invoke("oyama-bridge:run-secure-backup", payload),
  getStartupSettings: () => ipcRenderer.invoke("oyama-bridge:get-startup-settings"),
  setStartupSettings: (payload) => ipcRenderer.invoke("oyama-bridge:set-startup-settings", payload),
  startBridge: () => ipcRenderer.invoke("oyama-bridge:start"),
  stopBridge: () => ipcRenderer.invoke("oyama-bridge:stop"),
  onBridgeEvent: (handler) => {
    if (typeof handler !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => {
      handler(payload);
    };

    ipcRenderer.on("oyama-bridge:event", listener);
    return () => {
      ipcRenderer.removeListener("oyama-bridge:event", listener);
    };
  },
  minimize: () => ipcRenderer.send("oyama-bridge:window-minimize"),
  toggleMaximize: () => ipcRenderer.send("oyama-bridge:window-toggle-maximize"),
  close: () => ipcRenderer.send("oyama-bridge:window-close"),
  quitApp: () => ipcRenderer.send("oyama-bridge:app-quit"),
  isMaximized: () => ipcRenderer.invoke("oyama-bridge:window-is-maximized"),
});
