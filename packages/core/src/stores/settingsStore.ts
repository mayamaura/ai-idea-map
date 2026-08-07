import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { getPlatform } from '@ideamap/platform'
import type { Theme, AIModelSelection, LLMProviderId, NodeShape, EdgeStyle, Category } from '../types'
import { encryptWithPassword, decryptWithPassword } from '../crypto/passwordCrypto'
import { DEFAULT_OLLAMA_BASE_URL } from '../llm/ollamaProvider'

/** SecretAdapter に渡す秘密情報の論理キー */
const API_KEY_SECRET = 'apiKey'
/** ollama.com の Web Search API キー。Claude APIキーとは別物なので別スロットで保管する */
const WEB_SEARCH_KEY_SECRET = 'webSearchApiKey'

/** クラウド上に置くアプリ設定ファイルの中身（Web版は Drive の IdeaMap/settings.json） */
export interface AppSettingsPayload {
  version: string
  encryptedApiKey: string
  salt: number[]
  model: string
  updatedAt: string
}

/**
 * 設定のクラウド同期。Google Drive はWeb版だけの機能なので core からは直接呼ばず、
 * apps/web が setAppSettingsSync() で実装を注入する（デスクトップ版は未注入のまま）。
 */
export interface AppSettingsSync {
  save(token: string, payload: AppSettingsPayload): Promise<void>
  load(token: string): Promise<AppSettingsPayload | null>
}

let appSettingsSync: AppSettingsSync | null = null

export function setAppSettingsSync(impl: AppSettingsSync | null): void {
  appSettingsSync = impl
}

function requireAppSettingsSync(): AppSettingsSync {
  if (!appSettingsSync) throw new Error('設定のクラウド同期はこの環境では利用できません')
  return appSettingsSync
}

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5'

/** Drive の設定ファイル（AppSettings）のスキーマ版。Phase 35 で Claude 専用であることを明示して 2.0 に上げた */
const APP_SETTINGS_VERSION = '2.0'

/**
 * 保存済み設定のモデルIDを現行IDへ読み替える。
 * localStorage（旧 'claude-sonnet-4-6'）と Drive 上の設定ファイルの両方が対象で、
 * 未知の値も既定モデルへ倒して不正なIDがAPIに渡るのを防ぐ。
 */
function normalizeClaudeModel(model: unknown): string {
  return model === 'claude-haiku-4-5-20251001' ? model : DEFAULT_CLAUDE_MODEL
}

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
  /** 使用するLLMプロバイダ。Web版は常に 'claude'（切り替えUIを出さない） */
  llmProvider: LLMProviderId
  claudeModel: string
  /** Ollama の使用モデル（/api/tags の name）。未選択は '' */
  ollamaModel: string
  ollamaBaseUrl: string
  /** ollama.com の Web Search APIキー。SecretAdapter に預けるので永続化はしない */
  webSearchApiKey: string
  /** AIに聞く前にWeb検索するか。3つのAI機能で共有するトグル */
  webSearchEnabled: boolean
  suggestionCount: number
  autoSave: boolean
  theme: Theme
  language: 'ja' | 'en'
  nodeShape: NodeShape
  categories: Category[]
  /** マスターパスワード（ローカル暗号化とDrive同期で共用）。永続化しない */
  syncPassword: string
  snapToGrid: boolean
  edgeStyle: EdgeStyle
  /** APIキーのロック状態。永続化しない */
  apiKeyLock: 'none' | 'locked' | 'unlocked'
  /** 旧形式移行後またはパスワード未設定でキー入力時に設定促進。永続化しない */
  needsMasterPasswordSetup: boolean
  /** 「スキップ」で設定促進を非表示にするセッションフラグ。永続化しない */
  masterPasswordPromptDismissed: boolean

  setApiKey: (key: string) => void
  setLlmProvider: (provider: LLMProviderId) => void
  setClaudeModel: (model: string) => void
  setOllamaModel: (model: string) => void
  setOllamaBaseUrl: (url: string) => void
  setWebSearchApiKey: (key: string) => void
  setWebSearchEnabled: (enabled: boolean) => void
  /** llmProvider に応じて claudeModel / ollamaModel のどちらかを返す */
  getActiveModelSelection: () => AIModelSelection
  setSuggestionCount: (count: number) => void
  setAutoSave: (enabled: boolean) => void
  setTheme: (theme: Theme) => void
  setLanguage: (lang: 'ja' | 'en') => void
  setNodeShape: (shape: NodeShape) => void
  /** マスターパスワードを設定する（旧 setSyncPassword を置換）。メモリ上の apiKey があれば新形式へ再暗号化 */
  setMasterPassword: (password: string) => void
  setSnapToGrid: (v: boolean) => void
  setEdgeStyle: (v: EdgeStyle) => void
  addCategory: (category: Omit<Category, 'id'>) => string
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void
  deleteCategory: (id: string) => void
  getCategoryById: (id: string) => Category | undefined
  /** 起動時に呼ぶ（旧 loadApiKey を置換）。旧形式の自動移行を含む */
  initApiKey: () => Promise<void>
  /** マスターパスワードでAPIキーを復号し apiKeyLock を 'unlocked' にする */
  unlockApiKey: (password: string) => Promise<boolean>
  /** MasterPasswordModal の「スキップ」ボタン用 */
  dismissMasterPasswordPrompt: () => void
  saveSettingsToDrive: (token: string) => Promise<void>
  loadSettingsFromDrive: (token: string) => Promise<void>
}

/** localStorage に永続化する項目（APIキー・パスワード・一時状態は含めない） */
type PersistedSettings = Pick<
  SettingsState,
  | 'llmProvider'
  | 'claudeModel'
  | 'ollamaModel'
  | 'ollamaBaseUrl'
  | 'webSearchEnabled'
  | 'suggestionCount'
  | 'autoSave'
  | 'theme'
  | 'language'
  | 'nodeShape'
  | 'categories'
  | 'snapToGrid'
  | 'edgeStyle'
>

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: '',
      llmProvider: 'claude',
      claudeModel: DEFAULT_CLAUDE_MODEL,
      ollamaModel: '',
      ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
      webSearchApiKey: '',
      webSearchEnabled: false,
      suggestionCount: 4,
      autoSave: true,
      theme: 'light',
      language: 'ja',
      nodeShape: 'rounded',
      categories: DEFAULT_CATEGORIES,
      syncPassword: '',
      snapToGrid: false,
      edgeStyle: 'bezier',
      apiKeyLock: 'none',
      needsMasterPasswordSetup: false,
      masterPasswordPromptDismissed: false,

      setApiKey: (key) => {
        const { syncPassword } = get()
        const { secret } = getPlatform()
        if (!key) {
          set({ apiKey: '', apiKeyLock: 'none' })
          void secret.clearSecret(API_KEY_SECRET)
          return
        }
        if (secret.isPassphraseFree) {
          // OSキーチェーン（デスクトップ版）は OS ログインで保護済みなので、
          // マスターパスワードを介さずそのまま預ける
          void secret.setSecret(API_KEY_SECRET, key).then(() => {
            set({ apiKey: key, apiKeyLock: 'unlocked', needsMasterPasswordSetup: false })
          })
          return
        }
        if (syncPassword) {
          void secret.setSecret(API_KEY_SECRET, key, syncPassword).then(() => {
            set({ apiKey: key, apiKeyLock: 'unlocked', needsMasterPasswordSetup: false })
          })
        } else {
          // マスターパスワード未設定: メモリのみで保持し設定を促す
          set({ apiKey: key, apiKeyLock: 'unlocked', needsMasterPasswordSetup: true })
        }
      },

      setLlmProvider: (provider) => set({ llmProvider: provider }),
      setClaudeModel: (model) => set({ claudeModel: model }),
      setOllamaModel: (model) => set({ ollamaModel: model }),
      setOllamaBaseUrl: (url) => set({ ollamaBaseUrl: url }),

      setWebSearchApiKey: (key) => {
        const { secret } = getPlatform()
        set({ webSearchApiKey: key, ...(key ? {} : { webSearchEnabled: false }) })
        // Web検索はデスクトップ版専用機能。マスターパスワード方式のプラットフォーム（Web版）では
        // 保管先を持たせず、UIも出さない
        if (!secret.isPassphraseFree) return
        if (key) void secret.setSecret(WEB_SEARCH_KEY_SECRET, key)
        else void secret.clearSecret(WEB_SEARCH_KEY_SECRET)
      },

      setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),

      getActiveModelSelection: () => {
        const { llmProvider, claudeModel, ollamaModel } = get()
        return {
          provider: llmProvider,
          model: llmProvider === 'ollama' ? ollamaModel : claudeModel,
        }
      },

      setSuggestionCount: (count) => set({ suggestionCount: count }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => set({ language: lang }),
      setNodeShape: (shape) => set({ nodeShape: shape }),

      setMasterPassword: (password) => {
        const { apiKey } = get()
        const { secret } = getPlatform()
        set({ syncPassword: password })
        if (apiKey) {
          // メモリ上の apiKey を新形式で再暗号化して旧形式を削除
          void secret.setSecret(API_KEY_SECRET, apiKey, password).then(async () => {
            await secret.clearLegacySecret(API_KEY_SECRET)
            set({ needsMasterPasswordSetup: false, apiKeyLock: 'unlocked' })
          })
        } else {
          set({ needsMasterPasswordSetup: false })
        }
      },

      setSnapToGrid: (v) => set({ snapToGrid: v }),
      setEdgeStyle: (v) => set({ edgeStyle: v }),

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

      initApiKey: async () => {
        const { secret } = getPlatform()
        if (secret.isPassphraseFree) {
          // Web検索キーはマスターパスワードを持たないプラットフォーム（＝OSキーチェーン）でのみ扱う
          const searchKey = await secret.getSecret(WEB_SEARCH_KEY_SECRET)
          if (searchKey) set({ webSearchApiKey: searchKey })
          // 解錠の概念が無いので起動時にそのまま読み出す。
          // apiKeyLock を 'locked' にしないことで MasterPasswordModal は一度も出ない
          const key = await secret.getSecret(API_KEY_SECRET)
          set({
            apiKey: key ?? '',
            apiKeyLock: key ? 'unlocked' : 'none',
            needsMasterPasswordSetup: false,
          })
          return
        }
        if (await secret.hasSecret(API_KEY_SECRET)) {
          // 新形式キーあり: ロック状態にしてモーダルが解錠を促す
          set({ apiKeyLock: 'locked' })
        } else if (await secret.hasLegacySecret(API_KEY_SECRET)) {
          // 旧形式キーあり: 自動移行（ハードコード鍵で透過復号してメモリに展開）
          const key = await secret.getLegacySecret(API_KEY_SECRET)
          if (key) {
            set({ apiKey: key, apiKeyLock: 'unlocked', needsMasterPasswordSetup: true })
            // 旧キーは再暗号化成功（setMasterPassword 呼び出し）後に削除する
          } else {
            set({ apiKeyLock: 'none' })
          }
        } else {
          set({ apiKeyLock: 'none' })
        }
      },

      unlockApiKey: async (password) => {
        try {
          const key = await getPlatform().secret.getSecret(API_KEY_SECRET, password)
          set({ apiKey: key ?? '', syncPassword: password, apiKeyLock: 'unlocked' })
          return true
        } catch {
          return false
        }
      },

      dismissMasterPasswordPrompt: () => {
        set({ masterPasswordPromptDismissed: true })
      },

      saveSettingsToDrive: async (token: string) => {
        const { apiKey, claudeModel, syncPassword } = get()
        if (!syncPassword) throw new Error('マスターパスワードが設定されていません')
        if (!apiKey) throw new Error('APIキーが設定されていません')
        const { encrypted, salt } = await encryptWithPassword(apiKey, syncPassword)
        // Ollama のURL・モデルは端末ローカルのサービスを指すため同期しない（別PCで復元しても意味がない）
        await requireAppSettingsSync().save(token, {
          version: APP_SETTINGS_VERSION,
          encryptedApiKey: encrypted,
          salt,
          model: claudeModel,
          updatedAt: new Date().toISOString(),
        })
      },

      loadSettingsFromDrive: async (token: string) => {
        const { syncPassword } = get()
        if (!syncPassword) throw new Error('マスターパスワードが設定されていません')
        const settings = await requireAppSettingsSync().load(token)
        if (!settings) throw new Error('Driveに設定ファイルが見つかりません')
        const apiKey = await decryptWithPassword(settings.encryptedApiKey, syncPassword, settings.salt)
        get().setApiKey(apiKey)
        // model フィールドの意味（Claudeのモデル名）は 1.0 と 2.0 で同じなので version による分岐は不要
        if (settings.model) set({ claudeModel: normalizeClaudeModel(settings.model) })
      },
    }),
    {
      name: 'ideamap-settings',
      // 保存先は StorageAdapter（Web=localStorage / Desktop=tauri-plugin-store）。
      // 非同期なので zustand の自動ハイドレーションでは初回描画がテーマ既定値（light）で
      // 走ってちらつく。skipHydration で自動復元を止め、各アプリの main.tsx が
      // restorePersistedState() を await してからレンダーする（stores/bootstrap.ts）
      storage: createJSONStorage(() => ({
        getItem: (name) => getPlatform().storage.getItem(name),
        setItem: (name, value) => getPlatform().storage.setItem(name, value),
        removeItem: (name) => getPlatform().storage.removeItem(name),
      })),
      skipHydration: true,
      // v0（バージョン未指定）: 廃止済みモデルIDが残るため読み替える
      // v1 → v2: Claude専用の aiModel を llmProvider + claudeModel + Ollama設定に分割する
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<PersistedSettings> & { aiModel?: unknown }
        const { aiModel, ...rest } = state
        // 旧 aiModel をそのまま claudeModel に移し、llmProvider は 'claude' 固定で入れる。
        // これで既存ユーザーはアップデート後も何もせず Claude を使い続けられる
        return {
          ...rest,
          llmProvider: 'claude',
          claudeModel: normalizeClaudeModel(rest.claudeModel ?? aiModel),
          ollamaModel: rest.ollamaModel ?? '',
          ollamaBaseUrl: rest.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
        } as PersistedSettings
      },
      partialize: (state): PersistedSettings => ({
        llmProvider: state.llmProvider,
        claudeModel: state.claudeModel,
        ollamaModel: state.ollamaModel,
        ollamaBaseUrl: state.ollamaBaseUrl,
        webSearchEnabled: state.webSearchEnabled,
        suggestionCount: state.suggestionCount,
        autoSave: state.autoSave,
        theme: state.theme,
        language: state.language,
        nodeShape: state.nodeShape,
        categories: state.categories,
        snapToGrid: state.snapToGrid,
        edgeStyle: state.edgeStyle,
        // apiKey / syncPassword / apiKeyLock / needsMasterPasswordSetup / masterPasswordPromptDismissed は永続化しない
      }),
    }
  )
)
