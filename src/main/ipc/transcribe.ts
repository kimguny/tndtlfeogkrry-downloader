import { basename, dirname, extname, join } from 'path'
import { BrowserWindow, ipcMain, dialog } from 'electron'
import { readdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { IPC } from '../../shared/channels'
import { IPC_EVENT } from '../../shared/channels'
import { MAX_CONCURRENT_DOWNLOADS, MAX_CONCURRENT_TRANSCRIPTIONS } from '../../shared/config'
import { loadGeminiApiKey } from '../services/gemini'
import { transcribeWithRetry, groupMp3Files } from '../services/gemini'
import { downloadOne } from '../services/download'

export function registerTranscribeHandlers(): void {
  ipcMain.handle(IPC.TRANSCRIBE_AUDIO, async (event, filePath: string) => {
    const apiKey = loadGeminiApiKey()
    if (!apiKey) {
      return { success: false, error: 'Gemini API 키가 설정되지 않았습니다.' }
    }

    try {
      const dir = dirname(filePath)
      const name = basename(filePath, extname(filePath))

      // "_partN" 접미사에서 원본 이름 추출 (splitMp3()가 생성한 파일명 패턴)
      const partMatch = name.match(/^(.+)_part\d+$/)
      const baseName = partMatch ? partMatch[1] : name

      // 같은 원본의 분할 파일을 모두 찾아 순서대로 변환 (part1 선택해도 part2,3 자동 포함)
      const allFiles = readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort()
      const partFiles = allFiles
        .filter((f) => f.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_part\\d+\\.mp3$`)))
        .map((f) => join(dir, f))

      const filesToTranscribe = partFiles.length > 0 ? partFiles : [filePath]
      const totalParts = filesToTranscribe.length
      const texts: string[] = []

      for (let i = 0; i < filesToTranscribe.length; i++) {
        event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
          fileName: basename(filePath),
          percent: Math.round((i / totalParts) * 90),
          status: 'transcribing',
          currentPart: i + 1,
          totalParts
        })

        const text = await transcribeWithRetry(filesToTranscribe[i], apiKey)
        texts.push(text)
      }

      event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
        fileName: basename(filePath),
        percent: 95,
        status: 'merging'
      })

      const mergedText = texts.join('\n\n')
      const txtPath = join(dir, `${baseName}.txt`)
      writeFileSync(txtPath, mergedText, 'utf-8')

      event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
        fileName: basename(filePath),
        percent: 100,
        status: 'done'
      })

      return { success: true, text: mergedText, txtPath }
    } catch (err) {
      const message = (err as Error).message
      event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
        fileName: basename(filePath),
        percent: 0,
        status: 'error'
      })

      if (message.includes('401') || message.includes('403')) {
        return { success: false, error: 'API 키가 유효하지 않습니다. 설정에서 다시 입력해주세요.' }
      }
      return { success: false, error: message }
    }
  })

  ipcMain.handle(IPC.TRANSCRIBE_BATCH, async (event, dirPath: string) => {
    const apiKey = loadGeminiApiKey()
    if (!apiKey) {
      return { success: false, error: 'Gemini API 키가 설정되지 않았습니다.' }
    }

    const key = apiKey // TS narrowing: 클로저 안에서 null이 아님을 보장하기 위한 재할당
    const groups = groupMp3Files(dirPath)
    const groupEntries = Array.from(groups.entries())
    const total = groupEntries.length
    const results: { fileName: string; success: boolean; error?: string }[] = []

    let nextIndex = 0
    async function worker(): Promise<void> {
      while (nextIndex < groupEntries.length) {
        const i = nextIndex++
        const [baseName, files] = groupEntries[i]
        const texts: string[] = []

        try {
          for (let j = 0; j < files.length; j++) {
            event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
              fileName: `${baseName}.mp3`,
              percent: Math.round((j / files.length) * 90),
              status: 'transcribing',
              currentPart: j + 1,
              totalParts: files.length,
              currentFile: i + 1,
              totalFiles: total
            })

            const text = await transcribeWithRetry(files[j], key)
            texts.push(text)
          }

          const mergedText = texts.join('\n\n')
          const txtPath = join(dirPath, `${baseName}.txt`)
          writeFileSync(txtPath, mergedText, 'utf-8')

          event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
            fileName: `${baseName}.mp3`,
            percent: 100,
            status: 'done',
            currentFile: i + 1,
            totalFiles: total
          })

          results.push({ fileName: baseName, success: true })
        } catch (err) {
          event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
            fileName: `${baseName}.mp3`,
            percent: 0,
            status: 'error',
            currentFile: i + 1,
            totalFiles: total
          })
          results.push({ fileName: baseName, success: false, error: (err as Error).message })
        }
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT_TRANSCRIPTIONS, groupEntries.length) }, () => worker())
    await Promise.all(workers)

    const successCount = results.filter((r) => r.success).length
    return { success: true, results, successCount, total }
  })

  ipcMain.handle(
    IPC.DOWNLOAD_AND_TRANSCRIBE_ALL,
    async (event, videos: { contentId: string; title: string }[]) => {
      const apiKey = loadGeminiApiKey()
      if (!apiKey) {
        return { success: false, error: 'Gemini API 키가 설정되지 않았습니다.' }
      }

      const mainWin = BrowserWindow.fromWebContents(event.sender)
      if (!mainWin) return { success: false, error: 'No window found' }

      const folderResult = await dialog.showOpenDialog(mainWin, {
        properties: ['openDirectory', 'createDirectory'],
        title: '다운로드 및 변환 폴더 선택'
      })

      if (folderResult.canceled || !folderResult.filePaths[0]) {
        return { success: false, error: 'cancelled' }
      }

      const folder = folderResult.filePaths[0]
      const key = apiKey // TS narrowing: 클로저 안에서 null이 아님을 보장

      // === 2단계 파이프라인 ===
      // 1단계: 전체 MP3 다운로드 (최대 MAX_CONCURRENT_DOWNLOADS개 병렬)
      const downloadResults: { title: string; success: boolean; error?: string }[] = new Array(
        videos.length
      )

      let nextDownloadIndex = 0
      async function downloadWorker(): Promise<void> {
        while (nextDownloadIndex < videos.length) {
          const i = nextDownloadIndex++
          const video = videos[i]
          const safeName = video.title.replace(/[/\\?%*:|"<>]/g, '_')
          const filePath = resolve(folder, `${safeName}.mp3`)
          const result = await downloadOne(video.contentId, filePath, event.sender, 'mp3')
          downloadResults[i] = { title: video.title, success: result.success, error: result.error }
        }
      }

      const downloadWorkers = Array.from(
        { length: Math.min(MAX_CONCURRENT_DOWNLOADS, videos.length) },
        () => downloadWorker()
      )
      await Promise.all(downloadWorkers)

      const downloadSuccessCount = downloadResults.filter((r) => r.success).length
      if (downloadSuccessCount === 0) {
        return { success: false, error: '모든 다운로드가 실패했습니다.' }
      }

      // 2단계: 다운로드된 MP3 파일 텍스트 변환 (최대 MAX_CONCURRENT_TRANSCRIPTIONS개 병렬)
      const groups = groupMp3Files(folder)
      const groupEntries = Array.from(groups.entries())
      const total = groupEntries.length
      const transcribeResults: { fileName: string; success: boolean; error?: string }[] = []

      let nextTranscribeIndex = 0
      async function transcribeWorker(): Promise<void> {
        while (nextTranscribeIndex < groupEntries.length) {
          const i = nextTranscribeIndex++
          const [baseName, files] = groupEntries[i]
          const texts: string[] = []

          try {
            for (let j = 0; j < files.length; j++) {
              event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
                fileName: `${baseName}.mp3`,
                percent: Math.round((j / files.length) * 90),
                status: 'transcribing',
                currentPart: j + 1,
                totalParts: files.length,
                currentFile: i + 1,
                totalFiles: total
              })

              const text = await transcribeWithRetry(files[j], key)
              texts.push(text)
            }

            const mergedText = texts.join('\n\n')
            const txtPath = join(folder, `${baseName}.txt`)
            writeFileSync(txtPath, mergedText, 'utf-8')

            event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
              fileName: `${baseName}.mp3`,
              percent: 100,
              status: 'done',
              currentFile: i + 1,
              totalFiles: total
            })

            transcribeResults.push({ fileName: baseName, success: true })
          } catch (err) {
            event.sender.send(IPC_EVENT.TRANSCRIBE_PROGRESS, {
              fileName: `${baseName}.mp3`,
              percent: 0,
              status: 'error',
              currentFile: i + 1,
              totalFiles: total
            })
            transcribeResults.push({
              fileName: baseName,
              success: false,
              error: (err as Error).message
            })
          }
        }
      }

      const transcribeWorkers = Array.from(
        { length: Math.min(MAX_CONCURRENT_TRANSCRIPTIONS, groupEntries.length) },
        () => transcribeWorker()
      )
      await Promise.all(transcribeWorkers)

      const transcribeSuccessCount = transcribeResults.filter((r) => r.success).length
      return {
        success: true,
        downloadResults,
        downloadSuccessCount,
        transcribeResults,
        transcribeSuccessCount,
        total
      }
    }
  )
}
