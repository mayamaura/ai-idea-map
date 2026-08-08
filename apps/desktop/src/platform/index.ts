import type { Platform } from '@ideamap/platform'
import { desktopStorageAdapter } from './storage.desktop'
import { desktopFileAdapter } from './file.desktop'
import { desktopSecretAdapter } from './secret.desktop'
import { desktopHttpAdapter } from './http.desktop'
import { desktopSystemAdapter } from './system.desktop'

export const desktopPlatform: Platform = {
  storage: desktopStorageAdapter,
  file: desktopFileAdapter,
  secret: desktopSecretAdapter,
  http: desktopHttpAdapter,
  system: desktopSystemAdapter,
}

export { loadLastAutosave, setDriveAccessToken } from './file.desktop'
