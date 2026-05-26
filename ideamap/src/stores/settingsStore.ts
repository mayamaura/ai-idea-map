import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, AIModel } from '../types'
import { getStoredApiKey, setStoredApiKey } from '../utils/encryption'

interface SettingsState {
  apiKey: string
  aiModel: AIModel
  suggestionCount: number
  autoSave: boolean
  theme: Theme
  language: 'ja' | 'en'
  googleClientId: string
  setApiKey: (key: string) => void
  setAiModel: (model: AIModel) => void
  setSuggestionCount: (count: number) => void
  setAutoSave: (enabled: boolean) => void
  setTheme: (theme: Theme) => void
  setLanguage: (lang: 'ja' | 'en') => void
  setGoogleClientId: (id: string) => void
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
      googleClientId: '',

      setApiKey: (key) => {
        set({ apiKey: key })
        void setStoredApiKey(key)
      },
      setAiModel: (model) => set({ aiModel: model }),
      setSuggestionCount: (count) => set({ suggestionCount: count }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => set({ language: lang }),
      setGoogleClientId: (id) => set({ googleClientId: id }),

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
        googleClientId: state.googleClientId,
      }),
    }
  )
)
