import type { MapFile } from '../types'

const CURRENT_MAP_KEY = 'ideamap-current-map'
const DRIVE_FILE_ID_KEY = 'ideamap-drive-fileid'

export function saveMapLocally(data: MapFile): void {
  try {
    localStorage.setItem(CURRENT_MAP_KEY, JSON.stringify(data))
  } catch {}
}

export function loadMapLocally(): MapFile | null {
  try {
    const raw = localStorage.getItem(CURRENT_MAP_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as MapFile
    // 壊れたデータや旧フォーマットを「再開」候補に出さないための最低限の検証
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null
    return data
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

// ---- 最近開いたマップ履歴 ----

const RECENT_MAPS_KEY = 'ideamap-recent-maps'
const RECENT_MAPS_MAX = 5

export interface RecentMap {
  fileId: string
  title: string
  updatedAt: string
}

export function saveRecentMap(map: RecentMap): void {
  try {
    const existing = loadRecentMaps()
    const filtered = existing.filter((m) => m.fileId !== map.fileId)
    const updated = [map, ...filtered].slice(0, RECENT_MAPS_MAX)
    localStorage.setItem(RECENT_MAPS_KEY, JSON.stringify(updated))
  } catch {}
}

export function loadRecentMaps(): RecentMap[] {
  try {
    const raw = localStorage.getItem(RECENT_MAPS_KEY)
    return raw ? (JSON.parse(raw) as RecentMap[]) : []
  } catch {
    return []
  }
}
