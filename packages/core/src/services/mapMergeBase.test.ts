import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getPlatform, setPlatform, resetPlatform } from '@ideamap/platform'
import type { Platform } from '@ideamap/platform'
import { saveMergeBase, getMergeBase } from './mapMergeBase'
import type { MapFile } from '../types'

function notImplemented(): never {
  throw new Error('このテストでは呼ばれない想定の Adapter メソッド')
}

/** mapMergeBase は storage しか使わないため、他の Adapter はダミーで埋める */
function createMockPlatform(): Platform {
  const store = new Map<string, string>()
  return {
    storage: {
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => {
        store.set(key, value)
      },
      removeItem: async (key) => {
        store.delete(key)
      },
    },
    file: {
      origin: 'local',
      isRemoteReady: false,
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
    http: {
      canAccessLocalServers: false,
      canReach: async () => true,
      request: notImplemented,
      getFetch: notImplemented,
    },
    system: {
      copyToClipboard: async () => {},
      openExternalUrl: async () => {},
      onBeforeExit: () => () => {},
      notify: () => {},
    },
  }
}

function makeMapFile(mapId: string, overrides: Partial<MapFile> = {}): MapFile {
  return {
    version: '1.1',
    mapId,
    title: 'テストマップ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [],
    edges: [],
    ...overrides,
  }
}

beforeEach(() => {
  setPlatform(createMockPlatform())
})

afterEach(() => {
  resetPlatform()
})

describe('saveMergeBase / getMergeBase', () => {
  it('保存した内容をそのまま取得できる', async () => {
    const file = makeMapFile('map-1', { title: '保存時点のタイトル' })
    await saveMergeBase('map-1', file)

    const result = await getMergeBase('map-1')
    expect(result).toEqual(file)
  })

  it('未保存の mapId は null を返す', async () => {
    const result = await getMergeBase('map-unknown')
    expect(result).toBeNull()
  })

  it('mapId ごとに分離される', async () => {
    await saveMergeBase('map-a', makeMapFile('map-a', { title: 'A' }))
    await saveMergeBase('map-b', makeMapFile('map-b', { title: 'B' }))

    expect((await getMergeBase('map-a'))?.title).toBe('A')
    expect((await getMergeBase('map-b'))?.title).toBe('B')
  })

  it('同じ mapId に再度保存すると直近1件だけが残る（上書き）', async () => {
    await saveMergeBase('map-1', makeMapFile('map-1', { title: '1回目' }))
    await saveMergeBase('map-1', makeMapFile('map-1', { title: '2回目' }))

    const result = await getMergeBase('map-1')
    expect(result?.title).toBe('2回目')
  })

  it('StorageAdapter へも実際に書き込まれる（プロセス内キャッシュだけに頼らない）', async () => {
    const file = makeMapFile('map-1', { title: '保存時点' })
    await saveMergeBase('map-1', file)

    const raw = await getPlatform().storage.getItem('ideamap-merge-base-map-1')
    expect(raw).toBe(JSON.stringify(file))
  })
})
