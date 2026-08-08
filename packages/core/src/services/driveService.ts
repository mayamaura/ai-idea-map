import { v4 as uuidv4 } from 'uuid'
import { getPlatform } from '@ideamap/platform'
import type { AppSettingsPayload } from '../stores/settingsStore'

/**
 * Google Drive REST API の薄いラッパー。Web版・デスクトップ版の両方から使う。
 *
 * Phase 38 で apps/web から移設した。core に置く以上 `fetch` を直接呼べないため
 * 通信は `HttpAdapter.request` 経由にしてある（デスクトップ版では Rust 側の
 * plugin-http が発行するので CORS の制約を受けない）。
 *
 * アップロードは `FormData`/`Blob` ではなく `multipart/related` を文字列で手組みする。
 * Tauri の plugin-http へ `FormData` を渡したときの挙動が未検証なのに対し、
 * 文字列ボディは Web版・デスクトップ版のどちらでも同じ経路で確実に通るため。
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'IdeaMap'
const MIME_JSON = 'application/json'
const MIME_FOLDER = 'application/vnd.google-apps.folder'
const SETTINGS_FILE_NAME = 'settings.json'

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
}

let folderIdCache: string | null = null
let settingsFileIdCache: string | null = null

/**
 * プロセス内メモリキャッシュを破棄する。アクセストークンが変わったとき
 * （サインアウト・アカウント切替）に呼ぶ。
 * settings.json の fileId も同じ Drive アカウントに紐づくので一緒に消す。
 */
export function clearDriveCache(): void {
  folderIdCache = null
  settingsFileIdCache = null
}

async function driveRequest(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  // getPlatform() はモジュール評価時ではなく呼び出し時に取る（setPlatform より先に走らせない）
  const res = await getPlatform().http.request(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drive API ${res.status}: ${body}`)
  }
  return res
}

/**
 * `uploadType=multipart` のボディを組み立てる。
 * メタデータと本文の2パートを CRLF 区切りで並べる MIME 形式で、
 * Google Drive API のドキュメントが示すリクエスト例と同じ並びにしている。
 */
function buildMultipartBody(boundary: string, metadata: unknown, content: string): string {
  return (
    `--${boundary}\r\n` +
    `Content-Type: ${MIME_JSON}; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${MIME_JSON}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  )
}

async function uploadMultipart(
  url: string,
  token: string,
  method: 'POST' | 'PATCH',
  metadata: unknown,
  content: string
): Promise<Response> {
  // 境界文字列はリクエストごとに作る。固定値だと、たまたま同じ文字列を含むマップを
  // 保存したときにボディが壊れる（FormData は同じ理由で毎回ランダムな境界を使う）
  const boundary = `ideamap-${uuidv4()}`
  return driveRequest(url, token, {
    method,
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: buildMultipartBody(boundary, metadata, content),
  })
}

async function getOrCreateFolder(token: string): Promise<string> {
  if (folderIdCache) return folderIdCache

  const escaped = FOLDER_NAME.replace(/'/g, "\\'")
  const res = await driveRequest(
    `${DRIVE_API}/files?q=name='${escaped}' and mimeType='${MIME_FOLDER}' and trashed=false&fields=files(id)&spaces=drive`,
    token
  )
  const data = (await res.json()) as { files: { id: string }[] }

  if (data.files.length > 0) {
    folderIdCache = data.files[0].id
    return folderIdCache
  }

  const createRes = await driveRequest(`${DRIVE_API}/files`, token, {
    method: 'POST',
    headers: { 'Content-Type': MIME_JSON },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: MIME_FOLDER }),
  })
  const folder = (await createRes.json()) as { id: string }
  folderIdCache = folder.id
  return folderIdCache
}

export async function listMaps(token: string): Promise<DriveFile[]> {
  const folderId = await getOrCreateFolder(token)
  const res = await driveRequest(
    `${DRIVE_API}/files?q='${folderId}' in parents and mimeType='${MIME_JSON}' and name != '${SETTINGS_FILE_NAME}' and trashed=false&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
    token
  )
  const data = (await res.json()) as { files: DriveFile[] }
  return data.files ?? []
}

async function findMapFileId(
  token: string,
  fileName: string,
  mapId: string | null | undefined,
  folderId: string
): Promise<string | null> {
  if (mapId) {
    const res = await driveRequest(
      `${DRIVE_API}/files?q=appProperties has { key='mapId' and value='${mapId}' } and trashed=false&fields=files(id)&spaces=drive`,
      token
    )
    const data = (await res.json()) as { files: { id: string }[] }
    if (data.files.length > 0) return data.files[0].id
  }

  const escaped = fileName.replace(/'/g, "\\'")
  const res = await driveRequest(
    `${DRIVE_API}/files?q='${folderId}' in parents and name='${escaped}' and trashed=false&fields=files(id)&spaces=drive`,
    token
  )
  const data = (await res.json()) as { files: { id: string }[] }
  return data.files.length > 0 ? data.files[0].id : null
}

export async function saveMap(
  token: string,
  title: string,
  content: unknown,
  fileId?: string | null,
  mapId?: string | null
): Promise<string> {
  const fileName = `${title}.json`
  const body = JSON.stringify(content, null, 2)
  // appProperties に mapId を保存することで、ファイル内容をダウンロードせず衝突チェックが可能
  const appProperties = mapId ? { mapId } : undefined

  if (fileId) {
    await uploadMultipart(
      `${UPLOAD_API}/files/${fileId}?uploadType=multipart`,
      token,
      'PATCH',
      { name: fileName, appProperties },
      body
    )
    return fileId
  }

  const folderId = await getOrCreateFolder(token)
  const existingId = await findMapFileId(token, fileName, mapId, folderId)
  if (existingId) {
    await uploadMultipart(
      `${UPLOAD_API}/files/${existingId}?uploadType=multipart`,
      token,
      'PATCH',
      { name: fileName, appProperties },
      body
    )
    return existingId
  }

  const res = await uploadMultipart(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    token,
    'POST',
    { name: fileName, mimeType: MIME_JSON, parents: [folderId], appProperties },
    body
  )
  const data = (await res.json()) as { id: string }
  return data.id
}

/** Drive ファイルの appProperties.mapId を取得する（衝突チェック用軽量メタデータ照合）*/
export async function fetchMapAppProperties(
  token: string,
  fileId: string
): Promise<{ mapId: string | null }> {
  const res = await driveRequest(
    `${DRIVE_API}/files/${fileId}?fields=appProperties`,
    token
  )
  const data = (await res.json()) as { appProperties?: { mapId?: string } }
  return { mapId: data.appProperties?.mapId ?? null }
}

export async function loadMap(token: string, fileId: string): Promise<unknown> {
  const res = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`, token)
  return res.json()
}

export async function deleteMap(token: string, fileId: string): Promise<void> {
  await driveRequest(`${DRIVE_API}/files/${fileId}`, token, { method: 'DELETE' })
}

// ---- アプリ設定（settings.json）の読み書き ----

async function findSettingsFileId(token: string): Promise<string | null> {
  if (settingsFileIdCache) return settingsFileIdCache
  const folderId = await getOrCreateFolder(token)
  const res = await driveRequest(
    `${DRIVE_API}/files?q='${folderId}' in parents and name='${SETTINGS_FILE_NAME}' and trashed=false&fields=files(id)`,
    token
  )
  const data = (await res.json()) as { files: { id: string }[] }
  if (data.files.length > 0) {
    settingsFileIdCache = data.files[0].id
    return settingsFileIdCache
  }
  return null
}

export async function saveAppSettings(
  token: string,
  settings: AppSettingsPayload
): Promise<void> {
  const body = JSON.stringify(settings, null, 2)
  const existingId = await findSettingsFileId(token)

  if (existingId) {
    await uploadMultipart(
      `${UPLOAD_API}/files/${existingId}?uploadType=multipart`,
      token,
      'PATCH',
      { name: SETTINGS_FILE_NAME },
      body
    )
  } else {
    const folderId = await getOrCreateFolder(token)
    const res = await uploadMultipart(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
      token,
      'POST',
      { name: SETTINGS_FILE_NAME, mimeType: MIME_JSON, parents: [folderId] },
      body
    )
    const data = (await res.json()) as { id: string }
    settingsFileIdCache = data.id
  }
}

export async function loadAppSettings(token: string): Promise<AppSettingsPayload | null> {
  const fileId = await findSettingsFileId(token)
  if (!fileId) return null
  const res = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`, token)
  return res.json() as Promise<AppSettingsPayload>
}
