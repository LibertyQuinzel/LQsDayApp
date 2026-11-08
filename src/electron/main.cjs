const { app, BrowserWindow, ipcMain, nativeImage, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_NAME = 'MyDay';
const SAVE_DELAY_MS = 300;
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const iconPath = path.join(__dirname, 'icon.png');

app.commandLine.appendSwitch('class', 'myday');
app.setName(APP_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.libertyq.day');
}

let mainWindow = null;
let pendingState = null;
let saveTimer = null;

function getDataFile() {
  return path.join(app.getPath('userData'), 'app-state.json');
}

function readState() {
  const dataFile = getDataFile();
  let raw;

  try {
    raw = fs.readFileSync(dataFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch {
    // Keep the unreadable file for inspection instead of overwriting it with defaults.
    fs.renameSync(dataFile, `${dataFile}.corrupt-${Date.now()}`);
    return null;
  }
}

function flushState() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!pendingState) return;

  const dataFile = getDataFile();
  const tempFile = `${dataFile}.tmp`;

  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(tempFile, JSON.stringify({ ...pendingState, updatedAt: new Date().toISOString() }, null, 2));
    fs.renameSync(tempFile, dataFile);
    pendingState = null;
  } catch (error) {
    console.error('Failed to save app state:', error);
  }
}

function scheduleSave(state) {
  pendingState = state;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushState, SAVE_DELAY_MS);
}

function createWindow() {
  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: '#05030a',
    icon,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    ipcMain.handle('state:read', readState);
    ipcMain.on('state:write', (_event, state) => scheduleSave(state));
    ipcMain.handle('notification:show', (_event, options) => {
      if (!Notification.isSupported()) return false;

      new Notification({
        title: options?.title ?? APP_NAME,
        body: options?.body ?? '',
        icon: iconPath
      }).show();
      return true;
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Write any change still waiting on the save delay before the app exits.
  app.on('before-quit', flushState);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
