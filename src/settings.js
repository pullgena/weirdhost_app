const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  enabled: true,
  launchAtStartup: true,
  discordApplicationId: '',
  activityType: 3,
  showServerName: true,
  showSection: true,
  showElapsedTime: true,
  detailsTemplate: '서버 이름 : {server} 에서',
  stateTemplate: '{section}',
  fallbackServerText: 'WeirdHost 서버',
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
    other: '서버 관리 중'
  },

  largeImageKey: '',
  largeImageText: 'weirdhost',
  autoUpdate: true,
  bridgePort: 32145,
  staleAfterMs: 15000,
  settingsSchemaVersion: 3
};

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

class SettingsStore {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, 'settings.json');
    this.data = this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      const merged = deepMerge(DEFAULTS, parsed);

      // v0.1.4 기본 Discord 표시 형식과 WeirdHost URL 탭 구성을 마이그레이션합니다.
      // 사용자가 직접 바꾼 템플릿은 건드리지 않습니다.
      if (Number(parsed.settingsSchemaVersion || 1) < 3) {
        if (!parsed.detailsTemplate || parsed.detailsTemplate === '{server}') {
          merged.detailsTemplate = '서버 이름 : {server} 에서';
        }
        if (!parsed.stateTemplate || parsed.stateTemplate === '{section}') {
          merged.stateTemplate = '{section}';
        }
        if (!parsed.largeImageText || parsed.largeImageText === 'WeirdHost') {
          merged.largeImageText = 'weirdhost';
        }
        // v0.1.3의 기본 'settings' 문구는 이제 /settings(위어드호스트 설정)에 맞춥니다.
        if (!parsed.sectionLabels?.settings || parsed.sectionLabels.settings === '서버 설정 확인 중') {
          merged.sectionLabels.settings = '위어드호스트 설정 확인 중';
        }
        merged.activityType = 3;
        merged.settingsSchemaVersion = 3;
        try {
          fs.mkdirSync(path.dirname(this.file), { recursive: true });
          fs.writeFileSync(this.file, JSON.stringify(merged, null, 2), 'utf8');
        } catch {}
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
    this.data = deepMerge(this.data, next);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    return this.get();
  }

  reset() {
    this.data = structuredClone(DEFAULTS);
    this.set(this.data);
    return this.get();
  }
}

module.exports = { SettingsStore, DEFAULTS };
