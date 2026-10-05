(() => {
  const SECTION_RULES = [
    ['console', [/\/console(?:\/|$)/i, /콘솔/i, /console/i]],
    ['files', [/\/files?(?:\/|$)/i, /파일\s*관리/i, /file\s*manager/i]],
    ['settings', [/\/settings?(?:\/|$)/i, /서버\s*설정/i, /settings?/i]],
    ['backups', [/\/backups?(?:\/|$)/i, /백업/i, /backups?/i]],
    ['startup', [/\/startup(?:\/|$)/i, /시작\s*설정/i, /startup/i]],
    ['schedules', [/\/schedules?(?:\/|$)/i, /스케줄/i, /schedules?/i]],
    ['users', [/\/users?(?:\/|$)/i, /사용자\s*관리/i, /users?/i]],
    ['plugins', [/\/plugins?(?:\/|$)/i, /플러그인/i, /plugins?/i]],
    ['network', [/\/network(?:\/|$)/i, /네트워크/i, /network/i]],
    ['dashboard', [/\/dashboard(?:\/|$)/i, /대시보드/i, /dashboard/i]]
  ];

  const GENERIC = new Set(['weirdhost', 'weirdhost panel', '위어드호스트', '대시보드', 'dashboard', 'console', '콘솔', 'files', '파일 관리', 'settings', '설정']);

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function goodName(text) {
    const s = clean(text);
    if (!s || s.length < 2 || s.length > 80) return false;
    if (GENERIC.has(s.toLowerCase())) return false;
    if (/^(콘솔|파일|설정|백업|스케줄|네트워크|플러그인|사용자)/i.test(s)) return false;
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
    const haystack = `${location.pathname} ${document.title} ${clean(document.querySelector('main h1, main h2, h1')?.textContent)}`;
    for (const [key, rules] of SECTION_RULES) {
      if (rules.some((r) => r.test(haystack))) return key;
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

  let timer = setInterval(send, 4000);
  const observer = new MutationObserver(() => {
    clearTimeout(window.__weirdhostPresenceDebounce);
    window.__weirdhostPresenceDebounce = setTimeout(send, 350);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('focus', send);
  window.addEventListener('pageshow', send);
  send();
})();
