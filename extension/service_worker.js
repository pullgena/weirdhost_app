const APP_URL = 'http://127.0.0.1:32145';
let lastPayload = { active: false };

function isWeirdHostUrl(url = '') {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'weirdhost.xyz' || u.hostname.endsWith('.weirdhost.xyz'));
  } catch { return false; }
}

async function sendToApp(payload) {
  lastPayload = payload;
  try {
    await fetch(`${APP_URL}/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WeirdHost-Bridge': 'v1'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    await chrome.storage.local.set({ appConnected: true, lastSentAt: Date.now(), lastPayload: payload });
  } catch {
    await chrome.storage.local.set({ appConnected: false, lastPayload: payload });
  }
}

async function updateFromActiveTab(windowId) {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ active: true, windowId: windowId ?? chrome.windows.WINDOW_ID_CURRENT });
  } catch {}
  const tab = tabs[0];
  if (!tab || !isWeirdHostUrl(tab.url)) {
    return sendToApp({ active: false });
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { kind: 'WEIRDHOST_REQUEST_STATE' });
  } catch {
    sendToApp({ active: true, url: tab.url || '', host: new URL(tab.url).host, serverName: '', section: 'other', title: tab.title || '' });
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.kind !== 'WEIRDHOST_PAGE_STATE') return;
  if (!sender.tab?.active) return;
  sendToApp(msg);
});

chrome.tabs.onActivated.addListener((info) => updateFromActiveTab(info.windowId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete' || changeInfo.title)) updateFromActiveTab(tab.windowId);
});
chrome.tabs.onRemoved.addListener(() => updateFromActiveTab());
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) updateFromActiveTab(windowId);
});
chrome.runtime.onStartup.addListener(() => updateFromActiveTab());
chrome.runtime.onInstalled.addListener(() => updateFromActiveTab());

setInterval(() => {
  if (lastPayload?.active) sendToApp(lastPayload);
}, 8000);
