import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMapStore, useUIStore } from '@ideamap/core'

/**
 * 選択中ノード（uiStore.selectedNodeId）を起点に、エッジの source→target（親→子、design.md §7.1）を
 * 子方向としてBFSしたサブツリーのノードID集合を返す。選択がなければ null（＝呼び出し側はマップ全体を対象とみなす）。
 *
 * nodes/edges をそのまま購読するとドラッグ中の位置更新のたびに再計算されてしまう
 * （AIChatPanel.tsx が同じ理由で全体購読を避けているのと同じ事情）ため、
 * BFSに必要な id と source/target の値だけを useShallow で購読して不要な再計算を避ける。
 */
export function useSubtreeNodeIds(): Set<string> | null {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const nodeIds = useMapStore(useShallow((s) => s.nodes.map((n) => n.id)))
  // 文字列に潰すことで useShallow の値比較（Object.is per要素）が効き、座標だけの更新では再計算されない
  const edgePairs = useMapStore(useShallow((s) => s.edges.map((e) => `${e.source}>${e.target}`)))

  return useMemo(() => {
    if (!selectedNodeId || !nodeIds.includes(selectedNodeId)) return null

    const childrenOf = new Map<string, string[]>()
    for (const pair of edgePairs) {
      const [source, target] = pair.split('>')
      const children = childrenOf.get(source)
      if (children) children.push(target)
      else childrenOf.set(source, [target])
    }

    const visited = new Set<string>([selectedNodeId])
    const queue: string[] = [selectedNodeId]
    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const child of childrenOf.get(current) ?? []) {
        if (visited.has(child)) continue
        visited.add(child)
        queue.push(child)
      }
    }
    return visited
  }, [selectedNodeId, nodeIds, edgePairs])
}
