import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  openLogin: (): Promise<{ success: boolean }> => ipcRenderer.invoke('open-login'),

  fetchCourses: (): Promise<{
    success: boolean
    error?: string
    courses?: { id: string; name: string; term: string }[]
  }> => ipcRenderer.invoke('fetch-courses'),

  fetchModules: (
    courseId: string
  ): Promise<{
    success: boolean
    error?: string
    videos?: {
      title: string
      contentId: string
      duration: number
      fileSize: number
      thumbnailUrl: string
      weekPosition: number
    }[]
  }> => ipcRenderer.invoke('fetch-modules', courseId),

  downloadVideo: (
    contentId: string,
    title: string,
    format?: 'mp4' | 'mp3'
  ): Promise<{ success: boolean; error?: string; filePath?: string }> =>
    ipcRenderer.invoke('download-video', contentId, title, format || 'mp4'),

  downloadAll: (
    videos: { contentId: string; title: string }[],
    format?: 'mp4' | 'mp3'
  ): Promise<{
    success: boolean
    error?: string
    results?: { title: string; success: boolean; error?: string }[]
    successCount?: number
    total?: number
  }> => ipcRenderer.invoke('download-all', videos, format || 'mp4'),

  onDownloadProgress: (
    callback: (data: {
      contentId: string
      downloaded: number
      total: number
      percent: number
    }) => void
  ): void => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data))
  },

  removeDownloadProgress: (): void => {
    ipcRenderer.removeAllListeners('download-progress')
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
