import { beforeEach, describe, expect, it } from 'vitest'
import { buildMapFile } from './mapSnapshot'
import { useMapStore } from './mapStore'
import { useUIStore } from './uiStore'
import { CURRENT_MAP_FILE_VERSION } from '../utils/mapFileCompat'

// uiStore には reset アクションが無いため、buildMapFile が参照するフィールドだけ setState で戻す
beforeEach(() => {
  useMapStore.getState().reset()
  useUIStore.setState({ mapTitle: '新しいマップ', presentationNodeIds: [] })
})

describe('buildMapFile', () => {
  it('現在のノード・エッジ・タイトルから MapFile を組み立てる', () => {
    useMapStore.getState().addNode('アイデア', 10, 20)
    useUIStore.getState().setMapTitle('マイマップ')

    const file = buildMapFile('map-1')

    expect(file.mapId).toBe('map-1')
    expect(file.version).toBe(CURRENT_MAP_FILE_VERSION)
    expect(file.title).toBe('マイマップ')
    expect(file.nodes).toEqual(useMapStore.getState().getSerializedNodes())
    expect(file.edges).toEqual(useMapStore.getState().getSerializedEdges())
    expect(file.presentationNodeIds).toBeUndefined()
    expect(file.updatedAt).toBe(file.createdAt)
  })

  it('presentationNodeIds が空でなければ含める', () => {
    useUIStore.getState().setPresentationNodeIds(['root'])

    const file = buildMapFile('map-2')

    expect(file.presentationNodeIds).toEqual(['root'])
  })
})
