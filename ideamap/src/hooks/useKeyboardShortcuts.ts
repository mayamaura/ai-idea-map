import { useEffect } from 'react'
import { useMapStore } from '../stores/mapStore'
import { useUIStore } from '../stores/uiStore'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      const ctrl = e.ctrlKey || e.metaKey
      const map = useMapStore.getState()
      const ui = useUIStore.getState()

      // Ctrl+S: 今すぐ保存。テキスト入力中・モーダル表示中でも有効
      // （ブラウザの「ページを保存」ダイアログの抑止を兼ねる）
      if (ctrl && e.key === 's') {
        e.preventDefault()
        ui.requestSave()
        return
      }

      if (isEditing) return

      // 発表モード中は専用キーのみ処理（他は全てブロック）
      if (ui.isPresentationMode) {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault()
          ui.goToNextPresentation()
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          ui.goToPrevPresentation()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          ui.exitPresentation()
          return
        }
        e.preventDefault()
        return
      }

      // Ctrl+F: 検索バーをトグル（モーダルより優先して処理）
      if (ctrl && e.key === 'f') {
        e.preventDefault()
        ui.setSearchOpen(!ui.isSearchOpen)
        return
      }

      // Ctrl+/: キーボードショートカット一覧
      if (ctrl && e.key === '/') {
        e.preventDefault()
        ui.setShortcutsModalOpen(!ui.isShortcutsModalOpen)
        return
      }

      // Ctrl+Shift+C: AIチャットパネルをトグル
      if (ctrl && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        ui.setChatPanelOpen(!ui.isChatPanelOpen)
        return
      }

      // Ctrl+P: 発表モードをトグル
      if (ctrl && e.key === 'p') {
        e.preventDefault()
        if (ui.presentationNodeIds.length > 0) ui.startPresentation()
        return
      }

      // モーダル・確認ダイアログ・右クリックメニュー・検索バー・エクスポートパネル表示中はキャンバス操作を抑制
      if (
        ui.isSettingsOpen ||
        ui.isMapListOpen ||
        ui.isExportPanelOpen ||
        ui.confirmDialog ||
        ui.contextMenu ||
        ui.isSearchOpen
      ) {
        return
      }

      // Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        map.undo()
        return
      }
      // Redo
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        map.redo()
        return
      }

      // Copy: 選択中ノードをクリップボードへ
      if (ctrl && e.key === 'c') {
        const selectedIds = map.nodes.filter((n) => n.selected).map((n) => n.id)
        if (selectedIds.length > 0) {
          e.preventDefault()
          map.copyNodes(selectedIds)
        }
        return
      }
      // Paste
      if (ctrl && e.key === 'v') {
        if (map.clipboard.nodes.length > 0) {
          e.preventDefault()
          map.paste()
        }
        return
      }

      // Delete / Backspace: 選択中のノード・エッジを削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSelection =
          map.nodes.some((n) => n.selected) || map.edges.some((edge) => edge.selected)
        if (hasSelection) {
          e.preventDefault()
          const activeNode = map.nodes.find((n) => n.id === ui.selectedNodeId)
          map.deleteSelected()
          // サイドパネルが指すノードが削除されたら選択を解除
          if (activeNode?.selected) ui.setSelectedNodeId(null)
        }
        return
      }

      // F2: 選択ノードをインライン編集開始
      if (e.key === 'F2' && ui.selectedNodeId) {
        e.preventDefault()
        ui.setEditingNodeId(ui.selectedNodeId)
        return
      }

      // Tab: 選択ノードに接続した子ノードを作成 → 作成直後に編集モード開始
      if (e.key === 'Tab' && ui.selectedNodeId) {
        e.preventDefault()
        const newId = map.addConnectedNode(ui.selectedNodeId)
        if (newId) {
          ui.setSelectedNodeId(newId)
          ui.setEditingNodeId(newId)
        }
        return
      }

      // Enter（修飾なし）: 選択ノードの兄弟ノードを追加 → 編集開始
      if (e.key === 'Enter' && !ctrl && !e.shiftKey && !e.altKey && ui.selectedNodeId) {
        e.preventDefault()
        const newId = map.addSiblingNode(ui.selectedNodeId)
        if (newId) {
          ui.setSelectedNodeId(newId)
          ui.setEditingNodeId(newId)
        }
        return
      }

      // 矢印キー: 方向別最近傍ノードへ選択を移動（修飾なし）
      if (
        (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        !ctrl && !e.shiftKey && !e.altKey &&
        ui.selectedNodeId
      ) {
        const currentNode = map.nodes.find((n) => n.id === ui.selectedNodeId)
        if (!currentNode) return

        // 絶対座標の中心を計算（親グループ内ノードも考慮）
        const parentNode = currentNode.parentId
          ? map.nodes.find((n) => n.id === currentNode.parentId)
          : null
        const absX = currentNode.position.x + (parentNode?.position.x ?? 0)
        const absY = currentNode.position.y + (parentNode?.position.y ?? 0)
        const cW = currentNode.measured?.width ?? 160
        const cH = currentNode.measured?.height ?? 60
        const cx = absX + cW / 2
        const cy = absY + cH / 2

        // ideaNode のみ候補にする
        const candidates = map.nodes.filter((n) => n.id !== ui.selectedNodeId && n.type !== 'groupNode')

        let bestId: string | null = null
        let bestDist = Infinity

        for (const candidate of candidates) {
          const pNode = candidate.parentId
            ? map.nodes.find((n) => n.id === candidate.parentId)
            : null
          const absCX = candidate.position.x + (pNode?.position.x ?? 0)
          const absCY = candidate.position.y + (pNode?.position.y ?? 0)
          const nW = candidate.measured?.width ?? 160
          const nH = candidate.measured?.height ?? 60
          const nx = absCX + nW / 2
          const ny = absCY + nH / 2
          const dx = nx - cx
          const dy = ny - cy
          const dist = Math.sqrt(dx * dx + dy * dy)

          // 方向フィルター（軸優先の円錐判定）
          let inDirection = false
          if (e.key === 'ArrowRight') inDirection = dx > 0 && Math.abs(dy) <= Math.abs(dx) * 1.2
          else if (e.key === 'ArrowLeft') inDirection = dx < 0 && Math.abs(dy) <= Math.abs(dx) * 1.2
          else if (e.key === 'ArrowDown') inDirection = dy > 0 && Math.abs(dx) <= Math.abs(dy) * 1.2
          else if (e.key === 'ArrowUp') inDirection = dy < 0 && Math.abs(dx) <= Math.abs(dy) * 1.2

          if (inDirection && dist < bestDist) {
            bestDist = dist
            bestId = candidate.id
          }
        }

        if (bestId) {
          e.preventDefault()
          map.selectOnlyNode(bestId)
          ui.setSelectedNodeId(bestId)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
