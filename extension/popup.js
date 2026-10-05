(async () => {
  const data = await chrome.storage.local.get(['appConnected', 'lastPayload']);
  document.getElementById('app').textContent = data.appConnected ? '연결됨' : '연결 안 됨';
  const p = data.lastPayload || {};
  if (!p.active) {
    document.getElementById('page').textContent = '위어드호스트 탭 없음';
  } else if (p.viewing === false) {
    document.getElementById('page').textContent = `${p.serverName || 'weirdhost'} · 준비중`;
  } else {
    document.getElementById('page').textContent = `${p.serverName || 'weirdhost'} · ${p.section || 'other'}`;
  }
})();
