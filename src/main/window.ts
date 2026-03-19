import { BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LMS_SESSION_PARTITION } from '../shared/config'

// LMS 로그인 세션을 유지하는 숨김 BrowserWindow. 닫기 시 파괴하지 않고 hide()만 하여 재사용.
let lmsWin: BrowserWindow | null = null

export function getLmsSession(): Electron.Session {
  return session.fromPartition(LMS_SESSION_PARTITION)
}

export function getOrCreateLmsWin(): BrowserWindow {
  if (lmsWin && !lmsWin.isDestroyed()) {
    return lmsWin
  }
  lmsWin = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    closable: true,
    titleBarStyle: 'default',
    webPreferences: {
      session: getLmsSession()
    }
  })
  // 닫기 버튼 → 숨기기만 (세션 유지를 위해 파괴하지 않음)
  lmsWin.on('close', (e) => {
    if (lmsWin && !lmsWin.isDestroyed()) {
      e.preventDefault()
      lmsWin.hide()
    }
  })
  return lmsWin
}

export function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 외부 링크는 시스템 브라우저로 열고 Electron 내 새 창은 차단
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** 앱 종료(before-quit) 시 호출. close 리스너를 먼저 제거해야 hide()로 빠지지 않고 실제 파괴됨. */
export function destroyLmsWin(): void {
  if (lmsWin && !lmsWin.isDestroyed()) {
    lmsWin.removeAllListeners('close')
    lmsWin.destroy()
    lmsWin = null
  }
}
