const APP_URL = 'http://127.0.0.1:32145';
let lastPayload = { active: false };
let lastWeirdHostTabId = null;
const pageStates = new Map();
let refreshTimer = null;

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
    const entries = Object.entries(cache);
    if (entries.length > 100) {
      for (const [key] of entries.slice(0, entries.length - 100)) delete cache[key];
    }
    try { await chrome.storage.local.set({ serverNameCache: cache }); } catch {}
    return { ...payload, serverId, serverName: candidate };
  }

  if (cached) return { ...payload, serverId, serverName: cached };
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

function fallbackStateForTab(tab) {
  let host = '';
  try { host = new URL(tab?.url || '').host; } catch {}
  return {
    kind: 'WEIRDHOST_PAGE_STATE',
    active: true,
    viewing: false,
    url: tab?.url || '',
    host,
    serverId: serverIdFromUrl(tab?.url || ''),
    serverName: '',
    serverNameReliable: false,
    section: 'ready',
    title: tab?.title || ''
  };
}

async function requestTabState(tab) {
  if (!tab?.id) return fallbackStateForTab(tab);
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { kind: 'WEIRDHOST_REQUEST_STATE' });
    if (response?.kind === 'WEIRDHOST_PAGE_STATE') {
      pageStates.set(tab.id, response);
      return response;
    }
  } catch {}
  return pageStates.get(tab.id) || fallbackStateForTab(tab);
}

async function getFocusedActiveTab() {
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win?.focused) return { tab: null, browserFocused: false };
    const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
    return { tab: tabs[0] || null, browserFocused: true };
  } catch {
    return { tab: null, browserFocused: false };
  }
}

async function getWeirdHostTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs.filter((tab) => isWeirdHostUrl(tab.url));
  } catch {
    return [];
  }
}

async function refreshPresenceState() {
  const weirdTabs = await getWeirdHostTabs();
  if (!weirdTabs.length) {
    lastWeirdHostTabId = null;
    pageStates.clear();
    await sendToApp({ active: false, viewing: false });
    return;
  }

  const { tab: activeTab, browserFocused } = await getFocusedActiveTab();
  const viewingWeirdHost = Boolean(browserFocused && activeTab && isWeirdHostUrl(activeTab.url));

  if (viewingWeirdHost) {
    lastWeirdHostTabId = activeTab.id;
    const state = await requestTabState(activeTab);
    await sendToApp({
      ...state,
      active: true,
      viewing: true,
      section: state.section || 'other'
    });
    return;
  }

  // WeirdHost 탭은 열려 있지만 사용자가 현재 보고 있지 않은 상태입니다.
  // 가장 최근에 보던 WeirdHost 탭의 서버 이름은 유지하고 메뉴 상태만 '준비중'으로 바꿉니다.
  let candidate = weirdTabs.find((tab) => tab.id === lastWeirdHostTabId) || null;
  if (!candidate) candidate = weirdTabs[0];
  const state = await requestTabState(candidate);
  await sendToApp({
    ...state,
    active: true,
    viewing: false,
    section: 'ready'
  });
}

function scheduleRefresh(delay = 40) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshPresenceState().catch(() => {}); }, delay);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.kind !== 'WEIRDHOST_PAGE_STATE' || !sender.tab?.id) return;
  pageStates.set(sender.tab.id, msg);
  if (sender.tab.active) lastWeirdHostTabId = sender.tab.id;
  scheduleRefresh(20);
});

chrome.tabs.onActivated.addListener(() => scheduleRefresh(20));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isWeirdHostUrl(tab.url) || pageStates.has(tabId) || changeInfo.url || changeInfo.status === 'complete') {
    scheduleRefresh(80);
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  pageStates.delete(tabId);
  if (lastWeirdHostTabId === tabId) lastWeirdHostTabId = null;
  scheduleRefresh(20);
});
chrome.windows.onFocusChanged.addListener(() => scheduleRefresh(20));
chrome.runtime.onStartup.addListener(() => scheduleRefresh(100));
chrome.runtime.onInstalled.addListener(() => scheduleRefresh(100));

// MV3 서비스 워커가 살아 있는 동안 상태를 주기적으로 재확인합니다.
setInterval(() => refreshPresenceState().catch(() => {}), 8000);
