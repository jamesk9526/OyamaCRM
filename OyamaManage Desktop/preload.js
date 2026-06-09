const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oyamaDesktop", {
  probeInstance: (baseUrl) => ipcRenderer.invoke("oyama-desktop:probe-instance", { baseUrl }),
  openLoginWindow: (baseUrl) => ipcRenderer.invoke("oyama-desktop:open-login", { baseUrl }),
  loadDashboard: (baseUrl) => ipcRenderer.invoke("oyama-desktop:load-dashboard", { baseUrl }),
  windowControl: (action) => ipcRenderer.invoke("oyama-desktop:window-control", action),
});
