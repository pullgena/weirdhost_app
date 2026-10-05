(() => {
  // WeirdHost의 탭은 화면 글자가 아니라 URL 경로로 판별합니다.
  // /server/<고유코드>/ 자체가 콘솔이고, 나머지는 아래 경로를 사용합니다.
  const ROUTES = [
    ['files', 'files'],
    ['databases', 'databases'],
    ['subdomain', 'subdomain'],
    ['schedules', 'schedules'],
    ['users', 'users'],
    ['backups', 'backups'],
    ['network', 'network'],
    ['startup', 'startup'],
    ['settings', 'settings'],
    ['activity', 'activity'],
    ['properties', 'properties'],
    ['playermanager', 'playermanager']
  ];

  const GENERIC = new Set([
    'weirdhost', 'weirdhost panel', '위어드호스트', '대시보드', 'dashboard',
    'console', '콘솔', 'files', '파일 관리', 'settings', '설정', 'server', '서버',
    'loading', 'loading...', '로딩', '로딩 중', '불러오는 중', '불러오는 중...',
    'please wait', 'please wait...', '잠시만 기다려 주세요', '잠시만 기다려주세요',
    'undefined', 'null'
  ]);

  let lastGoodServerName = '';

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function isTransientName(text) {
    const s = clean(text).toLowerCase();
    if (!s) return true;
    if (GENERIC.has(s)) return true;
    return /^(loading|please wait|로딩|불러오는 중|잠시만)/i.test(s);
  }

  function goodName(text) {
    const s = clean(text);
    if (!s || s.length < 2 || s.length > 80) return false;
    if (isTransientName(s)) return false;
    if (/^(콘솔|파일|설정|백업|일정|네트워크|유저|데이터베이스|도메인|활동|플레이어)/i.test(s)) return false;
    return true;
  }

  function serverIdFromLocation() {
    let pathname = '';
    try { pathname = new URL(location.href).pathname; } catch { pathname = location.pathname || ''; }
    const match = pathname.match(/^\/server\/([^/]+)(?:\/|$)/i);
    return match ? String(match[1] || '') : '';
  }

  function extractServerName() {
    const selectors = [
      '[data-server-name]', '[data-testid*="server-name" i]', '[data-testid*="server" i][data-testid*="name" i]',
      '[class*="server-name" i]', '[class*="servername" i]', '[class*="server_title" i]', '[class*="server-title" i]',
      'header h1', 'main h1', 'main h2', 'h1'
    ];

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const text = el.getAttribute('data-server-name') || el.textContent;
        if (goodName(text)) {
          const name = clean(text);
          lastGoodServerName = name;
          return { name, reliable: true, source: 'dom' };
        }
      }
    }

    // 새로고침 중에는 title이 'Loading…' 같은 임시 문자열로 바뀔 수 있으므로
    // 문서가 완전히 로드된 뒤에만 낮은 우선순위 후보로 사용합니다.
    if (document.readyState === 'complete') {
      const titleParts = clean(document.title).split(/[|–—-]/).map(clean).filter(Boolean);
      for (const part of titleParts) {
        if (goodName(part)) {
          const name = clean(part);
          return { name: lastGoodServerName || name, reliable: Boolean(lastGoodServerName), source: 'title' };
        }
      }
    }

    return { name: lastGoodServerName, reliable: Boolean(lastGoodServerName), source: lastGoodServerName ? 'memory' : 'none' };
  }

  function detectSection() {
    let pathname = '';
    try { pathname = new URL(location.href).pathname; } catch { pathname = location.pathname || ''; }
    pathname = pathname.replace(/\/{2,}/g, '/');

    // 정확히 /server/<고유코드>/ 이면 콘솔입니다.
    if (/^\/server\/[^/]+\/?$/i.test(pathname)) return 'console';

    const match = pathname.match(/^\/server\/[^/]+\/([^/]+)(?:\/|$)/i);
    if (!match) return 'other';
    const segment = String(match[1] || '').toLowerCase();

    for (const [key, route] of ROUTES) {
      if (segment === route) return key;
    }
    return 'other';
  }

  function snapshot() {
    const server = extractServerName();
    return {
      kind: 'WEIRDHOST_PAGE_STATE',
      active: true,
      url: location.href,
      host: location.host,
      serverId: serverIdFromLocation(),
      serverName: server.name,
      serverNameReliable: server.reliable,
      serverNameSource: server.source,
      section: detectSection(),
      title: document.title,
      readyState: document.readyState
    };
  }

  function send() {
    try { chrome.runtime.sendMessage(snapshot()); } catch {}
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.kind !== 'WEIRDHOST_REQUEST_STATE') return;
    const state = snapshot();
    sendResponse(state);
  });

  setInterval(send, 4000);
  const observer = new MutationObserver(() => {
    clearTimeout(window.__weirdhostPresenceDebounce);
    window.__weirdhostPresenceDebounce = setTimeout(send, 350);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('focus', send);
  window.addEventListener('pageshow', send);
  window.addEventListener('load', () => setTimeout(send, 250));
  send();
})();
