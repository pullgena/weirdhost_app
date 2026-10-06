const sectionNames = {
  console: '콘솔',
  files: '파일 관리',
  databases: '데이터베이스',
  subdomain: '도메인 관리',
  schedules: '일정',
  users: '유저',
  backups: '백업',
  network: '네트워크',
  startup: '서버 시작 설정',
  settings: '위어드호스트 설정',
  activity: '활동',
  properties: '서버 설정',
  playermanager: '플레이어 관리',
  ready: '준비중',
  home: '서버 선택',
  other: '기타'
};

let currentState = null;

const $ = (id) => document.getElementById(id);

function renderSectionInputs(labels = {}) {
  const root = $('sectionLabels');
  root.innerHTML = '';
  for (const [key, name] of Object.entries(sectionNames)) {
    const label = document.createElement('label');
    label.textContent = name;
    const input = document.createElement('input');
    input.dataset.section = key;
    input.value = labels[key] || '';
    input.placeholder = `${name} 확인 중`;
    label.appendChild(input);
    root.appendChild(label);
  }
}

function fillSettings(s) {
  $('clientId').value = s.discordApplicationId || '';
  $('activityType').value = String(s.activityType ?? 3);
  $('fallbackServerText').value = s.fallbackServerText || '';
  $('detailsTemplate').value = s.detailsTemplate || '';
  $('stateTemplate').value = s.stateTemplate || '';
  $('showServerName').checked = Boolean(s.showServerName);
  $('showSection').checked = Boolean(s.showSection);
  $('showElapsedTime').checked = Boolean(s.showElapsedTime);
  $('launchAtStartup').checked = Boolean(s.launchAtStartup);
  $('autoUpdate').checked = Boolean(s.autoUpdate);
  renderSectionInputs(s.sectionLabels || {});
}

function collectSettings() {
  const sectionLabels = {};
  document.querySelectorAll('[data-section]').forEach((input) => { sectionLabels[input.dataset.section] = input.value.trim(); });
  return {
    discordApplicationId: $('clientId').value.replace(/\D/g, ''),
    activityType: Number($('activityType').value),
    fallbackServerText: $('fallbackServerText').value.trim(),
    detailsTemplate: $('detailsTemplate').value.trim(),
    stateTemplate: $('stateTemplate').value.trim(),
    showServerName: $('showServerName').checked,
    showSection: $('showSection').checked,
    showElapsedTime: $('showElapsedTime').checked,
    launchAtStartup: $('launchAtStartup').checked,
    autoUpdate: $('autoUpdate').checked,
    sectionLabels
  };
}

function applyTemplate(template, vars) {
  return String(template || '')
    .replaceAll('{server}', vars.server)
    .replaceAll('{section}', vars.section)
    .replaceAll('{host}', vars.host)
    .replaceAll('{title}', vars.title);
}

function previewSettingsFromForm(base) {
  if (!$('clientId')) return base;
  return {
    ...base,
    ...collectSettings()
  };
}

function renderPreview(state, useForm = false) {
  const s = useForm ? previewSettingsFromForm(state.settings) : state.settings;
  const page = state.service.current || {};
  const section = (s.sectionLabels || {})[page.section] || s.sectionLabels?.other || '서버 관리 중';
  const server = s.showServerName ? (page.serverName || s.fallbackServerText) : s.fallbackServerText;
  const vars = {
    server: server || 'weirdhost 서버',
    section: s.showSection ? section : 'weirdhost 이용 중',
    host: page.host || '',
    title: page.title || ''
  };
  const typeLabel = ({ 0: '플레이 중', 2: '듣는 중', 3: '시청 중', 5: '경쟁 중' })[Number(s.activityType)] || '시청 중';
  $('previewType').textContent = `weirdhost ${typeLabel}`;
  if (page.section === 'console' || page.section === 'home') {
    $('previewDetails').textContent = 'WeirdHost';
    $('previewState').textContent = '—';
  } else if (page.section === 'ready' && !page.serverId) {
    $('previewDetails').textContent = 'WeirdHost';
    $('previewState').textContent = (s.sectionLabels || {}).ready || '준비중';
  } else {
    $('previewDetails').textContent = applyTemplate(s.detailsTemplate, vars) || '—';
    $('previewState').textContent = applyTemplate(s.stateTemplate, vars) || '—';
  }
}

function setStatusValue(id, text, tone = 'neutral') {
  const el = $(id);
  el.textContent = text;
  el.className = `status-value ${tone}`;
}

function diagnose(state) {
  const page = state.service.current || {};
  const settings = state.settings || {};
  const discordMessage = String(state.discord?.message || '');

  if (!state.service.enabled) {
    return {
      level: 'off',
      title: 'Presence가 정지되어 있습니다',
      message: '시작 버튼을 누르면 연결 확인을 시작합니다.',
      tip: '왼쪽 아래의 “시작” 버튼을 눌러주세요.'
    };
  }

  if (!settings.discordApplicationId) {
    return {
      level: 'error',
      title: 'Discord 앱 ID가 필요합니다',
      message: 'Discord Application ID를 저장해야 활동을 표시할 수 있습니다.',
      tip: '아래 간단 설정 1번에 Application ID 숫자를 붙여넣고 “저장하고 적용”을 눌러주세요.'
    };
  }

  if (!state.service.bridgeListening) {
    return {
      level: 'error',
      title: '브라우저 연결 서버를 시작하지 못했습니다',
      message: state.service.bridgeMessage || '로컬 브리지에 문제가 있습니다.',
      tip: '“다시 확인”을 눌러보세요. 계속 실패하면 다른 프로그램이 32145 포트를 사용 중인지 확인해야 합니다.'
    };
  }

  if (!state.service.extensionConnected) {
    return {
      level: 'waiting',
      title: '확장프로그램 연결 대기 중',
      message: 'Chrome/Edge/Brave 확장프로그램에서 아직 신호가 오지 않았습니다.',
      tip: '확장프로그램이 켜져 있는지 확인한 뒤 WeirdHost 탭을 한 번 열거나 전환해 주세요.'
    };
  }

  if (!page.active) {
    return {
      level: 'waiting',
      title: 'WeirdHost 탭을 기다리는 중',
      message: '확장프로그램은 정상 연결됐지만 현재 활성 탭이 WeirdHost가 아닙니다.',
      tip: 'Chrome/Edge/Brave에서 WeirdHost 탭을 클릭해 활성화해 주세요.'
    };
  }

  if (!state.discord?.connected) {
    const hardError = /찾지 못|오류|실패|끊어|invalid|denied|close/i.test(discordMessage);
    return {
      level: hardError ? 'error' : 'waiting',
      title: hardError ? 'Discord 연결 오류' : 'Discord 연결 중',
      message: discordMessage || 'Discord 데스크톱 앱과 연결하고 있습니다.',
      tip: hardError
        ? 'Discord 데스크톱 앱이 실행 중인지, Application ID가 정확한지 확인한 뒤 “다시 확인”을 눌러주세요.'
        : '잠시 기다려주세요. 오래 걸리면 “다시 확인”을 눌러주세요.'
    };
  }

  if (page.viewing === false) {
    return {
      level: 'ok',
      title: '준비중',
      message: 'WeirdHost 탭은 열려 있지만 현재 보고 있지 않습니다.',
      tip: 'WeirdHost 탭으로 돌아가면 서버와 현재 메뉴 표시로 자동 전환됩니다.'
    };
  }

  return {
    level: 'ok',
    title: '정상 작동 중',
    message: 'WeirdHost 정보가 Discord 활동으로 전송되고 있습니다.',
    tip: '서버나 메뉴를 이동하면 Discord 표시도 자동으로 바뀝니다.'
  };
}

function render(state, first = false) {
  currentState = state;
  const page = state.service.current || {};
  const diagnosis = diagnose(state);

  const health = $('healthBanner');
  health.className = `health-banner ${diagnosis.level}`;
  $('healthIcon').textContent = diagnosis.level === 'ok' ? '●' : diagnosis.level === 'error' ? '!' : diagnosis.level === 'off' ? 'Ⅱ' : '…';
  $('healthTitle').textContent = diagnosis.title;
  $('healthMessage').textContent = diagnosis.message;
  $('diagnosticTip').textContent = diagnosis.tip;

  setStatusValue('serviceState', state.service.enabled ? '켜짐' : '정지됨', state.service.enabled ? 'ok' : 'off');
  setStatusValue(
    'extensionState',
    state.service.extensionConnected ? '연결됨' : (state.service.bridgeListening ? '연결 대기' : '브리지 오류'),
    state.service.extensionConnected ? 'ok' : (state.service.bridgeListening ? 'waiting' : 'error')
  );
  setStatusValue(
    'discordState',
    state.discord?.message || (state.discord?.connected ? '연결됨' : '연결 대기'),
    state.discord?.connected ? 'ok' : (/찾지 못|오류|실패|끊어/i.test(state.discord?.message || '') ? 'error' : 'waiting')
  );

  if (page.active) {
    const server = page.serverName || state.settings.fallbackServerText || 'weirdhost 서버';
    const section = sectionNames[page.section] || page.section || '기타';
    setStatusValue('currentPageState', page.viewing === false ? `${server} · 준비중` : `${server} · ${section}`, 'ok');
  } else {
    setStatusValue('currentPageState', '활성 WeirdHost 탭 없음', state.service.extensionConnected ? 'waiting' : 'neutral');
  }

  const mainLabels = {
    ok: '🟢 정상 작동 중',
    waiting: '🟡 연결 대기',
    error: '🔴 확인 필요',
    off: '⚪ 정지됨'
  };
  $('mainStatus').textContent = diagnosis.title === '준비중' ? '🟢 준비중' : (mainLabels[diagnosis.level] || diagnosis.title);
  $('mainStatus').className = `status-pill ${diagnosis.level}`;
  $('updateStatus').textContent = state.updater.message || `v${state.version}`;
  $('installUpdateBtn').hidden = state.updater.status !== 'ready';
  $('startBtn').disabled = state.service.enabled;
  $('stopBtn').disabled = !state.service.enabled;
  $('retryBtn').disabled = false;
  if (first) fillSettings(state.settings);
  renderPreview(state, true);
}

function applyRecommendedSettings() {
  $('activityType').value = '3';
  $('showServerName').checked = true;
  $('showSection').checked = true;
  $('showElapsedTime').checked = true;
  $('launchAtStartup').checked = true;
  $('fallbackServerText').value = 'WeirdHost';
  $('detailsTemplate').value = '{server}';
  $('stateTemplate').value = '{section}';
  if (currentState) renderPreview(currentState, true);
}

function bindLivePreview() {
  const ids = [
    'activityType', 'fallbackServerText', 'detailsTemplate', 'stateTemplate',
    'showServerName', 'showSection', 'showElapsedTime'
  ];
  ids.forEach((id) => {
    $(id).addEventListener('input', () => currentState && renderPreview(currentState, true));
    $(id).addEventListener('change', () => currentState && renderPreview(currentState, true));
  });
  document.querySelectorAll('[data-section]').forEach((input) => {
    input.addEventListener('input', () => currentState && renderPreview(currentState, true));
  });
}

async function init() {
  const state = await window.weirdhost.getState();
  render(state, true);
  bindLivePreview();
  window.weirdhost.onState((next) => render(next));

  $('startBtn').addEventListener('click', async () => render(await window.weirdhost.setServiceEnabled(true)));
  $('stopBtn').addEventListener('click', async () => render(await window.weirdhost.setServiceEnabled(false)));
  $('retryBtn').addEventListener('click', async () => {
    $('retryBtn').disabled = true;
    $('retryBtn').textContent = '확인 중…';
    try { render(await window.weirdhost.retryConnections()); }
    finally { $('retryBtn').disabled = false; $('retryBtn').textContent = '다시 확인'; }
  });
  $('quitBtn').addEventListener('click', () => window.weirdhost.quit());
  $('openExtensionBtn').addEventListener('click', () => window.weirdhost.openExtensionFolder());
  $('openDiscordPortalBtn').addEventListener('click', () => window.weirdhost.openDiscordPortal());
  $('openDiscordAssetsBtn')?.addEventListener('click', () => window.weirdhost.openDiscordAssetsFolder());
  $('openDiscordPortalBrandingBtn')?.addEventListener('click', () => window.weirdhost.openDiscordPortal());
  $('recommendedBtn').addEventListener('click', applyRecommendedSettings);
  $('checkUpdateBtn').addEventListener('click', async () => {
    await window.weirdhost.checkForUpdates();
  });
  $('installUpdateBtn').addEventListener('click', () => window.weirdhost.installUpdate());
  $('saveBtn').addEventListener('click', async () => {
    const id = $('clientId').value.replace(/\D/g, '');
    $('clientId').value = id;
    if (!id) {
      $('saveNotice').textContent = 'Discord 앱 ID를 먼저 입력해 주세요.';
      $('saveNotice').classList.add('error');
      $('clientId').focus();
      return;
    }
    const next = await window.weirdhost.saveSettings(collectSettings());
    render(next);
    $('saveNotice').classList.remove('error');
    $('saveNotice').textContent = '저장하고 적용했습니다.';
    setTimeout(() => { $('saveNotice').textContent = ''; }, 1800);
  });
}

init();
