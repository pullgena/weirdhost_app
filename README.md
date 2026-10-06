# weirdhost Presence

WeirdHost 웹 패널에서 현재 보고 있는 서버와 메뉴를 Discord Rich Presence로 표시하는 Windows 앱 + Chrome/Edge/Brave 확장프로그램입니다.

## 주요 기능

- Discord 기본 활동 유형: **시청 중 (Watching)**
- 위어드호스트 열린 탭 자동 감지
- 탭이 열려 있지만 현재 보고 있지 않으면 `준비중` 표시
- 서버 이름 자동 감지
- 콘솔 / 파일 관리 / 설정 / 백업 / 시작 설정 / 스케줄 / 사용자 / 플러그인 / 네트워크 메뉴 감지
- Discord 표시 문구 템플릿 커스터마이징
- 시스템 트레이 실행
- Windows 로그인 시 자동 시작
- GitHub Releases 기반 자동 업데이트
- 앱 UI에서 시작 / 정지 / 종료 / 업데이트 확인


## v0.1.3 상태 진단 UI

앱 상단의 `현재 상태` 카드가 단순히 `실행 중`만 표시하지 않고 실제 연결 단계를 진단합니다.

- 🟢 정상 작동 중
- 🟡 확장프로그램 연결 대기
- 🟡 WeirdHost 탭 대기
- 🟡 Discord 연결 중
- 🔴 Discord 앱 ID 필요
- 🔴 Discord 연결 오류
- 🔴 로컬 브리지 오류

각 상태 아래에 바로 해결 방법을 표시하며, `다시 확인` 버튼으로 브리지와 Discord 연결을 재시도할 수 있습니다.

## 구조

```text
Chrome/Edge/Brave 확장프로그램
        ↓ 127.0.0.1:32145
WeirdHost Presence Windows 앱
        ↓ Discord IPC
Discord Desktop
```

확장프로그램은 위어드호스트의 활성 탭 정보만 로컬 PC 앱으로 전달합니다. 외부 서버로 브라우징 정보를 전송하지 않습니다.

## 1. Discord Application 만들기

Discord Developer Portal에서 새 Application을 만들고 원하는 표시 이름(예: `WeirdHost`)을 지정합니다.

1. Developer Portal에서 Application 생성
2. General Information에서 **Application ID** 복사
3. WeirdHost Presence 앱의 `Discord Application ID` 칸에 붙여넣기
4. Rich Presence 이미지를 쓸 경우 Developer Portal에 에셋을 등록하고 앱 설정에 이미지 키 입력

> Discord의 `시청 중 WeirdHost`에서 `WeirdHost` 부분은 Discord Application 이름입니다. 앱의 세부 문구와 현재 서버/메뉴는 WeirdHost Presence에서 바꿀 수 있습니다.

## 2. 개발 실행

```bash
npm install
npm start
```

## 3. Chrome 확장프로그램 설치

1. `chrome://extensions` 열기
2. 오른쪽 위 `개발자 모드` 켜기
3. WeirdHost Presence 앱에서 **확장프로그램 폴더 열기** 클릭
4. `압축해제된 확장 프로그램을 로드합니다` 클릭 후 열린 `extension` 폴더 선택

Edge는 `edge://extensions`에서 같은 방식으로 설치할 수 있습니다.

## 4. Windows 설치 파일 만들기

```bash
npm install
npm run dist
```

`dist/` 폴더에 NSIS 설치 파일이 생성됩니다.

## 업데이트 배포

`package.json`의 버전을 올린 뒤 태그를 푸시합니다.

```bash
git add .
git commit -m "Release v0.2.0"
git tag v0.2.0
git push origin main --tags
```

GitHub Actions가 자동으로 Windows 설치 파일과 `latest.yml`, 확장프로그램 ZIP을 GitHub Release에 올립니다. 설치된 Windows 앱은 GitHub Release에서 새 버전을 확인하고 자동으로 내려받습니다. 확장프로그램 소스도 앱 설치본의 `resources/extension`에 포함되어 앱 업데이트 때 함께 교체됩니다. Chrome/Edge/Brave에서 unpacked 확장프로그램을 쓰는 경우 브라우저 재시작 또는 확장프로그램 새로고침이 필요할 수 있습니다.

## 표시 템플릿

앱에서 다음 변수를 사용할 수 있습니다.

- `{server}`: 감지된 서버 이름
- `{section}`: 현재 메뉴의 사용자 지정 문구
- `{host}`: 현재 위어드호스트 호스트명
- `{title}`: 브라우저 페이지 제목

예시:

```text
첫 번째 줄: {server}
두 번째 줄: {section}
```

Discord에는 예를 들어 다음과 같이 표시됩니다.

```text
시청 중 WeirdHost
내 마인크래프트 서버
콘솔 확인 중
```

## 지원 사이트

- `weirdhost.xyz`
- `*.weirdhost.xyz` (예: 무료 서버 패널 / PLUS 패널)

## 보안 메모

로컬 브리지 서버는 `127.0.0.1`에만 바인딩되고, Chrome/Edge/Brave 확장프로그램 출처와 전용 요청 헤더를 확인합니다. 인터넷에 포트를 열지 않습니다.

## 라이선스

MIT


## 기본 Discord 표시 형식

Discord Developer Portal의 애플리케이션 이름은 `weirdhost`로 설정하세요. 기본 표시 문구는 다음과 같습니다.

```text
weirdhost 시청 중
[서버 이름]
[탭 현황]
```

기본 템플릿은 `{server}` / `{section}`이며 앱의 고급 설정에서 변경할 수 있습니다.


## v0.1.4 WeirdHost 메뉴 URL 감지

현재 메뉴는 화면 글자가 아니라 `hub.weirdhost.xyz/server/<서버코드>/...` URL 경로로 판별합니다.
콘솔은 `/server/<서버코드>/` 루트이며, 파일 관리(`/files`), 데이터베이스(`/databases`), 도메인 관리(`/subdomain`), 일정(`/schedules`), 유저(`/users`), 백업(`/backups`), 네트워크(`/network`), 서버 시작 설정(`/startup`), 위어드호스트 설정(`/settings`), 활동(`/activity`), 서버 설정(`/properties`), 플레이어 관리(`/playermanager`)를 지원합니다.

> v0.1.4부터 탭 감지 로직이 확장프로그램에 포함되므로 기존 사용자는 확장프로그램도 새 `extension` 폴더로 다시 로드해야 합니다.


## v0.1.5 표시 형식 / 아이콘

기본 Discord 표시 형식은 다시 간단하게 변경했습니다.

```text
weirdhost 시청 중
<서버 이름>
<현재 메뉴>
```

활동 종류를 바꾸면 `weirdhost 플레이 중`, `weirdhost 듣는 중`, `weirdhost 경쟁 중`으로 표시됩니다.
Discord에서 `weirdhost`라는 이름은 Discord Developer Portal의 애플리케이션 이름을 사용합니다.

Windows 앱, 트레이, 설치 프로그램, 브라우저 확장프로그램 아이콘은 프로젝트에 포함된 `build/icon.png` / `build/icon.ico`와 동일한 로고를 사용합니다.

Discord 활동 카드의 큰 이미지까지 같은 로고로 표시하려면 Discord Developer Portal의 Rich Presence 자산에 이 이미지를 등록하고, 앱 고급 설정의 `Discord 큰 이미지 키`에 해당 자산 키를 입력해야 합니다.


## v0.1.6 Discord 카드 이름/큰 이미지

Discord 카드의 맨 위 활동 이름은 `weirdhost`를 사용하도록 활동 payload에도 `name: "weirdhost"`를 넣습니다.
현재 사용 중인 로컬 RPC에서 이 필드가 무시되는 Discord 클라이언트에서는 Developer Portal의 애플리케이션 이름이 최종 표시 이름이므로 **General Information → Name을 `weirdhost`로 설정**해야 합니다.

큰 이미지는 별도 Rich Presence asset key를 강제하지 않고 **Discord 애플리케이션 아이콘을 기본 이미지로 사용**합니다.
프로젝트의 `discord-assets/weirdhost.png`가 사용자가 제공한 위어드호스트 로고입니다. Developer Portal의 **General Information → Application Icon**에 이 파일을 업로드하면 Discord 카드의 큰 이미지에도 같은 로고가 기본으로 표시됩니다.

앱의 고급 설정에는 `위어드호스트 아이콘 파일 열기` 버튼과 Developer Portal 바로가기 버튼을 추가했습니다.


## v0.1.7 새로고침 시 서버 이름 안정화

서버 페이지를 새로고침할 때 DOM이 다시 만들어지는 짧은 순간에 페이지 제목이나 로딩 문구가 서버 이름으로 잘못 표시되는 문제를 수정했습니다.

- 서버 고유 코드별로 마지막으로 확인한 정상 서버 이름을 확장프로그램 로컬 저장소에 캐시합니다.
- 새로고침 중 서버 이름을 아직 읽지 못하면 이전 정상 이름을 유지합니다.
- `Loading…`, `로딩 중`, `불러오는 중` 같은 임시 문자열은 서버 이름으로 사용하지 않습니다.
- 다른 서버로 이동하면 서버 고유 코드별 캐시를 사용하므로 서로 다른 서버 이름이 섞이지 않습니다.

> 이 수정은 확장프로그램 감지 로직에 포함되므로 v0.1.7의 `extension` 폴더로 확장프로그램을 다시 로드해야 합니다.
\n\n## v0.1.8 열린 탭 유지 / 준비중 상태\n\nDiscord 활동은 이제 WeirdHost 탭이 브라우저에 **하나라도 열려 있는 동안 계속 유지**됩니다.\n\n- WeirdHost 탭을 현재 보고 있음 → 서버 이름 + 현재 메뉴 표시\n- WeirdHost 탭은 열려 있지만 다른 탭/다른 창을 보고 있음 → `준비중` 표시\n- WeirdHost 탭을 전부 닫음 → Discord 활동 제거\n\n가장 최근에 보고 있던 WeirdHost 서버 이름을 유지하므로 다른 탭으로 이동해도 어떤 서버를 열어 둔 상태인지 이어서 표시할 수 있습니다.\n\n> v0.1.8은 확장프로그램 동작 방식이 변경되므로 Brave/Chrome/Edge의 확장프로그램 페이지에서 한 번 **새로고침**해야 합니다.\n
## v0.1.9 표시 방식

Discord의 작은 활동 표시에서도 활동 종류가 보이도록 Rich Presence의 `name`을 `weirdhost 시청 중`, `weirdhost 플레이 중`, `weirdhost 듣는 중`, `weirdhost 경쟁 중` 형태로 전송합니다. Discord 클라이언트가 애플리케이션 이름을 고정해서 표시하는 경우 Developer Portal의 앱 이름이 우선될 수 있습니다.


## v0.1.12
- 서버 선택 화면으로 돌아오면 이전 서버 정보를 즉시 초기화합니다.
- 서버 콘솔과 서버 선택 화면의 카드 본문은 정확히 `WeirdHost`로만 표시합니다.
- 활동 이름의 브랜드 표기는 기존 규칙대로 소문자 `weirdhost`를 유지합니다.


## v0.1.12 최적화

- 사용하지 않는 `electron-log` 의존성 제거
- 중복 PNG 자산을 하나로 통합
- 사용하지 않는 브리지 `/status` API 제거
- 폐기된 Rich Presence 이미지 설정 키 제거 및 설정 파일 자동 정리
- Electron 로케일을 `ko`, `en-US`만 포함하도록 제한
- Windows 빌드 압축을 `maximum`으로 설정
- 확장프로그램의 불필요한 메모리/스토리지 필드 제거
