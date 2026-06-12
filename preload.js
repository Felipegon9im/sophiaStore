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
  sendCampaign: (data) => ipcRenderer.send('whatsapp-send-campaign', data)
});
