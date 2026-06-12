const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Sophia Elegance Store - Painel Corporativo",
    backgroundColor: "#1a0a12", // Matches the boutique HSL dark theme
    show: false, // Prevents white flash before rendering
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the admin panel file
  mainWindow.loadFile(path.join(__dirname, 'admin.html'));

  // Disable default menu bar to look like a premium native application
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize(); // Opens maximized for operational ease inside the store
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  createWindow();

  // Register a developer shortcut to toggle DevTools if needed (Ctrl+Shift+I)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
  
  setupWhatsAppIPC();
});

let whatsappClient;

function setupWhatsAppIPC() {
  ipcMain.on('whatsapp-start', () => {
    if (whatsappClient) return;

    whatsappClient = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(app.getPath('userData'), 'whatsapp-session') }),
      puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
      }
    });

    whatsappClient.on('qr', async (qr) => {
      try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        if (mainWindow) mainWindow.webContents.send('whatsapp-qr', qrDataUrl);
      } catch (e) {}
    });

    whatsappClient.on('ready', () => {
      if (mainWindow) mainWindow.webContents.send('whatsapp-ready');
    });

    whatsappClient.on('authenticated', () => {
      if (mainWindow) mainWindow.webContents.send('whatsapp-authenticated');
    });

    whatsappClient.on('disconnected', (reason) => {
      if (mainWindow) mainWindow.webContents.send('whatsapp-disconnected', reason);
      whatsappClient.destroy();
      whatsappClient = null;
    });

    whatsappClient.on('auth_failure', (msg) => {
      if (mainWindow) mainWindow.webContents.send('whatsapp-auth-failure', msg);
    });

    whatsappClient.initialize();
  });

  ipcMain.on('whatsapp-logout', async () => {
    if (whatsappClient) {
      try {
        await whatsappClient.logout();
      } catch(e) {}
    }
  });

  ipcMain.on('whatsapp-send-campaign', async (event, data) => {
    if (!whatsappClient) return;
    const { numbers, message } = data;
    let successCount = 0;
    
    for (let i = 0; i < numbers.length; i++) {
      const number = numbers[i];
      let cleanNumber = number.replace(/\D/g, '');
      if (!cleanNumber.startsWith('55')) cleanNumber = '55' + cleanNumber;
      const chatId = cleanNumber + '@c.us';
      
      try {
        await whatsappClient.sendMessage(chatId, message);
        successCount++;
      } catch (err) {}
      
      if (mainWindow) {
        mainWindow.webContents.send('whatsapp-progress', { current: i + 1, total: numbers.length, success: successCount });
      }
      
      // Delay between 2 to 4 seconds
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    }
  });
}

app.on('window-all-closed', function () {
  // On macOS it is common for applications to stay open until explicit Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts before exit
  globalShortcut.unregisterAll();
});
