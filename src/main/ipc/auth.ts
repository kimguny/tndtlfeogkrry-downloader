import { ipcMain } from 'electron'
import { IPC } from '../../shared/channels'
import { getOrCreateLmsWin } from '../window'

export function registerAuthHandlers(): void {
  // LMS 로그인 창을 열고, 로그인 성공 또는 창 닫힘을 감지하여 결과 반환
  ipcMain.handle(IPC.OPEN_LOGIN, async () => {
    const win = getOrCreateLmsWin()
    win.loadURL('https://canvas.ssu.ac.kr/login')
    win.show()
    win.focus()

    // 두 가지 이벤트(URL 변경 / 창 숨김) 중 먼저 발생하는 것으로 resolve.
    // resolved 플래그로 중복 resolve 방지.
    return new Promise<{ success: boolean }>((resolve) => {
      let resolved = false

      // SSO 인증 후 Canvas가 login_success=1 파라미터로 리다이렉트함
      const onNavigate = (_event: Electron.Event, url: string): void => {
        if (resolved) return
        if (url.includes('canvas.ssu.ac.kr/?login_success=1')) {
          resolved = true
          win.webContents.removeListener('did-navigate', onNavigate)
          win.removeListener('hide', onHide)
          win.hide()
          resolve({ success: true })
        }
      }
      win.webContents.on('did-navigate', onNavigate)

      // 사용자가 창을 수동으로 닫은 경우 → 현재 URL로 로그인 여부 추측
      const onHide = (): void => {
        if (resolved) return
        resolved = true
        win.removeListener('hide', onHide)
        win.webContents.removeListener('did-navigate', onNavigate)
        const currentUrl = win.webContents.getURL()
        // /login 경로가 아니면 로그인 된 것으로 판단
        const loggedIn = currentUrl.includes('canvas.ssu.ac.kr') && !currentUrl.includes('/login')
        resolve({ success: loggedIn })
      }
      win.on('hide', onHide)
    })
  })
}
