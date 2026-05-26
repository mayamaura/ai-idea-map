import { create } from 'zustand'
import type { AISuggestion, SaveStatus } from '../types'

interface UIState {
  selectedNodeId: string | null
  isSettingsOpen: boolean
  isAIPanelOpen: boolean
  isMapListOpen: boolean
  aiSuggestions: AISuggestion[]
  isAILoading: boolean
  saveStatus: SaveStatus
  mapTitle: string
  setSelectedNodeId: (id: string | null) => void
  setSettingsOpen: (open: boolean) => void
  setAIPanelOpen: (open: boolean) => void
  setMapListOpen: (open: boolean) => void
  setAISuggestions: (suggestions: AISuggestion[]) => void
  setAILoading: (loading: boolean) => void
  setSaveStatus: (status: SaveStatus) => void
  setMapTitle: (title: string) => void
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
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setMapListOpen: (open) => set({ isMapListOpen: open }),
  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
  setAILoading: (loading) => set({ isAILoading: loading }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setMapTitle: (title) => set({ mapTitle: title }),
}))
