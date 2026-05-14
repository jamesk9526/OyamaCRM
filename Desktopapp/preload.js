// Preload bridge for renderer-safe IPC calls.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oyamaDesktop", {
  getConfig: () => ipcRenderer.invoke("oyama:get-config"),
  getBoundUrl: () => ipcRenderer.invoke("oyama:get-bound-url"),
  setBoundUrl: (url) => ipcRenderer.invoke("oyama:set-bound-url", url),
  setShellColor: (color) => ipcRenderer.invoke("oyama:set-shell-color", color),
  setLockSettings: (settings) => ipcRenderer.invoke("oyama:set-lock-settings", settings),
  getBridgeState: () => ipcRenderer.invoke("oyama:get-bridge-state"),
  setBridgeConfig: (payload) => ipcRenderer.invoke("oyama:set-bridge-config", payload),
  startBridge: () => ipcRenderer.invoke("oyama:bridge-start"),
  stopBridge: () => ipcRenderer.invoke("oyama:bridge-stop"),
  minimize: () => ipcRenderer.send("oyama:window-minimize"),
  toggleMaximize: () => ipcRenderer.send("oyama:window-toggle-maximize"),
  close: () => ipcRenderer.send("oyama:window-close"),
  quitApp: () => ipcRenderer.send("oyama:app-quit"),
  isMaximized: () => ipcRenderer.invoke("oyama:window-is-maximized")
});
