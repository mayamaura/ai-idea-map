const CURRENT_MAP_KEY = 'ideamap-current-map'
const DRIVE_FILE_ID_KEY = 'ideamap-drive-fileid'

export function saveMapLocally(data: unknown): void {
  try {
    localStorage.setItem(CURRENT_MAP_KEY, JSON.stringify(data))
  } catch {}
}

export function loadMapLocally(): unknown | null {
  try {
    const raw = localStorage.getItem(CURRENT_MAP_KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

export function saveDriveFileId(fileId: string | null): void {
  try {
    if (fileId) {
      localStorage.setItem(DRIVE_FILE_ID_KEY, fileId)
    } else {
      localStorage.removeItem(DRIVE_FILE_ID_KEY)
    }
  } catch {}
}

export function loadDriveFileId(): string | null {
  try {
    return localStorage.getItem(DRIVE_FILE_ID_KEY)
  } catch {
    return null
  }
}
