const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'IdeaMap'
const MIME_JSON = 'application/json'
const MIME_FOLDER = 'application/vnd.google-apps.folder'

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
}

let folderIdCache: string | null = null

export function clearDriveCache(): void {
  folderIdCache = null
}

async function driveRequest(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
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
    `${DRIVE_API}/files?q='${folderId}' in parents and mimeType='${MIME_JSON}' and trashed=false&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
    token
  )
  const data = (await res.json()) as { files: DriveFile[] }
  return data.files ?? []
}

export async function saveMap(
  token: string,
  title: string,
  content: unknown,
  fileId?: string | null
): Promise<string> {
  const fileName = `${title}.json`
  const fileBlob = new Blob([JSON.stringify(content, null, 2)], { type: MIME_JSON })

  if (fileId) {
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ name: fileName })], { type: MIME_JSON }))
    form.append('file', fileBlob)
    await driveRequest(`${UPLOAD_API}/files/${fileId}?uploadType=multipart`, token, {
      method: 'PATCH',
      body: form,
    })
    return fileId
  }

  const folderId = await getOrCreateFolder(token)
  const form = new FormData()
  form.append(
    'metadata',
    new Blob(
      [JSON.stringify({ name: fileName, mimeType: MIME_JSON, parents: [folderId] })],
      { type: MIME_JSON }
    )
  )
  form.append('file', fileBlob)
  const res = await driveRequest(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    token,
    { method: 'POST', body: form }
  )
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function loadMap(token: string, fileId: string): Promise<unknown> {
  const res = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`, token)
  return res.json()
}

export async function deleteMap(token: string, fileId: string): Promise<void> {
  await driveRequest(`${DRIVE_API}/files/${fileId}`, token, { method: 'DELETE' })
}
