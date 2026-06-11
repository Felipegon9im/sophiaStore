const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

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
      sandbox: true
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
});

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
