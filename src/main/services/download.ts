import { createWriteStream } from 'fs'
import { unlink } from 'fs/promises'
import https from 'https'
import { IPC_EVENT } from '../../shared/channels'
import { DOWNLOAD_TIMEOUT_MS } from '../../shared/config'
import { getLmsSession } from '../window'
import { extractMediaUrl } from './lms'
import { convertToMp3, splitMp3 } from './media'

/**
 * HTTPS로 파일을 다운로드한다. commons.ssu.ac.kr Referer 헤더 필수.
 * @param progressMultiplier 진행률 상한값. MP4=100(전체), MP3=90(이후 변환/분할이 나머지 차지)
 */
export function downloadFile(
  url: string,
  savePath: string,
  contentId: string,
  sender: Electron.WebContents,
  progressMultiplier: number = 100
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          Referer: 'https://commons.ssu.ac.kr/',
          Origin: 'https://commons.ssu.ac.kr'
        }
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // 리다이렉트: 현재 응답을 drain하고 새 URL로 재귀 호출
          res.resume()
          downloadFile(
            res.headers.location,
            savePath,
            contentId,
            sender,
            progressMultiplier
          ).then(resolve)
          return
        }

        if (res.statusCode !== 200) {
          res.resume()
          resolve({ success: false, error: `다운로드 HTTP ${res.statusCode}` })
          return
        }

        const total = Number(res.headers['content-length'] || 0)
        const fileStream = createWriteStream(savePath)
        let received = 0

        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (total > 0) {
            sender.send(IPC_EVENT.DOWNLOAD_PROGRESS, {
              contentId,
              downloaded: received,
              total,
              percent: Math.round((received / total) * progressMultiplier)
            })
          }
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          console.log(`다운로드 완료: ${savePath}, ${received} bytes`)
          resolve({ success: true })
        })

        fileStream.on('error', (err) => {
          resolve({ success: false, error: `파일 쓰기 실패: ${err.message}` })
        })
      }
    )

    req.on('error', (err) => {
      resolve({ success: false, error: `다운로드 실패: ${err.message}` })
    })

    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy()
      resolve({ success: false, error: '다운로드 타임아웃 (5분)' })
    })
  })
}

/**
 * 단일 비디오 다운로드 파이프라인.
 * content.php API → XML 파싱 → 미디어 URL → HTTPS 다운로드
 * MP3 선택 시: 다운로드(0-90%) → MP3 변환(92-95%) → 분할(96-100%)
 */
export async function downloadOne(
  contentId: string,
  filePath: string,
  sender: Electron.WebContents,
  format: 'mp4' | 'mp3' = 'mp4'
): Promise<{ success: boolean; error?: string; filePath?: string }> {
  try {
    // content.php: 영상 메타데이터 XML 반환. _= 캐시 방지 타임스탬프
    const contentApiUrl = `https://commons.ssu.ac.kr/viewer/ssplayer/uniplayer_support/content.php?content_id=${contentId}&_=${Date.now()}`
    // LMS 세션으로 호출해야 인증 쿠키가 자동 포함됨
    const lmsSession = getLmsSession()
    const response = await lmsSession.fetch(contentApiUrl, {
      headers: {
        Referer: 'https://commons.ssu.ac.kr/',
        Origin: 'https://commons.ssu.ac.kr'
      }
    })

    if (!response.ok) {
      throw new Error(`content.php HTTP ${response.status}`)
    }

    const xml = await response.text()
    console.log('content.php XML 원본:', xml)
    const mediaUrl = extractMediaUrl(xml)

    console.log('content.php 결과 - mediaUrl:', mediaUrl)

    if (!mediaUrl) {
      const m = xml.match(/<content_type>([^<]+)<\/content_type>/)
      throw new Error(`다운로드할 수 없는 콘텐츠 형식입니다 (${m?.[1] || '알 수 없음'})`)
    }

    console.log('비디오 URL:', mediaUrl)

    // MP3: 먼저 임시 MP4로 다운로드 → FFmpeg 변환 → 임시 파일 삭제
    const actualSavePath = format === 'mp3' ? filePath.replace(/\.mp3$/, '.tmp.mp4') : filePath
    // MP3는 다운로드가 진행률의 90%만 차지 (나머지 10%는 변환+분할)
    const progressMultiplier = format === 'mp3' ? 90 : 100

    const dlResult = await downloadFile(
      mediaUrl,
      actualSavePath,
      contentId,
      sender,
      progressMultiplier
    )

    if (!dlResult.success) {
      console.error(`다운로드 실패 [${contentId}]:`, dlResult.error)
      return dlResult
    }

    if (format === 'mp3') {
      try {
        sender.send(IPC_EVENT.DOWNLOAD_PROGRESS, {
          contentId,
          downloaded: 0,
          total: 0,
          percent: 92,
          status: 'converting'
        })
        await convertToMp3(actualSavePath, filePath)
        await unlink(actualSavePath)
        sender.send(IPC_EVENT.DOWNLOAD_PROGRESS, {
          contentId,
          downloaded: 0,
          total: 0,
          percent: 95,
          status: 'converting'
        })

        const parts = await splitMp3(filePath, contentId, sender)
        const wasSplit = parts.length > 1

        sender.send(IPC_EVENT.DOWNLOAD_PROGRESS, {
          contentId,
          downloaded: 0,
          total: 0,
          percent: 100,
          status: wasSplit ? 'split-done' : 'done',
          splitTotal: wasSplit ? parts.length : undefined
        })
        return { success: true, filePath }
      } catch (err) {
        await unlink(actualSavePath).catch(() => {})
        return { success: false, error: `MP3 변환/분할 실패: ${(err as Error).message}` }
      }
    }

    return { success: true, filePath }
  } catch (err) {
    console.error(`downloadOne 에러 [${contentId}]:`, (err as Error).message)
    return { success: false, error: (err as Error).message }
  }
}
