# 숭실 LMS 비디오 다운로더

숭실대학교 LMS의 강의 영상을 다운로드할 수 있는 데스크톱 앱입니다.

## 기능

- 개별 영상 다운로드 (MP4 / MP3)
- 전체 영상 일괄 다운로드

## 다운로드

[Releases](https://github.com/daunload/tndtlfeogkrry-downloader/releases) 페이지에서 최신 버전을 다운로드하세요.

| OS      | 파일         |
| ------- | ------------ |
| macOS   | `.dmg`       |
| Windows | `-setup.exe` |

## macOS 설치 가이드

macOS에서는 앱을 처음 실행할 때 **"손상되었기 때문에 열 수 없습니다"** 경고가 나타날 수 있습니다.
이는 Apple 개발자 인증서로 서명되지 않은 앱에 대해 macOS가 표시하는 보안 경고입니다.

아래 명령어를 터미널에서 실행한 후 앱을 다시 열어주세요:

```bash
xattr -cr /Applications/soongsil-lms-downloader.app
```

## 개발

```bash
# 의존성 설치
pnpm install

# 개발 모드 실행
pnpm dev

# 빌드
pnpm build:mac    # macOS
pnpm build:win    # Windows
```

## 기술 스택

- Electron
- Vue 3 + TypeScript
- electron-vite
