import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({ ignoreAttributes: true });

/**
 * commons.ssu.ac.kr의 content.php XML 응답에서 영상 다운로드 URL을 추출한다.
 *
 * 콘텐츠 유형(everlec, movie, video 등)에 따라 XML 구조가 달라서
 * 4가지 전략을 우선순위대로 시도한다:
 *   1. [MEDIA_FILE] 템플릿 치환
 *   2. 직접 .mp4 URL
 *   3. desktop.html5 경로 (video1 등 구형 콘텐츠)
 *   4. content_uri 기반 fallback 조합
 */
export function extractMediaUrl(xml: string): string | null {
  const parsed = xmlParser.parse(xml);
  const content = parsed?.content;
  if (!content) return null;

  const playingInfo = content.content_playing_info;
  if (!playingInfo) return null;

  // 파일명: story_list 내부 또는 playingInfo 직접 참조 (콘텐츠 타입에 따라 위치가 다름)
  const story = playingInfo.story_list?.story;
  const fileName: string | undefined =
    story?.main_media_list?.main_media || playingInfo.main_media_list?.main_media;

  // media_uri: 3곳 중 하나에 존재 (우선순위 순)
  const mediaUriRaw =
    content.service_root?.media?.media_uri || playingInfo.media_uri || content.media_uri;

  // 전략 1: "[MEDIA_FILE]" 플레이스홀더를 실제 파일명으로 치환
  if (fileName && mediaUriRaw) {
    const template = Array.isArray(mediaUriRaw) ? mediaUriRaw[0] : mediaUriRaw;
    if (typeof template === 'string' && template.includes('[MEDIA_FILE]')) {
      return template.replace('[MEDIA_FILE]', fileName);
    }
  }

  // 전략 2: media_uri가 이미 완전한 .mp4 URL인 경우 (치환 불필요)
  if (mediaUriRaw) {
    if (
      typeof mediaUriRaw === 'string' &&
      mediaUriRaw.includes('.mp4') &&
      !mediaUriRaw.includes('[')
    ) {
      return mediaUriRaw;
    }
    // media_uri가 배열로 올 수 있음 (복수 해상도 등)
    if (Array.isArray(mediaUriRaw)) {
      const valid = mediaUriRaw.find((u: string) => u && u.includes('.mp4') && !u.includes('['));
      if (valid) return valid;
    }
  }

  // 전략 3: video1 등 구형 콘텐츠의 desktop HTML5 플레이어 경로
  const desktopUri = playingInfo.main_media?.desktop?.html5?.media_uri;
  if (desktopUri && typeof desktopUri === 'string' && desktopUri.includes('.mp4')) {
    return desktopUri;
  }

  // 전략 4: content_uri (web_files → media_files)에 파일명을 붙여 URL 조합
  if (fileName) {
    const contentUri = playingInfo.content_uri;
    if (contentUri) {
      const base = String(contentUri).replace(/web_files$/, 'media_files');
      return base + '/' + fileName;
    }
  }

  return null;
}
