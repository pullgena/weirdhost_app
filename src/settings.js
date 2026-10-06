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

  // Discord 카드의 큰 이미지는 Developer Portal의 애플리케이션 아이콘을 기본으로 사용합니다.
  largeImageKey: '',
  largeImageText: 'weirdhost',
  autoUpdate: true,
  bridgePort: 32145,
  staleAfterMs: 15000,
  settingsSchemaVersion: 7
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

      // v0.1.6 Discord 카드 브랜딩 구성을 마이그레이션합니다.
      // 사용자가 직접 바꾼 템플릿은 건드리지 않습니다.
      if (Number(parsed.settingsSchemaVersion || 1) < 5) {
        if (
          !parsed.detailsTemplate ||
          parsed.detailsTemplate === '{server}' ||
          parsed.detailsTemplate === '서버 이름 : {server} 에서'
        ) {
          merged.detailsTemplate = '{server}';
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
        // 이전 버전에서 잘못된/없는 Rich Presence asset key를 사용해 ? 아이콘이 뜨는 일을 막고,
        // Discord 애플리케이션 아이콘을 기본 큰 이미지로 사용합니다.
        merged.largeImageKey = '';
        merged.largeImageText = 'weirdhost';
        merged.activityType = Number(parsed.activityType ?? 3);
        merged.settingsSchemaVersion = 5;
      }

      // v0.1.8: WeirdHost 탭이 열려 있지만 현재 보고 있지 않을 때 사용할 상태입니다.
      if (Number(parsed.settingsSchemaVersion || 1) < 6) {
        if (!parsed.sectionLabels?.ready) merged.sectionLabels.ready = '준비중';
        merged.settingsSchemaVersion = 6;
      }

      // v0.1.10: 서버 선택/콘솔은 정확히 `WeirdHost`로 표시합니다.
      // 이전 기본 fallback만 자동 교체하고, 사용자가 직접 만든 문구는 유지합니다.
      if (Number(parsed.settingsSchemaVersion || 1) < 7) {
        if (!parsed.fallbackServerText || parsed.fallbackServerText === 'weirdhost 서버' || parsed.fallbackServerText === 'WeirdHost 서버') {
          merged.fallbackServerText = 'WeirdHost';
        }
        if (!parsed.sectionLabels?.home) merged.sectionLabels.home = 'WeirdHost';
        merged.settingsSchemaVersion = 7;
      }

      if (Number(parsed.settingsSchemaVersion || 1) < 7) {
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
