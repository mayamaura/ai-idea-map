import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, AIModel, NodeShape } from '../types'
import { getStoredApiKey, setStoredApiKey } from '../utils/encryption'

interface SettingsState {
  apiKey: string
  aiModel: AIModel
  suggestionCount: number
  autoSave: boolean
  theme: Theme
  language: 'ja' | 'en'
  nodeShape: NodeShape
  setApiKey: (key: string) => void
  setAiModel: (model: AIModel) => void
  setSuggestionCount: (count: number) => void
  setAutoSave: (enabled: boolean) => void
  setTheme: (theme: Theme) => void
  setLanguage: (lang: 'ja' | 'en') => void
  setNodeShape: (shape: NodeShape) => void
  loadApiKey: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      aiModel: 'claude-sonnet-4-6',
      suggestionCount: 4,
      autoSave: true,
      theme: 'light',
      language: 'ja',
      nodeShape: 'rounded',

      setApiKey: (key) => {
        set({ apiKey: key })
        void setStoredApiKey(key)
      },
      setAiModel: (model) => set({ aiModel: model }),
      setSuggestionCount: (count) => set({ suggestionCount: count }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => set({ language: lang }),
      setNodeShape: (shape) => set({ nodeShape: shape }),

      loadApiKey: async () => {
        const key = await getStoredApiKey()
        set({ apiKey: key })
      },
    }),
    {
      name: 'ideamap-settings',
      // apiKey は暗号化ストレージで管理するため persist から除外
      partialize: (state) => ({
        aiModel: state.aiModel,
        suggestionCount: state.suggestionCount,
        autoSave: state.autoSave,
        theme: state.theme,
        language: state.language,
        nodeShape: state.nodeShape,
      }),
    }
  )
)
