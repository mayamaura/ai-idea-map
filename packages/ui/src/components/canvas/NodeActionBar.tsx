import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useMapStore, useUIStore } from '@ideamap/core'

/** 実寸を測るまでのフォールバック値 */
const BAR_HALF_WIDTH_ESTIMATE = 120

export function NodeActionBar() {
  const { selectedNodeId, setAIPanelOpen, openNodeDetail, setSelectedNodeId, connectingFromNodeId, setConnectingFromNodeId, openConfirmDialog } = useUIStore(
    useShallow((s) => ({
      selectedNodeId: s.selectedNodeId,
      setAIPanelOpen: s.setAIPanelOpen,
      openNodeDetail: s.openNodeDetail,
      setSelectedNodeId: s.setSelectedNodeId,
      connectingFromNodeId: s.connectingFromNodeId,
      setConnectingFromNodeId: s.setConnectingFromNodeId,
      openConfirmDialog: s.openConfirmDialog,
    }))
  )
  const deleteNode = useMapStore((s) => s.deleteNode)

  // 接続線のあるノードは削除の影響が大きいため、右クリックメニューと同じ確認を挟む
  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return
    const removeNode = () => {
      deleteNode(selectedNodeId)
      setSelectedNodeId(null)
    }
    if (useMapStore.getState().hasConnectedEdges(selectedNodeId)) {
      openConfirmDialog({
        title: 'ノードを削除しますか？',
        message:
          'このノードには接続された線があります。削除すると、つながっている線もすべて削除されます。',
        confirmLabel: '削除する',
        danger: true,
        onConfirm: removeNode,
      })
    } else {
      removeNode()
    }
  }, [selectedNodeId, deleteNode, setSelectedNodeId, openConfirmDialog])
  // mapStore の nodes を参照することでドラッグ後の位置変化にも追従する。
  // 座標だけを useShallow で取り出し、無関係なストア更新では再描画しない
  const absPosition = useMapStore(
    useShallow((s) => {
      if (!selectedNodeId) return null
      const node = s.nodes.find((n) => n.id === selectedNodeId)
      if (!node) return null
      const parent = node.parentId ? s.nodes.find((n) => n.id === node.parentId) : undefined
      return {
        x: node.position.x + (parent?.position.x ?? 0),
        y: node.position.y + (parent?.position.y ?? 0),
      }
    })
  )
  useViewport() // ズーム・パン変化時に再レンダリングしてバーを再配置
  const { flowToScreenPosition, getNode } = useReactFlow()

  // 推定半幅ではスマホ幅で右端がはみ出すため、描画後に実寸を測ってクランプに使う
  const barRef = useRef<HTMLDivElement>(null)
  const [halfWidth, setHalfWidth] = useState(BAR_HALF_WIDTH_ESTIMATE)
  useLayoutEffect(() => {
    const w = barRef.current?.offsetWidth
    if (w && Math.abs(w / 2 - halfWidth) > 0.5) setHalfWidth(w / 2)
  }, [selectedNodeId, halfWidth])

  // 接続モード中はバナーが主役なので非表示
  if (!selectedNodeId || connectingFromNodeId) return null
  if (!absPosition) return null

  const rfNode = getNode(selectedNodeId)
  const nodeWidth = rfNode?.measured?.width ?? 150
  const nodeHeight = rfNode?.measured?.height ?? 60

  const { x: screenX, y: screenY } = flowToScreenPosition({
    x: absPosition.x + nodeWidth / 2,
    y: absPosition.y + nodeHeight,
  })

  const clampedLeft = Math.max(halfWidth + 8, Math.min(screenX, window.innerWidth - halfWidth - 8))

  return createPortal(
    <div
      ref={barRef}
      className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-1 py-1 whitespace-nowrap"
      style={{ position: 'fixed', left: clampedLeft, top: screenY + 8, transform: 'translateX(-50%)', zIndex: 40 }}
    >
      <button
        onClick={() => { setSelectedNodeId(selectedNodeId); setAIPanelOpen(true) }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md transition-colors"
        title="AIに拡張を依頼"
      >
        <span>✦</span>
        <span>AI拡張</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <button
        onClick={() => setConnectingFromNodeId(selectedNodeId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
        title="接続モード（スマホ用エッジ作成）"
      >
        <span>🔗</span>
        <span>接続</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <button
        onClick={() => openNodeDetail(selectedNodeId)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        title="詳細を開く"
      >
        <span>📝</span>
        <span>詳細</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <button
        onClick={handleDelete}
        className="px-3 py-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
        title="削除"
        aria-label="ノードを削除"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>,
    document.body
  )
}
