import { registerAuthHandlers } from './auth'
import { registerCoursesHandlers } from './courses'
import { registerDownloadHandlers } from './download'
import { registerTranscribeHandlers } from './transcribe'
import { registerSettingsHandlers } from './settings'

export function registerAllIpcHandlers(): void {
  registerAuthHandlers()
  registerCoursesHandlers()
  registerDownloadHandlers()
  registerTranscribeHandlers()
  registerSettingsHandlers()
}
