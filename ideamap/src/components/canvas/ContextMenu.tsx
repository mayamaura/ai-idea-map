import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'
import { useMapStore } from '../../stores/mapStore'
import { useSettingsStore } from '../../stores/settingsStore'

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
    setEditingNodeId,
    setAIPanelOpen,
    openNodeDetail,
    openConfirmDialog,
    selectedNodeId,
    presentationNodeIds,
    addNodeToPresentation,
    removeNodeFromPresentation,
  } = useUIStore()
  const {
    addNode,
    addConnectedNode,
    addGroupNode,
    groupSelectedNodes,
    ungroupNodes,
    deleteGroupWithChildren,
    removeNodeFromGroup,
    deleteNode,
    deleteNodeEdges,
    copyNodes,
    paste,
    updateNodeTitle,
    updateNodeCategory,
    deleteEdge,
    reverseEdge,
    toggleEdgeDirection,
    updateEdgeLabel,
    hasConnectedEdges,
    clipboard,
    edges,
    nodes,
  } = useMapStore()
  const { categories } = useSettingsStore()

  const [showCategories, setShowCategories] = useState(false)

  useEffect(() => {
    setShowCategories(false)
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
  const top = Math.max(8, Math.min(y, window.innerHeight - 360))

  const run = (fn: () => void) => () => {
    fn()
    closeContextMenu()
  }

  const handleCreateConnected = () => {
    if (!targetId) return
    const newId = addConnectedNode(targetId)
    if (newId) {
      setSelectedNodeId(newId)
      setEditingNodeId(newId)
    }
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

  const targetNode = type === 'node' && targetId ? nodes.find((n) => n.id === targetId) : undefined
  const selectedIdeaNodeCount = nodes.filter((n) => n.selected && n.type !== 'groupNode').length

  const handleDeleteGroupChoice = () => {
    if (!targetId) return
    openConfirmDialog({
      title: 'グループを削除しますか？',
      message: 'グループと子ノードをすべて削除するか、グループ枠のみ解除して子ノードを残すか選択してください。',
      confirmLabel: 'グループと子を削除',
      danger: true,
      onConfirm: () => deleteGroupWithChildren(targetId),
    })
    closeContextMenu()
  }

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
            <MenuItem
              icon="✏️"
              label="名前を変更"
              shortcut="F2"
              onClick={() => {
                if (targetId) setEditingNodeId(targetId)
                closeContextMenu()
              }}
            />
            <MenuItem icon="📝" label="詳細を開く" onClick={run(() => targetId && openNodeDetail(targetId))} />
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
            {/* 発表モード: 追加/除外 */}
            {targetId && (
              presentationNodeIds.includes(targetId) ? (
                <MenuItem
                  icon="🎭"
                  label={`発表から除外（${presentationNodeIds.indexOf(targetId) + 1}番目）`}
                  onClick={run(() => removeNodeFromPresentation(targetId))}
                />
              ) : (
                <MenuItem
                  icon="🎭"
                  label={`発表に追加（${presentationNodeIds.length + 1}番目）`}
                  onClick={run(() => addNodeToPresentation(targetId))}
                />
              )
            )}
            {selectedIdeaNodeCount >= 2 && (
              <MenuItem
                icon="📦"
                label={`グループ化（${selectedIdeaNodeCount}件）`}
                onClick={run(() => groupSelectedNodes())}
              />
            )}
            {/* カテゴリ選択 */}
            <MenuItem icon="🏷️" label="カテゴリを変更" onClick={() => setShowCategories((v) => !v)} />
            {showCategories && (
              <div className="px-2 py-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                {categories.map((cat) => {
                  const isActive = targetNode?.data.categoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={run(() => {
                        if (targetId) updateNodeCategory(targetId, cat.id, cat.color)
                      })}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-sm text-left transition-colors hover:brightness-95"
                      style={{ backgroundColor: cat.color }}
                    >
                      <span className="text-sm leading-none">{cat.icon}</span>
                      <span className="flex-1 text-gray-800">{cat.name}</span>
                      {isActive && (
                        <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <Divider />
            {targetNode?.parentId && (
              <MenuItem
                icon="📤"
                label="グループから外す"
                onClick={run(() => targetId && removeNodeFromGroup(targetId))}
              />
            )}
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
              onClick={() => {
                if (flowPosition) {
                  const id = addNode('新しいアイデア', flowPosition.x - 60, flowPosition.y - 20)
                  setSelectedNodeId(id)
                  setEditingNodeId(id)
                }
                closeContextMenu()
              }}
            />
            <MenuItem
              icon="📦"
              label="グループを作成"
              onClick={run(() => {
                if (flowPosition) addGroupNode('グループ', flowPosition.x - 100, flowPosition.y - 75)
              })}
            />
            <MenuItem
              icon="📥"
              label="ここに貼り付け"
              shortcut="Ctrl+V"
              disabled={clipboard.nodes.length === 0}
              onClick={run(() => paste(flowPosition))}
            />
          </>
        )}

        {type === 'group' && (
          <>
            <MenuItem
              icon="✏️"
              label="ラベルを編集"
              onClick={() => {
                if (!targetId) return
                const groupNode = nodes.find((n) => n.id === targetId)
                const current = (groupNode?.data as { title?: string })?.title ?? ''
                const next = window.prompt('グループ名を入力してください', current)
                if (next !== null) updateNodeTitle(targetId, next.trim() || 'グループ')
                closeContextMenu()
              }}
            />
            <Divider />
            <MenuItem
              icon="📤"
              label="グループを解除（子ノードは残す）"
              onClick={run(() => targetId && ungroupNodes(targetId))}
            />
            <MenuItem
              icon="🗑️"
              label="グループと子ノードを削除"
              danger
              onClick={handleDeleteGroupChoice}
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
