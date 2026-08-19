import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setPlatform, resetPlatform } from '@ideamap/platform'
import type { Platform } from '@ideamap/platform'
import { recordSnapshot, getSnapshots, clearSnapshots } from './mapHistory'
import type { MapFile, SerializedNode } from '../types'

function notImplemented(): never {
  throw new Error('このテストでは呼ばれない想定の Adapter メソッド')
}

/** mapHistory は storage しか使わないため、他の Adapter はダミーで埋める */
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

function makeNode(id: string, overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id,
    nodeType: 'idea',
    title: `node-${id}`,
    x: 0,
    y: 0,
    color: '#fff',
    createdBy: 'user',
    ...overrides,
  }
}

function makeMapFile(mapId: string, overrides: Partial<MapFile> = {}): MapFile {
  return {
    version: '1.0',
    mapId,
    title: 'テストマップ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [makeNode('n1')],
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

describe('recordSnapshot / getSnapshots', () => {
  it('リングバッファは上限20件を超えると古い順に破棄する', async () => {
    const mapId = 'map-ring'
    for (let i = 0; i < 25; i++) {
      await recordSnapshot(mapId, makeMapFile(mapId, { nodes: [makeNode(`n${i}`)] }))
    }
    const snapshots = await getSnapshots(mapId)
    expect(snapshots).toHaveLength(20)
    // 古い5件（n0〜n4）が破棄され、n5〜n24 が残っている
    expect(snapshots[0].mapFile.nodes[0].id).toBe('n5')
    expect(snapshots[19].mapFile.nodes[0].id).toBe('n24')
  })

  it('1件のサイズが上限を超えると画像フィールドを省いて保存する', async () => {
    const mapId = 'map-oversize'
    const hugeImage = 'a'.repeat(3 * 1024 * 1024)
    const file = makeMapFile(mapId, { nodes: [makeNode('n1', { image: hugeImage })] })

    await recordSnapshot(mapId, file)

    const snapshots = await getSnapshots(mapId)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].mapFile.nodes[0].image).toBeUndefined()
    expect(snapshots[0].mapFile.nodes[0].title).toBe('node-n1')
  })

  it('直前のスナップショットと nodes/edges が同一なら追記しない', async () => {
    const mapId = 'map-dedup'
    const file = makeMapFile(mapId)

    await recordSnapshot(mapId, file)
    // タイトルだけ変えても nodes/edges が同じなら無変更とみなす
    await recordSnapshot(mapId, { ...file, title: '別タイトル' })

    const snapshots = await getSnapshots(mapId)
    expect(snapshots).toHaveLength(1)
  })

  it('nodes が変われば追記する', async () => {
    const mapId = 'map-changed'
    await recordSnapshot(mapId, makeMapFile(mapId, { nodes: [makeNode('n1')] }))
    await recordSnapshot(mapId, makeMapFile(mapId, { nodes: [makeNode('n1'), makeNode('n2')] }))

    const snapshots = await getSnapshots(mapId)
    expect(snapshots).toHaveLength(2)
  })

  it('mapId ごとに履歴を分離する', async () => {
    await recordSnapshot('map-a', makeMapFile('map-a', { nodes: [makeNode('a1')] }))
    await recordSnapshot('map-b', makeMapFile('map-b', { nodes: [makeNode('b1')] }))

    const snapshotsA = await getSnapshots('map-a')
    const snapshotsB = await getSnapshots('map-b')
    expect(snapshotsA).toHaveLength(1)
    expect(snapshotsB).toHaveLength(1)
    expect(snapshotsA[0].mapFile.nodes[0].id).toBe('a1')
    expect(snapshotsB[0].mapFile.nodes[0].id).toBe('b1')
  })
})

describe('clearSnapshots', () => {
  it('履歴を消去する', async () => {
    const mapId = 'map-clear'
    await recordSnapshot(mapId, makeMapFile(mapId))
    expect(await getSnapshots(mapId)).toHaveLength(1)

    await clearSnapshots(mapId)

    expect(await getSnapshots(mapId)).toHaveLength(0)
  })
})
