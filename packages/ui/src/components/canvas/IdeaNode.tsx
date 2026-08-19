import { memo, useRef, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Handle, Position, NodeToolbar, type NodeProps, type Node } from '@xyflow/react'
import { getPlatform } from '@ideamap/platform'
import { useMapStore, useUIStore, useSettingsStore, type IdeaNodeData } from '@ideamap/core'
import { useNodeFocus } from '../../hooks/useNodeFocus'
import { useLinkedMapTitle } from '../../hooks/useLinkedMapTitle'
import { openLinkedMap } from '../../hooks/useFileDashboard'
import { renderMarkdownSimple } from '../../utils/markdown'

/** ノード幅は内容に追従するので上限だけ決める。日本語は1文字≒1emで折り返しが早いため広めに取る */
const NODE_WIDTH_CLASS = 'min-w-24 max-w-72'

function shapeClass(shape: string): string {
  if (shape === 'ellipse') return 'rounded-full'
  if (shape === 'hexagon') return 'node-shape-hexagon'
  return 'rounded-xl'
}

/** 不正なURLはリンクチップを表示しないため、失敗時は null を返す */
function getDomainLabel(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function IdeaNodeComponent({ id, data, selected }: NodeProps<Node<IdeaNodeData>>) {
  const nodeData = data as IdeaNodeData
  const editText = useRef(nodeData.title)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateNodeTitle = useMapStore((s) => s.updateNodeTitle)
  const {
    setSelectedNodeId,
    openContextMenu,
    openNodeDetail,
    searchQuery,
    activeCategoryFilters,
    editingNodeId,
    setEditingNodeId,
    connectingFromNodeId,
  } = useUIStore(
    useShallow((s) => ({
      setSelectedNodeId: s.setSelectedNodeId,
      openContextMenu: s.openContextMenu,
      openNodeDetail: s.openNodeDetail,
      searchQuery: s.searchQuery,
      activeCategoryFilters: s.activeCategoryFilters,
      editingNodeId: s.editingNodeId,
      setEditingNodeId: s.setEditingNodeId,
      connectingFromNodeId: s.connectingFromNodeId,
    }))
  )
  const presentationIndex = useUIStore((s) => s.presentationNodeIds.indexOf(id))
  // ドラッグ中のノードが自ノードに重なっている（ドロップでエッジ作成）。boolean 化して自ノードだけ再レンダー
  const isDropTarget = useUIStore((s) => s.dragOverNodeId === id)
  const nodeShape = useSettingsStore((s) => s.nodeShape)
  const getCategoryById = useSettingsStore((s) => s.getCategoryById)

  // React Flow の data prop は外部ストア更新に追従しないことがあるため、
  // color と categoryId はストアから直接読む（applyClusterCategory 等の即時反映のため）。
  // 全ノードが毎更新で find() を走らせるため、2つのセレクタを1つに統合している
  const { storeColor, storeCategoryId } = useMapStore(
    useShallow((s) => {
      const node = s.nodes.find((n) => n.id === id)
      return { storeColor: node?.data.color, storeCategoryId: node?.data.categoryId }
    })
  )
  const nodeColor = storeColor ?? nodeData.color
  const nodeCategoryId = storeCategoryId !== undefined ? storeCategoryId : nodeData.categoryId

  // フォーカス／発表／接続モードの dim は自ノードぶんだけを Context から判定する
  const { opacity: focusOpacity, isConnectSource } = useNodeFocus(id)

  const isEditing = editingNodeId === id

  // 検索・フィルター状態に応じた表示制御
  const isSearchActive = searchQuery.trim() !== ''
  const matchesSearch = isSearchActive
    ? nodeData.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (nodeData.body?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    : true
  const matchesFilter =
    activeCategoryFilters.length === 0 ||
    activeCategoryFilters.includes(nodeCategoryId ?? 'cat-none')
  const isDimmed = (isSearchActive && !matchesSearch) || (activeCategoryFilters.length > 0 && !matchesFilter)
  const isHighlighted = isSearchActive && matchesSearch

  // タイトルが外部から変更されたとき（Undo/Redo・AI生成など）はローカル参照を同期する
  useEffect(() => {
    if (!isEditing) {
      editText.current = nodeData.title
    }
  }, [nodeData.title, isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.value = nodeData.title
      editText.current = nodeData.title
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const commitEdit = useCallback(() => {
    const trimmed = editText.current.trim()
    if (trimmed) {
      updateNodeTitle(id, trimmed)
    }
    setEditingNodeId(null)
  }, [id, updateNodeTitle, setEditingNodeId])

  const handleDoubleClick = useCallback(() => {
    setEditingNodeId(id)
  }, [id, setEditingNodeId])

  const handleBlur = useCallback(() => {
    commitEdit()
  }, [commitEdit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitEdit()
      }
      if (e.key === 'Escape') {
        // 復元して編集終了
        editText.current = nodeData.title
        setEditingNodeId(null)
      }
    },
    [commitEdit, nodeData.title, setEditingNodeId]
  )

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // マルチタッチ（ピンチ等）中は長押し判定しない
    if (e.touches.length !== 1) return
    // 接続モード中のタップは接続確定が目的。長押しタイマーを張るとタップ後に
    // コンテキストメニューが二重で開くため、タイマー自体を作らない
    if (connectingFromNodeId) return
    const touch = e.touches[0]
    // イベントはコールバック終了後に使えないため座標をローカル変数に取り込む
    const x = touch.clientX
    const y = touch.clientY
    longPressTimer.current = setTimeout(() => {
      setSelectedNodeId(id)
      openContextMenu({ type: 'node', x, y, targetId: id })
      navigator.vibrate?.(10)
    }, 500)
  }, [id, setSelectedNodeId, openContextMenu, connectingFromNodeId])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const isAI = nodeData.createdBy === 'ai'
  const hasBody = Boolean(nodeData.body)
  const shape = shapeClass(nodeShape)
  const category = nodeCategoryId ? getCategoryById(nodeCategoryId) : undefined
  const showCategoryLabel = selected && category && category.id !== 'cat-none'
  const isInPresentation = presentationIndex !== -1
  const domainLabel = getDomainLabel(nodeData.url)
  const linkedMapTitle = useLinkedMapTitle(nodeData.linkedMapId)

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (nodeData.url) void getPlatform().system.openExternalUrl(nodeData.url)
    },
    [nodeData.url]
  )

  const handleLinkedMapClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (nodeData.linkedMapId && nodeData.linkedMapOrigin) {
        void openLinkedMap({ mapId: nodeData.linkedMapId, origin: nodeData.linkedMapOrigin })
      }
    },
    [nodeData.linkedMapId, nodeData.linkedMapOrigin]
  )

  // 検索・フィルターの dim とフォーカスの dim は同じ要素にかかるため濃い方を採用する
  const opacity = Math.min(isDimmed ? 0.2 : 1, focusOpacity)

  return (
    <div
      className="relative group animate-node-enter transition-opacity duration-200"
      style={{
        opacity,
        outline: isDropTarget
          ? '3px solid #10b981'
          : isConnectSource
          ? '2px solid #6366f1'
          : undefined,
        outlineOffset: isDropTarget ? 3 : isConnectSource ? 2 : undefined,
      }}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {/* ドロップ接続のガイド: ドラッグ中のノードが自ノードに重なっている間だけ表示（ズーム非依存） */}
      <NodeToolbar isVisible={isDropTarget} position={Position.Top} offset={8}>
        <div className="bg-emerald-500 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap pointer-events-none">
          ドロップでこのアイデアを親にして接続
        </div>
      </NodeToolbar>

      {/* カテゴリラベル（選択時のみ表示・ズーム非依存） */}
      <NodeToolbar isVisible={showCategoryLabel} position={Position.Top} align="start" offset={6}>
        <div className="flex items-center gap-1 bg-white/95 text-gray-600 px-2 py-1 rounded-md shadow-sm border border-gray-200 whitespace-nowrap pointer-events-none">
          <span className="text-sm">{category?.icon}</span>
          <span className="text-sm font-medium">{category?.name}</span>
        </div>
      </NodeToolbar>

      {/* 発表順序バッジ（発表リストに追加済みの場合のみ表示・ズーム非依存） */}
      {isInPresentation && (
        <NodeToolbar isVisible={true} position={Position.Top} align="end" offset={6}>
          <div className="flex items-center justify-center w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-sm pointer-events-none">
            {presentationIndex + 1}
          </div>
        </NodeToolbar>
      )}

      {/* AI badge */}
      {isAI && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center z-10 shadow-sm">
          <span className="text-white text-xs font-bold leading-none">✦</span>
        </div>
      )}

      {/* 本文インジケーター（クリックで詳細モーダルを開く） */}
      {hasBody && (
        <div
          className="absolute -top-2 -left-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center z-10 shadow-sm text-[10px] leading-none cursor-pointer"
          onClick={(e) => { e.stopPropagation(); openNodeDetail(id) }}
          title="詳細を開く"
        >
          📝
        </div>
      )}

      {/* ハンドル: 全方向を source/target 兼用にして任意方向から接続できる（ConnectionMode.Loose） */}
      {(['Top', 'Right', 'Bottom', 'Left'] as const).map((pos) => (
        <Handle
          key={pos}
          id={pos.toLowerCase()}
          type="source"
          position={Position[pos]}
          className="!bg-primary-400 !border-white !border-2"
        />
      ))}

      {/* 形状コンテナ */}
      <div
        className={`
          ${NODE_WIDTH_CLASS} ${shape} border-2 shadow-sm
          transition-all duration-150 cursor-default
          ${isAI ? 'node-ai-generated' : ''}
          ${selected
            ? 'border-primary-500 shadow-md shadow-primary-100'
            : isHighlighted
            ? 'border-yellow-400 shadow-md shadow-yellow-100'
            : 'border-gray-200 hover:border-gray-300'
          }
        `}
        style={{ backgroundColor: nodeColor }}
      >
        <div className="px-3 py-2">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              defaultValue={nodeData.title}
              onChange={(e) => { editText.current = e.target.value }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full text-sm text-gray-800 bg-transparent resize-none outline-none leading-snug"
              rows={2}
              style={{ minWidth: '80px' }}
            />
          ) : (
            <>
              <p className="text-sm text-gray-800 leading-snug break-words text-balance [word-break:auto-phrase] select-none">
                {nodeData.title}
              </p>
              {/* 本文プレビュー（Markdown整形・先頭2行相当）。選択中は全文まで下に伸ばし、詳細パネルへの目線移動を省く */}
              {hasBody && (
                <div
                  className={`text-xs text-gray-500 leading-snug select-none mt-1 opacity-75 ${
                    // nowheel: 展開が上限に達したときのホイール操作をキャンバスのズームに奪われないようにする
                    selected ? 'nowheel overflow-y-auto' : 'overflow-hidden'
                  }`}
                  style={{ maxHeight: selected ? '24rem' : '2.6rem' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdownSimple(nodeData.body!) }}
                />
              )}
              {/* 添付画像のサムネイル */}
              {nodeData.image && (
                <img
                  src={nodeData.image}
                  alt=""
                  className="mt-1.5 w-full max-h-20 object-cover rounded-md"
                />
              )}
              {/* URLリンクチップ（ドメイン名のみ表示、クリックで外部ブラウザ） */}
              {domainLabel && (
                <button
                  onClick={handleLinkClick}
                  title={nodeData.url}
                  className="mt-1.5 flex items-center gap-1 text-[10px] text-primary-600 hover:underline truncate max-w-full"
                >
                  <span>🔗</span>
                  <span className="truncate">{domainLabel}</span>
                </button>
              )}
              {/* マップリンクチップ（Phase 52）。クリックで対象マップへ遷移 */}
              {nodeData.linkedMapId && (
                <button
                  onClick={handleLinkedMapClick}
                  title={linkedMapTitle ?? nodeData.linkedMapId}
                  className="mt-1.5 flex items-center gap-1 text-[10px] text-primary-600 hover:underline truncate max-w-full"
                >
                  <span>🗺️</span>
                  <span className="truncate">{linkedMapTitle ?? `${nodeData.linkedMapId.slice(0, 8)}…`}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}

export const IdeaNode = memo(IdeaNodeComponent)
