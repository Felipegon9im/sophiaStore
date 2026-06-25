const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { exec } = require('child_process');

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
  setupUpdaterIPC();
});

let whatsappClient;

function getExecutablePath() {
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }
  return undefined;
}

function logWp(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'whatsapp-debug.log');
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, line);
  } catch(e) {
    console.error("Failed to write to whatsapp-debug.log:", e);
  }
}

function killWhatsAppProcesses() {
  return new Promise((resolve) => {
    logWp("Attempting to kill WhatsApp Chrome zombie processes...");
    const cmd = `powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*whatsapp-session*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        logWp("Error killing WhatsApp processes: " + err.message);
      } else {
        logWp("WhatsApp Chrome zombie processes killed successfully.");
      }
      resolve();
    });
  });
}

function setupWhatsAppIPC() {
  ipcMain.on('whatsapp-start', async () => {
    logWp("whatsapp-start received.");
    if (whatsappClient) {
      logWp("whatsappClient already exists, skipping initialization.");
      return;
    }

    // Proactively kill any orphaned browser instances locking our profile
    await killWhatsAppProcesses();

    const chromePath = getExecutablePath();
    logWp("Chrome Path found: " + chromePath);

    const puppeteerOpts = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
    };
    if (chromePath) {
      puppeteerOpts.executablePath = chromePath;
    }

    logWp("Creating whatsapp Client instance...");
    try {
      whatsappClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(app.getPath('userData'), 'whatsapp-session') }),
        puppeteer: puppeteerOpts
      });
      logWp("Client instance created successfully.");
    } catch(err) {
      logWp("Client creation error: " + err.message + "\n" + err.stack);
      return;
    }

    whatsappClient.on('qr', async (qr) => {
      logWp("Client Event: qr received.");
      try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        if (mainWindow) mainWindow.webContents.send('whatsapp-qr', qrDataUrl);
      } catch (e) {
        logWp("Error converting QR to data URL: " + e.message);
      }
    });

    whatsappClient.on('ready', () => {
      logWp("Client Event: ready.");
      if (mainWindow) mainWindow.webContents.send('whatsapp-ready');
    });

    whatsappClient.on('authenticated', () => {
      logWp("Client Event: authenticated.");
      if (mainWindow) mainWindow.webContents.send('whatsapp-authenticated');
    });

    whatsappClient.on('disconnected', (reason) => {
      logWp("Client Event: disconnected. Reason: " + reason);
      if (mainWindow) mainWindow.webContents.send('whatsapp-disconnected', reason);
      whatsappClient.destroy().catch(e => logWp("Error destroying client on disconnect: " + e.message));
      whatsappClient = null;
    });

    whatsappClient.on('auth_failure', (msg) => {
      logWp("Client Event: auth_failure. Msg: " + msg);
      if (mainWindow) mainWindow.webContents.send('whatsapp-auth-failure', msg);
    });

    logWp("Initializing client...");
    whatsappClient.initialize()
      .then(() => {
        logWp("whatsappClient.initialize() promise resolved.");
      })
      .catch(err => {
        logWp("whatsappClient.initialize() promise rejected: " + err.message + "\n" + err.stack);
        console.error("Erro ao inicializar Whatsapp:", err);
        if (mainWindow) mainWindow.webContents.send('whatsapp-disconnected', err.message || 'Erro de inicializacao');
      });
  });

  ipcMain.on('whatsapp-logout', async () => {
    if (whatsappClient) {
      try {
        await whatsappClient.logout();
      } catch(e) {}
      try {
        await whatsappClient.destroy();
      } catch(e) {}
      whatsappClient = null;
    }
    await killWhatsAppProcesses();
    const sessionPath = path.join(app.getPath('userData'), 'whatsapp-session');
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    } catch(e) {
      console.error("Erro ao deletar sessao no logout:", e);
      logWp("Error removing session files on logout: " + e.message);
    }
  });

  ipcMain.on('whatsapp-reset', async () => {
    if (whatsappClient) {
      try {
        await whatsappClient.destroy();
      } catch(e) {}
      whatsappClient = null;
    }
    await killWhatsAppProcesses();
    const sessionPath = path.join(app.getPath('userData'), 'whatsapp-session');
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    } catch(e) {
      console.error("Erro ao resetar sessao do WhatsApp:", e);
      logWp("Error removing session files on reset: " + e.message);
    }
    if (mainWindow) mainWindow.webContents.send('whatsapp-reset-done');
  });

  ipcMain.on('whatsapp-send-campaign', async (event, data) => {
    if (!whatsappClient) return;
    const { numbers, message, imagePath, imageUrl } = data;
    let successCount = 0;
    
    let media = null;
    if (data.fileBase64 && data.fileName) {
      try {
        const base64data = data.fileBase64.split(',')[1] || data.fileBase64;
        media = new MessageMedia('application/pdf', base64data, data.fileName);
      } catch (e) {
        console.error("Erro ao ler PDF base64", e);
      }
    } else if (imageUrl) {
      try {
        media = await getMessageMediaFromUrl(imageUrl);
      } catch (e) {
        console.error("Erro ao baixar imagem da URL", e);
      }
    } else if (imagePath) {
      try {
        media = MessageMedia.fromFilePath(imagePath);
      } catch (e) {
        console.error("Erro ao ler imagem", e);
      }
    }
    
    for (let i = 0; i < numbers.length; i++) {
      const number = numbers[i].trim();
      let chatId = number;
      let isRegistered = true;
      
      if (!number.endsWith('@g.us') && !number.endsWith('@c.us')) {
        let cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length > 0) {
          if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
            cleanNumber = '55' + cleanNumber;
          }
          try {
            const registeredId = await whatsappClient.getNumberId(cleanNumber);
            if (registeredId) {
              chatId = registeredId._serialized;
            } else {
              isRegistered = false;
              chatId = cleanNumber + '@c.us';
            }
          } catch (e) {
            chatId = cleanNumber + '@c.us';
          }
        }
      }
      
      let statusStr = 'error';
      if (!isRegistered) {
        statusStr = 'invalid';
      } else {
        try {
          if (media) {
            await whatsappClient.sendMessage(chatId, media, { caption: message });
          } else {
            await whatsappClient.sendMessage(chatId, message);
          }
          successCount++;
          statusStr = 'ok';
        } catch (err) {}
      }
      
      if (mainWindow) {
        mainWindow.webContents.send('whatsapp-progress', { 
          current: i + 1, 
          total: numbers.length, 
          success: successCount,
          target: chatId,
          status: statusStr
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    }
  });

  ipcMain.handle('whatsapp-get-groups', async () => {
    if (!whatsappClient) return [];
    try {
      const chats = await whatsappClient.getChats();
      const groups = chats.filter(c => c.isGroup).map(g => ({
        id: g.id._serialized,
        name: g.name
      }));
      return groups;
    } catch (err) {
      console.error(err);
      return [];
    }
  });
}

async function getMessageMediaFromUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: status ${res.statusCode}`));
        return;
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const mime = res.headers['content-type'] || 'image/jpeg';
        const base64 = buffer.toString('base64');
        resolve(new MessageMedia(mime, base64, 'image.jpg'));
      });
      res.on('error', err => reject(err));
    });
    req.on('error', err => reject(err));
  });
}

function downloadFile(url, dest, onProgress, onSuccess, onError) {
  const protocol = url.startsWith('https') ? https : http;
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  protocol.get(url, options, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      downloadFile(response.headers.location, dest, onProgress, onSuccess, onError);
      return;
    }
    if (response.statusCode !== 200) {
      onError(new Error(`Erro ao baixar: Status ${response.statusCode}`));
      return;
    }

    const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
    let downloadedBytes = 0;
    const fileStream = fs.createWriteStream(dest);

    response.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      fileStream.write(chunk);
      if (totalBytes > 0) {
        onProgress(downloadedBytes, totalBytes);
      }
    });

    response.on('end', () => {
      fileStream.end();
      onSuccess();
    });

    response.on('error', (err) => {
      fileStream.destroy();
      fs.unlink(dest, () => {});
      onError(err);
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    onError(err);
  });
}

function setupUpdaterIPC() {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.on('system-download-update', (event, { url }) => {
    const tempPath = path.join(os.tmpdir(), 'SophiaStoreSetup.exe');
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }

    downloadFile(
      url,
      tempPath,
      (downloaded, total) => {
        const percent = Math.round((downloaded / total) * 100);
        if (mainWindow) {
          mainWindow.webContents.send('system-update-progress', { percent });
        }
      },
      () => {
        if (mainWindow) {
          mainWindow.webContents.send('system-update-ready', { filePath: tempPath });
        }
      },
      (err) => {
        if (mainWindow) {
          mainWindow.webContents.send('system-update-error', err.message);
        }
      }
    );
  });

  ipcMain.on('system-install-update', (event, { filePath }) => {
    const child = exec(`"${filePath}"`, (err) => {
      if (err) {
        console.error('Falha ao rodar instalador:', err);
      }
    });
    child.unref();
    app.quit();
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
