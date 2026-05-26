import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, AIModel } from '../types'

interface SettingsState {
  apiKey: string
  aiModel: AIModel
  suggestionCount: number
  autoSave: boolean
  theme: Theme
  language: 'ja' | 'en'
  setApiKey: (key: string) => void
  setAiModel: (model: AIModel) => void
  setSuggestionCount: (count: number) => void
  setAutoSave: (enabled: boolean) => void
  setTheme: (theme: Theme) => void
  setLanguage: (lang: 'ja' | 'en') => void
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
      setApiKey: (key) => set({ apiKey: key }),
      setAiModel: (model) => set({ aiModel: model }),
      setSuggestionCount: (count) => set({ suggestionCount: count }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'ideamap-settings',
    }
  )
)
