const APP_URL = 'http://127.0.0.1:32145';
let lastPayload = { active: false };

function isWeirdHostUrl(url = '') {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'weirdhost.xyz' || u.hostname.endsWith('.weirdhost.xyz'));
  } catch { return false; }
}

function serverIdFromUrl(url = '') {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/^\/server\/([^/]+)(?:\/|$)/i);
    return match ? String(match[1] || '') : '';
  } catch { return ''; }
}

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 128);
}

function isTransientName(value) {
  const s = cleanName(value).toLowerCase();
  if (!s) return true;
  return /^(loading|please wait|로딩|불러오는 중|잠시만|undefined|null)/i.test(s);
}

async function getServerNameCache() {
  try {
    const stored = await chrome.storage.local.get('serverNameCache');
    return stored.serverNameCache && typeof stored.serverNameCache === 'object' ? stored.serverNameCache : {};
  } catch {
    return {};
  }
}

async function normalizeServerName(payload) {
  if (!payload?.active) return payload;
  const serverId = String(payload.serverId || serverIdFromUrl(payload.url) || '');
  if (!serverId) return payload;

  const cache = await getServerNameCache();
  const cached = cleanName(cache[serverId]);
  const candidate = cleanName(payload.serverName);
  const reliable = Boolean(payload.serverNameReliable) && !isTransientName(candidate);

  if (reliable && candidate) {
    cache[serverId] = candidate;
    // 오래된 캐시가 무한히 커지지 않도록 최근 100개만 유지합니다.
    const entries = Object.entries(cache);
    if (entries.length > 100) {
      for (const [key] of entries.slice(0, entries.length - 100)) delete cache[key];
    }
    try { await chrome.storage.local.set({ serverNameCache: cache }); } catch {}
    return { ...payload, serverId, serverName: candidate };
  }

  // 새로고침/라우팅 직후 DOM이 아직 안 만들어졌다면 이전에 확인한 정상 이름을 유지합니다.
  if (cached) return { ...payload, serverId, serverName: cached };

  // 캐시가 아직 없는 최초 접속에서는 임시 로딩 문자열을 서버 이름으로 보내지 않습니다.
  return { ...payload, serverId, serverName: isTransientName(candidate) ? '' : candidate };
}

async function sendToApp(payload) {
  const normalized = await normalizeServerName(payload);
  lastPayload = normalized;
  try {
    await fetch(`${APP_URL}/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WeirdHost-Bridge': 'v1'
      },
      body: JSON.stringify(normalized),
      cache: 'no-store'
    });
    await chrome.storage.local.set({ appConnected: true, lastSentAt: Date.now(), lastPayload: normalized });
  } catch {
    await chrome.storage.local.set({ appConnected: false, lastPayload: normalized });
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
    sendToApp({
      active: true,
      url: tab.url || '',
      host: new URL(tab.url).host,
      serverId: serverIdFromUrl(tab.url || ''),
      serverName: '',
      serverNameReliable: false,
      section: 'other',
      title: tab.title || ''
    });
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
