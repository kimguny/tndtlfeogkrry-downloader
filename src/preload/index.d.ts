import { ElectronAPI } from '@electron-toolkit/preload'

interface VideoItem {
  title: string
  contentId: string
  duration: number
  fileSize: number
  thumbnailUrl: string
  weekPosition: number
}

interface CourseItem {
  id: string
  name: string
  term: string
}

interface DownloadApi {
  openLogin: () => Promise<{ success: boolean }>
  fetchCourses: () => Promise<{
    success: boolean
    error?: string
    courses?: CourseItem[]
  }>
  fetchModules: (courseId: string) => Promise<{
    success: boolean
    error?: string
    videos?: VideoItem[]
  }>
  downloadVideo: (
    contentId: string,
    title: string,
    format?: 'mp4' | 'mp3'
  ) => Promise<{ success: boolean; error?: string; filePath?: string }>
  downloadAll: (
    videos: { contentId: string; title: string }[],
    format?: 'mp4' | 'mp3'
  ) => Promise<{
    success: boolean
    error?: string
    results?: { title: string; success: boolean; error?: string }[]
    successCount?: number
    total?: number
  }>
  onDownloadProgress: (
    callback: (data: {
      contentId: string
      downloaded: number
      total: number
      percent: number
    }) => void
  ) => void
  removeDownloadProgress: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DownloadApi
  }
}
