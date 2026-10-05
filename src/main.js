const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell } = require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { SettingsStore } = require('./settings');
const { BridgeServer } = require('./bridge-server');
const { DiscordIpcClient } = require('./discord-ipc');

let mainWindow = null;
let tray = null;
let store = null;
let bridge = null;
let discord = null;
let quitting = false;
let staleTimer = null;
let sessionStartedAt = 0;
let lastPage = { active: false };
let updaterState = { status: 'idle', version: app.getVersion(), progress: 0, message: '' };
let discordState = { connected: false, message: '연결 대기 중', level: 'waiting' };
let bridgeState = { listening: false, message: '브리지 시작 대기 중' };

function trayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#5865F2"/>
      <path fill="#fff" d="M8 10h5l3 8 3-8h5l-6 13h-4z"/>
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 760,
    minHeight: 620,
    show: false,
    title: 'WeirdHost Presence',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('WeirdHost Presence');
  tray.on('double-click', showWindow);
  refreshTrayMenu();
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function refreshTrayMenu() {
  if (!tray || !store) return;
  const settings = store.get();
  const menu = Menu.buildFromTemplate([
    { label: 'WeirdHost Presence 열기', click: showWindow },
    { type: 'separator' },
    {
      label: settings.enabled ? 'Presence 정지' : 'Presence 시작',
      click: () => setServiceEnabled(!settings.enabled)
    },
    { type: 'separator' },
    { label: '앱 종료', click: () => quitApp() }
  ]);
  tray.setContextMenu(menu);
}

function activityTypeName(type) {
  return ({ 0: '플레이 중', 2: '듣는 중', 3: '시청 중', 5: '경쟁 중' })[Number(type)] || '시청 중';
}

function sectionText(section, settings) {
  return settings.sectionLabels?.[section] || settings.sectionLabels?.other || '서버 관리 중';
}

function applyTemplate(template, vars) {
  return String(template || '')
    .replaceAll('{server}', vars.server)
    .replaceAll('{section}', vars.section)
    .replaceAll('{host}', vars.host)
    .replaceAll('{title}', vars.title)
    .trim()
    .slice(0, 128);
}

function buildActivity(page, settings) {
  const server = settings.showServerName
    ? (page.serverName || settings.fallbackServerText || 'WeirdHost 서버')
    : (settings.fallbackServerText || 'WeirdHost 서버');
  const section = settings.showSection ? sectionText(page.section, settings) : 'WeirdHost 이용 중';
  const details = applyTemplate(settings.detailsTemplate, { server, section, host: page.host || '', title: page.title || '' });
  const state = applyTemplate(settings.stateTemplate, { server, section, host: page.host || '', title: page.title || '' });

  const activity = {
    type: Number(settings.activityType),
    details: details || undefined,
    state: state || undefined,
    instance: false
  };

  if (settings.showElapsedTime && sessionStartedAt) {
    activity.timestamps = { start: Math.floor(sessionStartedAt / 1000) };
  }

  if (settings.largeImageKey) {
    activity.assets = {
      large_image: settings.largeImageKey,
      large_text: settings.largeImageText || 'WeirdHost'
    };
  }

  return activity;
}

async function syncPresence() {
  const settings = store.get();
  const shouldShow = settings.enabled && lastPage.active && Boolean(settings.discordApplicationId);

  if (!shouldShow) {
    try { await discord.clearActivity(); } catch {}
    broadcastState();
    return;
  }

  if (!sessionStartedAt) sessionStartedAt = Date.now();
  try {
    if (discord.clientId !== settings.discordApplicationId) {
      await discord.switchApplication(settings.discordApplicationId);
    } else if (!discord.ready) {
      await discord.connect(settings.discordApplicationId);
    }
    await discord.setActivity(buildActivity(lastPage, settings));
  } catch (error) {
    discordState = { connected: false, message: error.message || 'Discord 연결 실패' };
  }
  broadcastState();
}

function onBridgeActivity(page) {
  const wasActive = Boolean(lastPage.active);
  lastPage = page;
  if (!page.active) sessionStartedAt = 0;
  else if (!wasActive) sessionStartedAt = Date.now();
  syncPresence();
}

function startStaleWatch() {
  clearInterval(staleTimer);
  staleTimer = setInterval(() => {
    const settings = store.get();
    if (lastPage.active && bridge.lastSeenAt && Date.now() - bridge.lastSeenAt > settings.staleAfterMs) {
      lastPage = { active: false };
      sessionStartedAt = 0;
      syncPresence();
    }
  }, 3000);
}

function applyStartupSetting() {
  const settings = store.get();
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.launchAtStartup),
    path: process.execPath,
    args: ['--hidden']
  });
}

async function setServiceEnabled(enabled) {
  store.set({ enabled: Boolean(enabled) });
  if (!enabled) {
    sessionStartedAt = 0;
    try { await discord.clearActivity(); } catch {}
  } else {
    await syncPresence();
  }
  refreshTrayMenu();
  broadcastState();
  return stateSnapshot();
}

function stateSnapshot() {
  const settings = store.get();
  return {
    version: app.getVersion(),
    settings,
    service: {
      enabled: settings.enabled,
      bridgePort: bridge?.port || settings.bridgePort,
      bridgeListening: Boolean(bridgeState.listening),
      bridgeMessage: bridgeState.message,
      extensionConnected: Boolean(bridge?.lastSeenAt && Date.now() - bridge.lastSeenAt < settings.staleAfterMs),
      current: lastPage,
      activityTypeLabel: activityTypeName(settings.activityType)
    },
    discord: discordState,
    updater: updaterState
  };
}

function broadcastState() {
  const state = stateSnapshot();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:state', state);
}

function setupUpdater() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updaterState = { ...updaterState, status: 'checking', message: '업데이트 확인 중…' };
    broadcastState();
  });
  autoUpdater.on('update-available', (info) => {
    updaterState = { status: 'downloading', version: info.version, progress: 0, message: `v${info.version} 다운로드 중…` };
    broadcastState();
  });
  autoUpdater.on('update-not-available', () => {
    updaterState = { status: 'latest', version: app.getVersion(), progress: 100, message: '최신 버전입니다.' };
    broadcastState();
  });
  autoUpdater.on('download-progress', (p) => {
    updaterState = { ...updaterState, status: 'downloading', progress: Math.round(p.percent), message: `업데이트 다운로드 ${Math.round(p.percent)}%` };
    broadcastState();
  });
  autoUpdater.on('update-downloaded', (info) => {
    updaterState = { status: 'ready', version: info.version, progress: 100, message: '업데이트 준비 완료. 재시작하면 적용됩니다.' };
    if (Notification.isSupported()) new Notification({ title: 'WeirdHost Presence', body: '새 업데이트가 준비되었습니다.' }).show();
    broadcastState();
  });
  autoUpdater.on('error', (error) => {
    updaterState = { status: 'error', version: app.getVersion(), progress: 0, message: `업데이트 오류: ${error.message}` };
    broadcastState();
  });
}

async function checkUpdates() {
  if (!app.isPackaged) {
    updaterState = { status: 'dev', version: app.getVersion(), progress: 0, message: '개발 모드에서는 자동 업데이트를 확인하지 않습니다.' };
    broadcastState();
    return updaterState;
  }
  try { await autoUpdater.checkForUpdates(); } catch (error) {
    updaterState = { status: 'error', version: app.getVersion(), progress: 0, message: error.message };
  }
  broadcastState();
  return updaterState;
}

async function quitApp() {
  quitting = true;
  try { await discord?.clearActivity(); } catch {}
  discord?.destroy();
  await bridge?.stop().catch(() => {});
  app.quit();
}

function registerIpc() {
  ipcMain.handle('app:get-state', () => stateSnapshot());
  ipcMain.handle('app:set-service-enabled', (_e, enabled) => setServiceEnabled(enabled));
  ipcMain.handle('app:save-settings', async (_e, next) => {
    const before = store.get();
    const saved = store.set(next || {});
    if (saved.bridgePort !== before.bridgePort) {
      await bridge.stop();
      bridge = new BridgeServer(saved.bridgePort);
      bridge.on('activity', onBridgeActivity);
      try {
        await bridge.start();
        bridgeState = { listening: true, message: `로컬 브리지 ${saved.bridgePort} 포트 정상` };
      } catch (error) {
        bridgeState = { listening: false, message: `로컬 브리지 시작 실패: ${error.message}` };
        throw error;
      }
    }
    applyStartupSetting();
    refreshTrayMenu();
    if (saved.discordApplicationId !== before.discordApplicationId) {
      try { await discord.switchApplication(saved.discordApplicationId); } catch {}
    }
    await syncPresence();
    return stateSnapshot();
  });
  ipcMain.handle('app:retry-connections', async () => {
    const settings = store.get();
    if (!bridgeState.listening) {
      try {
        await bridge.stop().catch(() => {});
        bridge = new BridgeServer(settings.bridgePort);
        bridge.on('activity', onBridgeActivity);
        await bridge.start();
        bridgeState = { listening: true, message: `로컬 브리지 ${settings.bridgePort} 포트 정상` };
      } catch (error) {
        bridgeState = { listening: false, message: `로컬 브리지 시작 실패: ${error.message}` };
      }
    }
    if (settings.discordApplicationId) {
      discordState = { connected: false, message: 'Discord 다시 연결 중…', level: 'waiting' };
      broadcastState();
      try { await discord.switchApplication(settings.discordApplicationId); } catch {}
    }
    await syncPresence();
    return stateSnapshot();
  });
  ipcMain.handle('app:check-updates', () => checkUpdates());
  ipcMain.handle('app:open-discord-portal', async () => {
    await shell.openExternal('https://discord.com/developers/applications');
    return true;
  });
  ipcMain.handle('app:open-extension-folder', async () => {
    const extensionPath = app.isPackaged
      ? path.join(process.resourcesPath, 'extension')
      : path.join(__dirname, '..', 'extension');
    await shell.openPath(extensionPath);
    return extensionPath;
  });
  ipcMain.handle('app:install-update', () => {
    if (updaterState.status === 'ready') autoUpdater.quitAndInstall(false, true);
    return updaterState;
  });
  ipcMain.handle('app:quit', () => quitApp());
}

app.whenReady().then(async () => {
  store = new SettingsStore(app.getPath('userData'));
  discord = new DiscordIpcClient();
  discord.on('status', (s) => { discordState = s; broadcastState(); });
  discord.on('error-frame', (data) => {
    discordState = { connected: discord.ready, message: data?.data?.message || 'Discord RPC 오류' };
    broadcastState();
  });

  bridge = new BridgeServer(store.get().bridgePort);
  bridge.on('activity', onBridgeActivity);
  try {
    await bridge.start();
    bridgeState = { listening: true, message: `로컬 브리지 ${store.get().bridgePort} 포트 정상` };
  } catch (error) {
    bridgeState = { listening: false, message: `로컬 브리지 시작 실패: ${error.message}` };
    log.error('Bridge start failed', error);
  }

  createWindow();
  createTray();
  applyStartupSetting();
  registerIpc();
  setupUpdater();
  startStaleWatch();

  if (process.argv.includes('--hidden')) mainWindow.hide();
  else mainWindow.show();

  const settings = store.get();
  if (settings.discordApplicationId) {
    discordState = { connected: false, message: 'Discord 연결 중…', level: 'waiting' };
    broadcastState();
    discord.connect(settings.discordApplicationId).catch(() => {});
  } else {
    discordState = { connected: false, message: 'Discord 앱 ID가 필요합니다.', level: 'error' };
    broadcastState();
  }
  if (settings.autoUpdate) setTimeout(() => checkUpdates(), 3000);
});

app.on('window-all-closed', (event) => event?.preventDefault?.());
app.on('before-quit', () => { quitting = true; });
app.on('activate', () => showWindow());
