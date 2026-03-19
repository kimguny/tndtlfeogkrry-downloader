import { BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { IPC } from '../../shared/channels'
import { saveGeminiApiKey, loadGeminiApiKey, deleteGeminiApiKey } from '../services/gemini'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SET_GEMINI_API_KEY, async (_event, key: string) => {
    try {
      saveGeminiApiKey(key)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.GET_GEMINI_API_KEY, async () => {
    return { hasKey: loadGeminiApiKey() !== null }
  })

  ipcMain.handle(IPC.DELETE_GEMINI_API_KEY, async () => {
    deleteGeminiApiKey()
    return { success: true }
  })

  ipcMain.handle(IPC.OPEN_FILE, async (_event, filePath: string) => {
    shell.openPath(filePath)
    return { success: true }
  })

  ipcMain.handle(IPC.SELECT_DOWNLOAD_FOLDER, async (event) => {
    const mainWin = BrowserWindow.fromWebContents(event.sender)
    if (!mainWin) return { success: false }

    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openDirectory', 'createDirectory'],
      title: '다운로드 폴더 선택'
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false }
    }
    return { success: true, folderPath: result.filePaths[0] }
  })

  ipcMain.handle(IPC.SELECT_FOLDER, async (event) => {
    const mainWin = BrowserWindow.fromWebContents(event.sender)
    if (!mainWin) return { success: false }

    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openDirectory'],
      title: 'MP3 파일이 있는 폴더 선택'
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false }
    }
    return { success: true, folderPath: result.filePaths[0] }
  })
}
