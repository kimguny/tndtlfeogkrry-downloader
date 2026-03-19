import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, IPC_EVENT } from '../shared/channels'
import type { CourseItem, VideoItem, VideoRef, DownloadProgressData, TranscribeProgressData } from '../shared/types'

const api = {
  openLogin: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC.OPEN_LOGIN),

  fetchCourses: (): Promise<{
    success: boolean
    error?: string
    courses?: CourseItem[]
  }> => ipcRenderer.invoke(IPC.FETCH_COURSES),

  fetchModules: (
    courseId: string
  ): Promise<{
    success: boolean
    error?: string
    videos?: VideoItem[]
  }> => ipcRenderer.invoke(IPC.FETCH_MODULES, courseId),

  downloadVideo: (
    contentId: string,
    title: string,
    format?: 'mp4' | 'mp3'
  ): Promise<{ success: boolean; error?: string; filePath?: string }> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_VIDEO, contentId, title, format || 'mp4'),

  downloadAll: (
    videos: VideoRef[],
    format?: 'mp4' | 'mp3'
  ): Promise<{
    success: boolean
    error?: string
    results?: { title: string; success: boolean; error?: string }[]
    successCount?: number
    total?: number
  }> => ipcRenderer.invoke(IPC.DOWNLOAD_ALL, videos, format || 'mp4'),

  onDownloadProgress: (callback: (data: DownloadProgressData) => void): void => {
    ipcRenderer.on(IPC_EVENT.DOWNLOAD_PROGRESS, (_event, data) => callback(data))
  },

  removeDownloadProgress: (): void => {
    ipcRenderer.removeAllListeners(IPC_EVENT.DOWNLOAD_PROGRESS)
  },

  // --- Gemini STT ---
  setGeminiApiKey: (key: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.SET_GEMINI_API_KEY, key),

  getGeminiApiKey: (): Promise<{ hasKey: boolean }> => ipcRenderer.invoke(IPC.GET_GEMINI_API_KEY),

  deleteGeminiApiKey: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.DELETE_GEMINI_API_KEY),

  transcribeAudio: (
    filePath: string
  ): Promise<{ success: boolean; text?: string; txtPath?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.TRANSCRIBE_AUDIO, filePath),

  transcribeBatch: (
    dirPath: string
  ): Promise<{
    success: boolean
    error?: string
    results?: { fileName: string; success: boolean; error?: string }[]
    successCount?: number
    total?: number
  }> => ipcRenderer.invoke(IPC.TRANSCRIBE_BATCH, dirPath),

  openFile: (filePath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.OPEN_FILE, filePath),

  selectFolder: (): Promise<{ success: boolean; folderPath?: string }> =>
    ipcRenderer.invoke(IPC.SELECT_FOLDER),

  downloadAndTranscribeAll: (
    videos: VideoRef[]
  ): Promise<{
    success: boolean
    error?: string
    downloadSuccessCount?: number
    transcribeSuccessCount?: number
    total?: number
  }> => ipcRenderer.invoke(IPC.DOWNLOAD_AND_TRANSCRIBE_ALL, videos),

  onTranscribeProgress: (callback: (data: TranscribeProgressData) => void): void => {
    ipcRenderer.on(IPC_EVENT.TRANSCRIBE_PROGRESS, (_event, data) => callback(data))
  },

  removeTranscribeProgress: (): void => {
    ipcRenderer.removeAllListeners(IPC_EVENT.TRANSCRIBE_PROGRESS)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
