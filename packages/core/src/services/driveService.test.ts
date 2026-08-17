import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setPlatform, resetPlatform } from '@ideamap/platform'
import type { HttpAdapter, Platform } from '@ideamap/platform'
import {
  clearDriveCache,
  saveMap,
  listMaps,
  loadAppSettings,
} from './driveService'
import type { AppSettingsPayload } from '../stores/settingsStore'

// Google Drive REST API へのネットワークアクセスは禁止のため、HttpAdapter をモックして
// リクエストの記録・レスポンスの差し替えだけで検証する。

const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

interface RecordedCall {
  url: string
  init?: RequestInit
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
  }
  return (headers as Record<string, string>)[name]
}

function bodyText(init: RequestInit | undefined): string {
  return init?.body as string
}

/** キューに積んだ Response を呼び出し順に返す HttpAdapter モック */
function createHttp(responses: Response[]): { http: HttpAdapter; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const queue = [...responses]
  const http: HttpAdapter = {
    canAccessLocalServers: false,
    canReach: async () => true,
    request: async (input, init) => {
      calls.push({ url: input, init })
      const res = queue.shift()
      if (!res) throw new Error(`想定外の追加リクエスト: ${input}`)
      return res
    },
    // driveService は request() だけを使い getFetch() は呼ばないため未実装のままでよい
    getFetch: notImplemented,
  }
  return { http, calls }
}

function notImplemented(): never {
  throw new Error('このテストでは呼ばれない想定の Adapter メソッド')
}

/** driveService は http しか使わないため、他の Adapter はダミーで埋める */
function createMockPlatform(http: HttpAdapter): Platform {
  return {
    storage: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
    file: {
      origin: 'cloud',
      isRemoteReady: true,
      listRecent: async () => [],
      openFile: async () => null,
      saveFile: notImplemented,
      saveFileAs: notImplemented,
      deleteFile: notImplemented,
      getMetadata: async () => null,
      saveLocalMirror: async () => {},
      exportBlob: notImplemented,
    },
    secret: {
      hasSecret: async () => false,
      getSecret: async () => null,
      setSecret: async () => {},
      clearSecret: async () => {},
      hasLegacySecret: async () => false,
      getLegacySecret: async () => null,
      clearLegacySecret: async () => {},
      isPassphraseFree: true,
    },
    http,
    system: {
      copyToClipboard: async () => {},
      openExternalUrl: async () => {},
      onBeforeExit: () => () => {},
      notify: () => {},
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  clearDriveCache()
})

afterEach(() => {
  resetPlatform()
})

describe('saveMap', () => {
  it('既存 fileId があれば PATCH で保存する（フォルダ検索・重複検索を行わない）', async () => {
    const { http, calls } = createHttp([jsonResponse({}, 200)])
    setPlatform(createMockPlatform(http))

    const result = await saveMap('token-1', 'MyMap', { a: 1 }, 'existing-file-id', null)

    expect(result).toBe('existing-file-id')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${UPLOAD_API}/files/existing-file-id?uploadType=multipart`)
    expect(calls[0].init?.method).toBe('PATCH')
    expect(headerValue(calls[0].init, 'Authorization')).toBe('Bearer token-1')
  })

  it('fileId がなく同名ファイルも無ければフォルダ確認・重複検索のあと POST で新規作成する', async () => {
    const { http, calls } = createHttp([
      jsonResponse({ files: [{ id: 'folder-1' }] }), // getOrCreateFolder: 既存フォルダが見つかる
      jsonResponse({ files: [] }), // findMapFileId: 同名ファイルなし（mapId 未指定なので name 検索のみ）
      jsonResponse({ id: 'new-file-id' }), // 新規作成 POST
    ])
    setPlatform(createMockPlatform(http))

    const result = await saveMap('token-1', 'MyMap', { a: 1 })

    expect(result).toBe('new-file-id')
    expect(calls).toHaveLength(3)
    expect(calls[2].url).toBe(`${UPLOAD_API}/files?uploadType=multipart&fields=id`)
    expect(calls[2].init?.method).toBe('POST')
  })

  it('fileId がなくても mapId で既存ファイルが見つかれば PATCH で上書きする', async () => {
    const { http, calls } = createHttp([
      jsonResponse({ files: [{ id: 'folder-1' }] }), // getOrCreateFolder
      jsonResponse({ files: [{ id: 'found-by-mapid' }] }), // findMapFileId: appProperties.mapId 検索でヒット
      jsonResponse({}, 200), // 上書き PATCH
    ])
    setPlatform(createMockPlatform(http))

    const result = await saveMap('token-1', 'MyMap', { a: 1 }, undefined, 'map-uuid-1')

    expect(result).toBe('found-by-mapid')
    expect(calls).toHaveLength(3)
    expect(calls[2].url).toBe(`${UPLOAD_API}/files/found-by-mapid?uploadType=multipart`)
    expect(calls[2].init?.method).toBe('PATCH')
  })

  it('multipart/related ボディが boundary・メタデータ部・本文部の順で正しく組み立てられる', async () => {
    const { http, calls } = createHttp([jsonResponse({}, 200)])
    setPlatform(createMockPlatform(http))

    await saveMap('token-1', 'MyMap', { a: 1 }, 'existing-file-id', null)

    const contentType = headerValue(calls[0].init, 'Content-Type')
    expect(contentType).toMatch(/^multipart\/related; boundary=ideamap-/)
    const boundary = contentType?.split('boundary=')[1]
    expect(boundary).toBeTruthy()

    const expectedMetadata = JSON.stringify({ name: 'MyMap.json' })
    const expectedContent = JSON.stringify({ a: 1 }, null, 2)
    const expectedBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${expectedMetadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${expectedContent}\r\n` +
      `--${boundary}--`

    expect(bodyText(calls[0].init)).toBe(expectedBody)
  })

  it('boundary はリクエストごとにランダムに変わる', async () => {
    const { http, calls } = createHttp([jsonResponse({}, 200), jsonResponse({}, 200)])
    setPlatform(createMockPlatform(http))

    await saveMap('token-1', 'MyMap', { a: 1 }, 'file-1', null)
    await saveMap('token-1', 'MyMap', { a: 1 }, 'file-1', null)

    const boundary1 = headerValue(calls[0].init, 'Content-Type')
    const boundary2 = headerValue(calls[1].init, 'Content-Type')
    expect(boundary1).not.toBe(boundary2)
  })
})

describe('folderIdCache', () => {
  it('2回目の呼び出しではフォルダ検索を省略し、clearDriveCache() で再び検索する', async () => {
    const { http, calls } = createHttp([
      jsonResponse({ files: [{ id: 'folder-1' }] }), // 1回目: フォルダ検索
      jsonResponse({ files: [] }), // 1回目: 一覧取得
      jsonResponse({ files: [] }), // 2回目: 一覧取得のみ（フォルダはキャッシュ済み）
      jsonResponse({ files: [{ id: 'folder-1' }] }), // 3回目: clearDriveCache 後、フォルダ検索が再び走る
      jsonResponse({ files: [] }), // 3回目: 一覧取得
    ])
    setPlatform(createMockPlatform(http))

    await listMaps('token-1')
    expect(calls).toHaveLength(2)

    await listMaps('token-1')
    expect(calls).toHaveLength(3) // +1（フォルダ検索は省略された）

    clearDriveCache()

    await listMaps('token-1')
    expect(calls).toHaveLength(5) // +2（フォルダ検索が再び走った）
  })
})

describe('settingsFileIdCache', () => {
  it('2回目の呼び出しでは設定ファイル検索を省略し、clearDriveCache() で folderIdCache ごと再検索する', async () => {
    const settings: AppSettingsPayload = {
      version: '1',
      encryptedApiKey: 'enc',
      salt: [1, 2, 3],
      model: 'test-model',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const { http, calls } = createHttp([
      jsonResponse({ files: [{ id: 'folder-1' }] }), // 1回目: フォルダ検索
      jsonResponse({ files: [{ id: 'settings-1' }] }), // 1回目: settings.json 検索
      jsonResponse(settings), // 1回目: 本文取得
      jsonResponse(settings), // 2回目: 本文取得のみ（settingsFileIdCache がヒット）
      jsonResponse({ files: [{ id: 'folder-1' }] }), // 3回目: clearDriveCache 後、フォルダ検索も再び走る
      jsonResponse({ files: [{ id: 'settings-1' }] }), // 3回目: settings.json 検索も再び走る
      jsonResponse(settings), // 3回目: 本文取得
    ])
    setPlatform(createMockPlatform(http))

    const first = await loadAppSettings('token-1')
    expect(first).toEqual(settings)
    expect(calls).toHaveLength(3)

    const second = await loadAppSettings('token-1')
    expect(second).toEqual(settings)
    expect(calls).toHaveLength(4) // +1（フォルダ検索・設定ファイル検索とも省略された）

    clearDriveCache()

    const third = await loadAppSettings('token-1')
    expect(third).toEqual(settings)
    expect(calls).toHaveLength(7) // +3（folderIdCache も settingsFileIdCache も消えて両方再検索）
  })
})

describe('エラー応答', () => {
  it('401 などの非OK応答は Drive API のステータスと本文を含むエラーを投げる', async () => {
    const { http } = createHttp([new Response('invalid_grant', { status: 401 })])
    setPlatform(createMockPlatform(http))

    await expect(listMaps('expired-token')).rejects.toThrow('Drive API 401: invalid_grant')
  })
})
