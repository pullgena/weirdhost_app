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
    dashboard: '대시보드 확인 중',
    console: '콘솔 확인 중',
    files: '파일 관리 중',
    settings: '서버 설정 확인 중',
    backups: '백업 관리 중',
    startup: '시작 설정 확인 중',
    schedules: '스케줄 관리 중',
    users: '사용자 관리 중',
    plugins: '플러그인 관리 중',
    network: '네트워크 설정 확인 중',
    other: '서버 관리 중'
  },
  largeImageKey: '',
  largeImageText: 'weirdhost',
  autoUpdate: true,
  bridgePort: 32145,
  staleAfterMs: 15000,
  settingsSchemaVersion: 2
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

      // v0.1.3 기본 Discord 표시 형식으로 1회 마이그레이션합니다.
      // 사용자가 직접 바꾼 템플릿은 건드리지 않습니다.
      if (Number(parsed.settingsSchemaVersion || 1) < 2) {
        if (!parsed.detailsTemplate || parsed.detailsTemplate === '{server}') {
          merged.detailsTemplate = '서버 이름 : {server} 에서';
        }
        if (!parsed.stateTemplate || parsed.stateTemplate === '{section}') {
          merged.stateTemplate = '{section}';
        }
        if (!parsed.largeImageText || parsed.largeImageText === 'WeirdHost') {
          merged.largeImageText = 'weirdhost';
        }
        merged.activityType = 3;
        merged.settingsSchemaVersion = 2;
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
