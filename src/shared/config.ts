/** Electron session partition for LMS login */
export const LMS_SESSION_PARTITION = 'persist:lms'

/** MP3 파일 분할 임계값 (19MB) */
export const SPLIT_THRESHOLD_BYTES = 19 * 1024 * 1024

/** 동시 다운로드 최대 개수 */
export const MAX_CONCURRENT_DOWNLOADS = 3

/** 동시 텍스트 변환 최대 개수 */
export const MAX_CONCURRENT_TRANSCRIPTIONS = 2

/** Gemini 모델명 */
export const GEMINI_MODEL = 'gemini-2.0-flash'

/** Gemini API 재시도 최대 횟수 */
export const GEMINI_MAX_RETRIES = 3

/** 다운로드 타임아웃 (5분) */
export const DOWNLOAD_TIMEOUT_MS = 300_000

/** macOS 파일시스템 최대 파일명 바이트 수 */
const MAX_FILENAME_BYTES = 255

/**
 * 비디오 제목에서 안전한 파일명을 생성한다.
 * 특수문자 제거 + macOS HFS+의 한글 NFD 변환 시 255바이트 제한 초과를 방지한다.
 * @param reserveBytes 확장자/접미사용 예약 바이트 수 (예: `_part99.mp3` = 12)
 */
export function toSafeFileName(title: string, reserveBytes: number = 12): string {
  let name = title.replace(/[/\\?%*:|"<>]/g, '_')
  const limit = MAX_FILENAME_BYTES - reserveBytes

  // NFD 바이트 길이가 제한 이하가 될 때까지 뒤에서 한 글자씩 제거
  while (nfdByteLength(name) > limit) {
    name = name.slice(0, -1)
  }

  return name
}

function nfdByteLength(str: string): number {
  const nfd = str.normalize('NFD')
  // TextEncoder.encode().length로 UTF-8 바이트 수 계산
  let bytes = 0
  for (let i = 0; i < nfd.length; i++) {
    const code = nfd.charCodeAt(i)
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}

/** GitHub 리포지토리 (업데이트 확인용) */
export const GITHUB_REPO = 'daunload/tndtlfeogkrry-downloader'
