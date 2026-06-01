import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Theme, AIModel, NodeShape, Category } from '../types'
import { getStoredApiKey, setStoredApiKey, encryptWithPassword, decryptWithPassword } from '../utils/encryption'
import { saveAppSettings, loadAppSettings } from '../services/googleDriveService'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-main', name: 'メインアイデア', color: '#e0e7ff', icon: '💡', description: 'マップの核心' },
  { id: 'cat-question', name: '問い・疑問', color: '#fef3c7', icon: '❓', description: '未解決の問い' },
  { id: 'cat-action', name: 'アクション', color: '#d1fae5', icon: '✅', description: '実行すべきタスク' },
  { id: 'cat-info', name: '参考・情報', color: '#dbeafe', icon: '📚', description: '参照情報' },
  { id: 'cat-emotion', name: '感情・直感', color: '#fce7f3', icon: '❤️', description: '感情的な気づき' },
  { id: 'cat-risk', name: '懸念・リスク', color: '#ffe4e6', icon: '⚠️', description: '問題点・課題' },
  { id: 'cat-none', name: '未分類', color: '#ffffff', icon: '○', description: 'デフォルト' },
]

interface SettingsState {
  apiKey: string
  aiModel: AIModel
  suggestionCount: number
  autoSave: boolean
  theme: Theme
  language: 'ja' | 'en'
  nodeShape: NodeShape
  categories: Category[]
  syncPassword: string
  setApiKey: (key: string) => void
  setAiModel: (model: AIModel) => void
  setSuggestionCount: (count: number) => void
  setAutoSave: (enabled: boolean) => void
  setTheme: (theme: Theme) => void
  setLanguage: (lang: 'ja' | 'en') => void
  setNodeShape: (shape: NodeShape) => void
  setSyncPassword: (password: string) => void
  addCategory: (category: Omit<Category, 'id'>) => string
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void
  deleteCategory: (id: string) => void
  getCategoryById: (id: string) => Category | undefined
  loadApiKey: () => Promise<void>
  saveSettingsToDrive: (token: string) => Promise<void>
  loadSettingsFromDrive: (token: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: '',
      aiModel: 'claude-sonnet-4-6',
      suggestionCount: 4,
      autoSave: true,
      theme: 'light',
      language: 'ja',
      nodeShape: 'rounded',
      categories: DEFAULT_CATEGORIES,
      syncPassword: '',

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
      setSyncPassword: (password) => set({ syncPassword: password }),

      addCategory: (category) => {
        const id = uuidv4()
        set((state) => ({ categories: [...state.categories, { ...category, id }] }))
        return id
      },

      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      deleteCategory: (id) =>
        set((state) => ({
          // デフォルトカテゴリは削除不可
          categories: state.categories.filter(
            (c) => c.id !== id || DEFAULT_CATEGORIES.some((d) => d.id === id)
          ),
        })),

      getCategoryById: (id) => get().categories.find((c) => c.id === id),

      loadApiKey: async () => {
        const key = await getStoredApiKey()
        set({ apiKey: key })
      },

      saveSettingsToDrive: async (token: string) => {
        const { apiKey, aiModel, syncPassword } = get()
        if (!syncPassword) throw new Error('同期パスワードが設定されていません')
        if (!apiKey) throw new Error('APIキーが設定されていません')
        const { encrypted, salt } = await encryptWithPassword(apiKey, syncPassword)
        await saveAppSettings(token, {
          version: '1.0',
          encryptedApiKey: encrypted,
          salt,
          model: aiModel,
          updatedAt: new Date().toISOString(),
        })
      },

      loadSettingsFromDrive: async (token: string) => {
        const { syncPassword } = get()
        if (!syncPassword) throw new Error('同期パスワードが設定されていません')
        const settings = await loadAppSettings(token)
        if (!settings) throw new Error('Driveに設定ファイルが見つかりません')
        const apiKey = await decryptWithPassword(settings.encryptedApiKey, syncPassword, settings.salt)
        get().setApiKey(apiKey)
        if (settings.model) set({ aiModel: settings.model as AIModel })
      },
    }),
    {
      name: 'ideamap-settings',
      partialize: (state) => ({
        aiModel: state.aiModel,
        suggestionCount: state.suggestionCount,
        autoSave: state.autoSave,
        theme: state.theme,
        language: state.language,
        nodeShape: state.nodeShape,
        categories: state.categories,
      }),
    }
  )
)
