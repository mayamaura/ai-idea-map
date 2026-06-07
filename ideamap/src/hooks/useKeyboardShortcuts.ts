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
      if (isEditing) return

      const ctrl = e.ctrlKey || e.metaKey
      const map = useMapStore.getState()
      const ui = useUIStore.getState()

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
        if (map.clipboard.length > 0) {
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

      // Tab: 選択ノードに接続した子ノードを作成
      if (e.key === 'Tab' && ui.selectedNodeId) {
        e.preventDefault()
        const newId = map.addConnectedNode(ui.selectedNodeId)
        if (newId) ui.setSelectedNodeId(newId)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
