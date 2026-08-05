import type { Platform } from '@ideamap/platform'
import { webStorageAdapter } from './storage.web'
import { webFileAdapter } from './file.web'
import { webSecretAdapter } from './secret.web'
import { webHttpAdapter } from './http.web'
import { webSystemAdapter } from './system.web'

export const webPlatform: Platform = {
  storage: webStorageAdapter,
  file: webFileAdapter,
  secret: webSecretAdapter,
  http: webHttpAdapter,
  system: webSystemAdapter,
}

export { setDriveAccessToken } from './file.web'
