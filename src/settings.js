const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 9;
const DEFAULTS = {
  enabled: true,
  launchAtStartup: true,
  discordApplicationId: '',
  activityType: 3,
  activityNameTemplate: 'weirdhost {type}',
  showServerName: true,
  showSection: true,
  showElapsedTime: true,
  detailsTemplate: '{server}',
  stateTemplate: '{section}',
  fallbackServerText: 'WeirdHost',
  sectionLabels: {
    console: '콘솔 확인 중',
    files: '파일 관리 중',
    databases: '데이터베이스 관리 중',
    subdomain: '도메인 관리 중',
    schedules: '일정 관리 중',
    users: '유저 관리 중',
    backups: '백업 관리 중',
    network: '네트워크 관리 중',
    startup: '서버 시작 설정 확인 중',
    settings: '위어드호스트 설정 확인 중',
    activity: '활동 확인 중',
    properties: '서버 설정 확인 중',
    playermanager: '플레이어 관리 중',
    ready: '준비중',
    home: 'WeirdHost',
    other: '서버 관리 중'
  },
  autoUpdate: true,
  bridgePort: 32145,
  staleAfterMs: 15000,
  settingsSchemaVersion: SCHEMA_VERSION
};

// DEFAULTS에 존재하는 설정만 유지해 예전 버전의 폐기된 키가 쌓이지 않게 합니다.
function mergeKnown(base, override) {
  const out = structuredClone(base);
  if (!override || typeof override !== 'object') return out;
  for (const key of Object.keys(base)) {
    if (!(key in override)) continue;
    const value = override[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])
    ) out[key] = mergeKnown(base[key], value);
    else out[key] = value;
  }
  return out;
}

function migrate(parsed) {
  const merged = mergeKnown(DEFAULTS, parsed);
  const version = Number(parsed?.settingsSchemaVersion || 1);

  if (version < 5) {
    if (!parsed.detailsTemplate || parsed.detailsTemplate === '{server}' || parsed.detailsTemplate === '서버 이름 : {server} 에서') {
      merged.detailsTemplate = '{server}';
    }
    if (!parsed.stateTemplate || parsed.stateTemplate === '{section}') merged.stateTemplate = '{section}';
    if (!parsed.sectionLabels?.settings || parsed.sectionLabels.settings === '서버 설정 확인 중') {
      merged.sectionLabels.settings = '위어드호스트 설정 확인 중';
    }
  }
  if (version < 6 && !parsed.sectionLabels?.ready) merged.sectionLabels.ready = '준비중';
  if (version < 7) {
    if (!parsed.fallbackServerText || ['weirdhost 서버', 'WeirdHost 서버'].includes(parsed.fallbackServerText)) {
      merged.fallbackServerText = 'WeirdHost';
    }
    if (!parsed.sectionLabels?.home) merged.sectionLabels.home = 'WeirdHost';
  }
  if (version < 8 && !parsed.activityNameTemplate) merged.activityNameTemplate = 'weirdhost {type}';

  merged.settingsSchemaVersion = SCHEMA_VERSION;
  return merged;
}

class SettingsStore {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, 'settings.json');
    this.data = this.load();
  }

  write(data) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf8');
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const merged = migrate(parsed);
      if (Number(parsed.settingsSchemaVersion || 1) < SCHEMA_VERSION) {
        try { this.write(merged); } catch {}
      }
      return merged;
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  get() {
    return structuredClone(this.data);
  }

  set(next) {
    this.data = mergeKnown(this.data, next);
    this.data.settingsSchemaVersion = SCHEMA_VERSION;
    this.write(this.data);
    return this.get();
  }

  reset() {
    this.data = structuredClone(DEFAULTS);
    this.write(this.data);
    return this.get();
  }
}

module.exports = { SettingsStore, DEFAULTS };
