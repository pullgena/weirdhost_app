const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('weirdhost', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),
  setServiceEnabled: (enabled) => ipcRenderer.invoke('app:set-service-enabled', enabled),
  retryConnections: () => ipcRenderer.invoke('app:retry-connections'),
  quit: () => ipcRenderer.invoke('app:quit'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  openExtensionFolder: () => ipcRenderer.invoke('app:open-extension-folder'),
  openDiscordAssetsFolder: () => ipcRenderer.invoke('app:open-discord-assets-folder'),
  openDiscordPortal: () => ipcRenderer.invoke('app:open-discord-portal'),
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('app:state', handler);
    return () => ipcRenderer.removeListener('app:state', handler);
  }
});
