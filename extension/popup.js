(async () => {
  const data = await chrome.storage.local.get(['appConnected', 'lastPayload']);
  document.getElementById('app').textContent = data.appConnected ? '연결됨' : '연결 안 됨';
  const p = data.lastPayload || {};
  document.getElementById('page').textContent = p.active ? `${p.serverName || 'WeirdHost'} · ${p.section || 'other'}` : '위어드호스트 탭 없음';
})();
