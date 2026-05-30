import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'

const NODE_COLORS = [
  { hex: '#ffffff', name: '白' },
  { hex: '#e0e7ff', name: '紫' },
  { hex: '#dbeafe', name: '青' },
  { hex: '#d1fae5', name: '緑' },
  { hex: '#fef3c7', name: '黄' },
  { hex: '#fce7f3', name: 'ピンク' },
  { hex: '#ffe4e6', name: '赤' },
  { hex: '#f3f4f6', name: 'グレー' },
]

const MENU_WIDTH = 216

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  shortcut,
  disabled,
}: {
  icon: string
  label: string
  onClick: () => void
  danger?: boolean
  shortcut?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <span className="w-4 text-center text-[13px] leading-none">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[11px] text-gray-400">{shortcut}</span>}
    </button>
  )
}

function Divider() {
  return <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
}

export function ContextMenu() {
  const {
    contextMenu,
    closeContextMenu,
    setSelectedNodeId,
    setAIPanelOpen,
    openConfirmDialog,
    selectedNodeId,
  } = useUIStore()
  const {
    addNode,
    addConnectedNode,
    deleteNode,
    deleteNodeEdges,
    copyNodes,
    paste,
    updateNodeColor,
    deleteEdge,
    reverseEdge,
    toggleEdgeDirection,
    updateEdgeLabel,
    hasConnectedEdges,
    clipboard,
    edges,
  } = useMapStore()

  const [showColors, setShowColors] = useState(false)

  // メニューが切り替わったら色サブメニューを閉じる
  useEffect(() => {
    setShowColors(false)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextMenu, closeContextMenu])

  if (!contextMenu) return null

  const { type, x, y, targetId, flowPosition } = contextMenu
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - 320))

  const run = (fn: () => void) => () => {
    fn()
    closeContextMenu()
  }

  const handleCreateConnected = () => {
    if (!targetId) return
    const newId = addConnectedNode(targetId)
    if (newId) setSelectedNodeId(newId)
    closeContextMenu()
  }

  const handleDeleteNode = () => {
    if (!targetId) return
    const clearSelection = () => {
      if (selectedNodeId === targetId) setSelectedNodeId(null)
    }
    if (hasConnectedEdges(targetId)) {
      openConfirmDialog({
        title: 'ノードを削除しますか？',
        message:
          'このノードには接続された線があります。削除すると、つながっている線もすべて削除されます。',
        confirmLabel: '削除する',
        danger: true,
        onConfirm: () => {
          deleteNode(targetId)
          clearSelection()
        },
      })
      closeContextMenu()
    } else {
      deleteNode(targetId)
      clearSelection()
      closeContextMenu()
    }
  }

  const handleEditLabel = () => {
    if (!targetId) return
    const edge = edges.find((e) => e.id === targetId)
    const current = typeof edge?.label === 'string' ? edge.label : ''
    const next = window.prompt('線のラベルを入力してください', current)
    if (next !== null) updateEdgeLabel(targetId, next.trim())
    closeContextMenu()
  }

  const currentEdge =
    type === 'edge' && targetId ? edges.find((e) => e.id === targetId) : undefined
  const isBidirectional = Boolean(currentEdge?.markerStart)

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onClick={closeContextMenu}
      onContextMenu={(e) => {
        e.preventDefault()
        closeContextMenu()
      }}
    >
      <div
        className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1.5 animate-context-menu"
        style={{ left, top, minWidth: MENU_WIDTH }}
        onClick={(e) => e.stopPropagation()}
      >
        {type === 'node' && (
          <>
            <MenuItem icon="➕" label="アイデアを作成（接続）" shortcut="Tab" onClick={handleCreateConnected} />
            <MenuItem
              icon="✦"
              label="AIで拡張"
              onClick={run(() => {
                if (targetId) {
                  setSelectedNodeId(targetId)
                  setAIPanelOpen(true)
                }
              })}
            />
            <Divider />
            <MenuItem
              icon="📋"
              label="コピー"
              shortcut="Ctrl+C"
              onClick={run(() => targetId && copyNodes([targetId]))}
            />
            <MenuItem icon="🎨" label="色を変更" onClick={() => setShowColors((v) => !v)} />
            {showColors && (
              <div className="px-3 py-2 grid grid-cols-4 gap-1.5">
                {NODE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    title={c.name}
                    onClick={run(() => targetId && updateNodeColor(targetId, c.hex))}
                    className="h-6 w-6 rounded-md border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            )}
            <Divider />
            {targetId && hasConnectedEdges(targetId) && (
              <MenuItem
                icon="✂️"
                label="接続線のみ削除"
                onClick={run(() => targetId && deleteNodeEdges(targetId))}
              />
            )}
            <MenuItem icon="🗑️" label="ノードを削除" danger onClick={handleDeleteNode} />
          </>
        )}

        {type === 'pane' && (
          <>
            <MenuItem
              icon="➕"
              label="アイデアを作成"
              onClick={run(() => {
                if (flowPosition) {
                  const id = addNode('新しいアイデア', flowPosition.x - 60, flowPosition.y - 20)
                  setSelectedNodeId(id)
                }
              })}
            />
            <MenuItem
              icon="📥"
              label="ここに貼り付け"
              shortcut="Ctrl+V"
              disabled={clipboard.length === 0}
              onClick={run(() => paste(flowPosition))}
            />
          </>
        )}

        {type === 'edge' && (
          <>
            <MenuItem icon="🔄" label="向きを反転" onClick={run(() => targetId && reverseEdge(targetId))} />
            <MenuItem
              icon="↔️"
              label={isBidirectional ? '単方向にする' : '双方向にする'}
              onClick={run(() => targetId && toggleEdgeDirection(targetId))}
            />
            <MenuItem icon="🏷️" label="ラベルを編集" onClick={handleEditLabel} />
            <Divider />
            <MenuItem icon="🗑️" label="線を削除" danger onClick={run(() => targetId && deleteEdge(targetId))} />
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
