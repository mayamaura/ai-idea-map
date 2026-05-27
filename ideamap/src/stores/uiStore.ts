import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AISuggestion, SaveStatus } from '../types'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface UIState {
  selectedNodeId: string | null
  isSettingsOpen: boolean
  isAIPanelOpen: boolean
  isMapListOpen: boolean
  aiSuggestions: AISuggestion[]
  isAILoading: boolean
  saveStatus: SaveStatus
  mapTitle: string
  toasts: Toast[]
  setSelectedNodeId: (id: string | null) => void
  setSettingsOpen: (open: boolean) => void
  setAIPanelOpen: (open: boolean) => void
  setMapListOpen: (open: boolean) => void
  setAISuggestions: (suggestions: AISuggestion[]) => void
  setAILoading: (loading: boolean) => void
  setSaveStatus: (status: SaveStatus) => void
  setMapTitle: (title: string) => void
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  isSettingsOpen: false,
  isAIPanelOpen: false,
  isMapListOpen: false,
  aiSuggestions: [],
  isAILoading: false,
  saveStatus: 'saved',
  mapTitle: '新しいマップ',
  toasts: [],
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setMapListOpen: (open) => set({ isMapListOpen: open }),
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
}))
