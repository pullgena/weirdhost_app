const sectionNames = {
  dashboard: '대시보드', console: '콘솔', files: '파일 관리', settings: '설정', backups: '백업',
  startup: '시작 설정', schedules: '스케줄', users: '사용자', plugins: '플러그인', network: '네트워크', other: '기타'
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
  $('largeImageKey').value = s.largeImageKey || '';
  $('largeImageText').value = s.largeImageText || '';
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
    largeImageKey: $('largeImageKey').value.trim(),
    largeImageText: $('largeImageText').value.trim(),
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
    server: server || 'WeirdHost 서버',
    section: s.showSection ? section : 'WeirdHost 이용 중',
    host: page.host || '',
    title: page.title || ''
  };
  const typeLabel = ({ 0: '플레이 중', 2: '듣는 중', 3: '시청 중', 5: '경쟁 중' })[Number(s.activityType)] || '시청 중';
  $('previewType').textContent = `${typeLabel} WeirdHost`;
  $('previewDetails').textContent = applyTemplate(s.detailsTemplate, vars) || '—';
  $('previewState').textContent = applyTemplate(s.stateTemplate, vars) || '—';
}

function render(state, first = false) {
  currentState = state;
  const page = state.service.current || {};
  $('serviceState').textContent = state.service.enabled ? '실행 중' : '정지됨';
  $('extensionState').textContent = state.service.extensionConnected ? '연결됨' : '신호 없음';
  $('discordState').textContent = state.discord.message || (state.discord.connected ? '연결됨' : '연결 대기');

  if (page.active) {
    const server = page.serverName || state.settings.fallbackServerText || 'WeirdHost 서버';
    const section = sectionNames[page.section] || page.section || '기타';
    $('currentPageState').textContent = `${server} · ${section}`;
  } else {
    $('currentPageState').textContent = '위어드호스트 탭 없음';
  }

  $('mainStatus').textContent = state.service.enabled && page.active ? '활동 표시 중' : state.service.enabled ? '대기 중' : '정지됨';
  $('updateStatus').textContent = state.updater.message || `v${state.version}`;
  $('installUpdateBtn').hidden = state.updater.status !== 'ready';
  $('startBtn').disabled = state.service.enabled;
  $('stopBtn').disabled = !state.service.enabled;
  if (first) fillSettings(state.settings);
  renderPreview(state, true);
}

function applyRecommendedSettings() {
  $('activityType').value = '3';
  $('showServerName').checked = true;
  $('showSection').checked = true;
  $('showElapsedTime').checked = true;
  $('launchAtStartup').checked = true;
  $('fallbackServerText').value = 'WeirdHost 서버';
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
  $('quitBtn').addEventListener('click', () => window.weirdhost.quit());
  $('openExtensionBtn').addEventListener('click', () => window.weirdhost.openExtensionFolder());
  $('openDiscordPortalBtn').addEventListener('click', () => window.weirdhost.openDiscordPortal());
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
