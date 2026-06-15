const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsappAPI', {
  onQrCode: (callback) => ipcRenderer.on('whatsapp-qr', callback),
  onReady: (callback) => ipcRenderer.on('whatsapp-ready', callback),
  onAuthenticated: (callback) => ipcRenderer.on('whatsapp-authenticated', callback),
  onDisconnected: (callback) => ipcRenderer.on('whatsapp-disconnected', callback),
  onAuthFailure: (callback) => ipcRenderer.on('whatsapp-auth-failure', callback),
  onProgress: (callback) => ipcRenderer.on('whatsapp-progress', callback),
  
  startSession: () => ipcRenderer.send('whatsapp-start'),
  logout: () => ipcRenderer.send('whatsapp-logout'),
  sendCampaign: (data) => ipcRenderer.send('whatsapp-send-campaign', data),
  getGroups: () => ipcRenderer.invoke('whatsapp-get-groups')
});

contextBridge.exposeInMainWorld('systemAPI', {
  downloadUpdate: (url) => ipcRenderer.send('system-download-update', { url }),
  installUpdate: (filePath) => ipcRenderer.send('system-install-update', { filePath }),
  onUpdateProgress: (callback) => ipcRenderer.on('system-update-progress', (event, data) => callback(data)),
  onUpdateReady: (callback) => ipcRenderer.on('system-update-ready', (event, data) => callback(data)),
  onUpdateError: (callback) => ipcRenderer.on('system-update-error', (event, data) => callback(data))
});
