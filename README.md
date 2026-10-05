# WeirdHost Presence

WeirdHost 웹 패널에서 현재 보고 있는 서버와 메뉴를 Discord Rich Presence로 표시하는 Windows 앱 + Chrome/Edge/Brave 확장프로그램입니다.

## 주요 기능

- Discord 기본 활동 유형: **시청 중 (Watching)**
- 위어드호스트 활성 탭 자동 감지
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
서버 이름 : [서버 이름] 에서
[탭 현황]
```

기본 템플릿은 `서버 이름 : {server} 에서` / `{section}`이며 앱의 고급 설정에서 변경할 수 있습니다.
