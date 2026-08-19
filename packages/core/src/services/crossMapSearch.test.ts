import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setPlatform, resetPlatform } from '@ideamap/platform'
import type { Platform, FileRef, RecentFileEntry } from '@ideamap/platform'
import { searchAcrossMaps } from './crossMapSearch'
import type { MapFile, SerializedNode } from '../types'
import { CURRENT_MAP_FILE_VERSION } from '../utils/mapFileCompat'

function notImplemented(): never {
  throw new Error('このテストでは呼ばれない想定の Adapter メソッド')
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
    version: CURRENT_MAP_FILE_VERSION,
    mapId,
    title: 'テストマップ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [makeNode('n1')],
    edges: [],
    ...overrides,
  }
}

function makeRef(id: string): FileRef {
  return { id, name: id, origin: 'cloud', updatedAt: '2026-01-01T00:00:00.000Z' }
}

/** ref.id -> content の対応表からファイルを返す openFile を持つモック Platform を作る */
function createMockPlatform(contents: Record<string, unknown>, failing: Set<string> = new Set()): Platform {
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
      openFile: async (ref) => {
        if (!ref) return null
        if (failing.has(ref.id)) throw new Error('読み込みに失敗しました')
        const content = contents[ref.id]
        if (content === undefined) return null
        return { ref, content }
      },
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

beforeEach(() => {
  // crossMapSearch はモジュール内でセッションキャッシュを持つため、テスト間で ref.id が
  // 衝突しないよう各テストでユニークな id を使う（キャッシュを跨いだ汚染を避けるため）
})

afterEach(() => {
  resetPlatform()
})

describe('searchAcrossMaps', () => {
  it('複数マップにまたがってヒットする', async () => {
    setPlatform(
      createMockPlatform({
        'map-a': makeMapFile('a', { title: 'マップA', nodes: [makeNode('n1', { title: 'りんごの企画' })] }),
        'map-b': makeMapFile('b', { title: 'マップB', nodes: [makeNode('n1', { title: '別件' })] }),
        'map-c': makeMapFile('c', { title: 'マップC', nodes: [makeNode('n1', { title: 'りんご狩り' })] }),
      })
    )
    const entries: RecentFileEntry[] = [
      { ref: makeRef('map-a'), title: 'マップA' },
      { ref: makeRef('map-b'), title: 'マップB' },
      { ref: makeRef('map-c'), title: 'マップC' },
    ]

    const results = await searchAcrossMaps('りんご', entries)

    expect(results.map((r) => r.ref.id).sort()).toEqual(['map-a', 'map-c'])
  })

  it('大小文字を無視してタイトル・本文の部分一致で検索する', async () => {
    setPlatform(
      createMockPlatform({
        'map-d': makeMapFile('d', {
          title: 'マップD',
          nodes: [makeNode('n1', { title: 'Hello', body: 'ワールドの話' })],
        }),
      })
    )
    const entries: RecentFileEntry[] = [{ ref: makeRef('map-d'), title: 'マップD' }]

    const byTitle = await searchAcrossMaps('HELLO', entries)
    const byBody = await searchAcrossMaps('ワールド', entries)

    expect(byTitle[0]?.matchedNodes.map((n) => n.id)).toEqual(['n1'])
    expect(byBody[0]?.matchedNodes.map((n) => n.id)).toEqual(['n1'])
  })

  it('一致するものがなければ空配列を返す', async () => {
    setPlatform(
      createMockPlatform({
        'map-e': makeMapFile('e', { title: 'マップE', nodes: [makeNode('n1', { title: '無関係' })] }),
      })
    )
    const entries: RecentFileEntry[] = [{ ref: makeRef('map-e'), title: 'マップE' }]

    const results = await searchAcrossMaps('存在しないキーワード', entries)

    expect(results).toEqual([])
  })

  it('現在のマップ自身は entries に含めなければ検索対象にならない', async () => {
    setPlatform(
      createMockPlatform({
        'map-current': makeMapFile('current', { title: '現在のマップ', nodes: [makeNode('n1', { title: 'キーワード' })] }),
        'map-other': makeMapFile('other', { title: '他のマップ', nodes: [makeNode('n1', { title: 'キーワード' })] }),
      })
    )
    // 呼び出し側（SearchBar）が現在のマップを除外した entries を渡す想定
    const entries: RecentFileEntry[] = [{ ref: makeRef('map-other'), title: '他のマップ' }]

    const results = await searchAcrossMaps('キーワード', entries)

    expect(results.map((r) => r.ref.id)).toEqual(['map-other'])
  })

  it('1マップの取得に失敗しても他マップの結果は返る', async () => {
    setPlatform(
      createMockPlatform(
        {
          'map-ok': makeMapFile('ok', { title: 'マップOK', nodes: [makeNode('n1', { title: 'キーワード' })] }),
          'map-fail': makeMapFile('fail', { title: 'マップFAIL', nodes: [makeNode('n1', { title: 'キーワード' })] }),
        },
        new Set(['map-fail'])
      )
    )
    const entries: RecentFileEntry[] = [
      { ref: makeRef('map-ok'), title: 'マップOK' },
      { ref: makeRef('map-fail'), title: 'マップFAIL' },
    ]

    const results = await searchAcrossMaps('キーワード', entries)

    expect(results.map((r) => r.ref.id)).toEqual(['map-ok'])
  })
})
