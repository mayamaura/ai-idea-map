import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AISuggestion, SaveStatus } from '../types'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export type ContextMenuType = 'node' | 'edge' | 'pane'

export interface ContextMenuState {
  type: ContextMenuType
  /** 画面座標（メニュー表示位置） */
  x: number
  y: number
  /** node の場合はノードID、edge の場合はエッジID */
  targetId?: string
  /** pane の場合のフロー座標（新規ノード配置・貼り付け用） */
  flowPosition?: { x: number; y: number }
}

export interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

interface UIState {
  selectedNodeId: string | null
  isSettingsOpen: boolean
  isAIPanelOpen: boolean
  isMapListOpen: boolean
  isNodeDetailOpen: boolean
  nodeDetailId: string | null
  aiSuggestions: AISuggestion[]
  isAILoading: boolean
  saveStatus: SaveStatus
  mapTitle: string
  toasts: Toast[]
  contextMenu: ContextMenuState | null
  confirmDialog: ConfirmDialogState | null
  setSelectedNodeId: (id: string | null) => void
  setSettingsOpen: (open: boolean) => void
  setAIPanelOpen: (open: boolean) => void
  setMapListOpen: (open: boolean) => void
  openNodeDetail: (nodeId: string) => void
  closeNodeDetail: () => void
  setAISuggestions: (suggestions: AISuggestion[]) => void
  setAILoading: (loading: boolean) => void
  setSaveStatus: (status: SaveStatus) => void
  setMapTitle: (title: string) => void
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
  openContextMenu: (menu: ContextMenuState) => void
  closeContextMenu: () => void
  openConfirmDialog: (dialog: ConfirmDialogState) => void
  closeConfirmDialog: () => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  isSettingsOpen: false,
  isAIPanelOpen: false,
  isMapListOpen: false,
  isNodeDetailOpen: false,
  nodeDetailId: null,
  aiSuggestions: [],
  isAILoading: false,
  saveStatus: 'saved',
  mapTitle: '新しいマップ',
  toasts: [],
  contextMenu: null,
  confirmDialog: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setMapListOpen: (open) => set({ isMapListOpen: open }),
  openNodeDetail: (nodeId) => set({ isNodeDetailOpen: true, nodeDetailId: nodeId }),
  closeNodeDetail: () => set({ isNodeDetailOpen: false, nodeDetailId: null }),
  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
  setAILoading: (loading) => set({ isAILoading: loading }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setMapTitle: (title) => set({ mapTitle: title }),
  addToast: (message, type) => {
    const id = uuidv4()
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  openConfirmDialog: (dialog) => set({ confirmDialog: dialog }),
  closeConfirmDialog: () => set({ confirmDialog: null }),
}))
