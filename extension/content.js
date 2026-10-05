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
    'console', '콘솔', 'files', '파일 관리', 'settings', '설정'
  ]);

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function goodName(text) {
    const s = clean(text);
    if (!s || s.length < 2 || s.length > 80) return false;
    if (GENERIC.has(s.toLowerCase())) return false;
    if (/^(콘솔|파일|설정|백업|일정|네트워크|유저|데이터베이스|도메인|활동|플레이어)/i.test(s)) return false;
    return true;
  }

  function extractServerName() {
    const selectors = [
      '[data-server-name]', '[data-testid*="server-name" i]', '[class*="server-name" i]',
      '[class*="servername" i]', '[class*="server_title" i]', '[class*="server-title" i]',
      'header h1', 'main h1', 'main h2', 'h1'
    ];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const text = el.getAttribute('data-server-name') || el.textContent;
        if (goodName(text)) return clean(text);
      }
    }

    const titleParts = clean(document.title).split(/[|–—-]/).map(clean).filter(Boolean);
    for (const part of titleParts) if (goodName(part)) return part;
    return '';
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
    return {
      kind: 'WEIRDHOST_PAGE_STATE',
      active: true,
      url: location.href,
      host: location.host,
      serverName: extractServerName(),
      section: detectSection(),
      title: document.title
    };
  }

  function send() {
    try { chrome.runtime.sendMessage(snapshot()); } catch {}
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.kind === 'WEIRDHOST_REQUEST_STATE') send();
  });

  setInterval(send, 4000);
  const observer = new MutationObserver(() => {
    clearTimeout(window.__weirdhostPresenceDebounce);
    window.__weirdhostPresenceDebounce = setTimeout(send, 350);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('focus', send);
  window.addEventListener('pageshow', send);
  send();
})();
