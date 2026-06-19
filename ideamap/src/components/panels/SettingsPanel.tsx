import { useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore, DEFAULT_CATEGORIES } from '../../stores/settingsStore'
import type { AIModel } from '../../types'

interface DriveSyncSectionProps {
  accessToken: string | null
}

function DriveSyncSection({ accessToken }: DriveSyncSectionProps) {
  const { syncPassword, setSyncPassword, saveSettingsToDrive, loadSettingsFromDrive } = useSettingsStore()
  const { addToast } = useUIStore()
  const [passwordInput, setPasswordInput] = useState(syncPassword ? '••••••••' : '')
  const [isEditing, setIsEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handlePasswordSave = () => {
    if (passwordInput && !passwordInput.includes('•')) {
      setSyncPassword(passwordInput.trim())
      setPasswordInput('••••••••')
    }
    setIsEditing(false)
  }

  const handleSaveToDrive = async () => {
    if (!accessToken) {
      addToast('Googleドライブに接続してください', 'error')
      return
    }
    setIsSaving(true)
    try {
      await saveSettingsToDrive(accessToken)
      addToast('APIキーをDriveに保存しました', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Drive保存に失敗しました', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoadFromDrive = async () => {
    if (!accessToken) {
      addToast('Googleドライブに接続してください', 'error')
      return
    }
    setIsLoading(true)
    try {
      await loadSettingsFromDrive(accessToken)
      addToast('APIキーをDriveから読み込みました', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Drive読み込みに失敗しました', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">デバイス間でAPIキーを同期</h3>
      <p className="text-xs text-gray-400 mb-3">
        同期パスワードでAPIキーを暗号化してDriveに保存します。別デバイスで同じパスワードを入力して読み込めます。パスワードはDriveに保存されません。
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">同期パスワード</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword && isEditing ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                disabled={!isEditing}
                placeholder="パスワードを設定..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              )}
            </div>
            {isEditing ? (
              <button
                onClick={handlePasswordSave}
                className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
              >
                保存
              </button>
            ) : (
              <button
                onClick={() => { setPasswordInput(''); setIsEditing(true) }}
                className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                変更
              </button>
            )}
          </div>
        </div>

        {!syncPassword && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
            同期パスワードを設定するとDriveへの保存・読み込みができます
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => void handleSaveToDrive()}
            disabled={!syncPassword || !accessToken || isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving
              ? <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            }
            Driveに保存
          </button>
          <button
            onClick={() => void handleLoadFromDrive()}
            disabled={!syncPassword || !accessToken || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-primary-300 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading
              ? <div className="w-3.5 h-3.5 border border-primary-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            }
            Driveから読み込む
          </button>
        </div>
      </div>
    </section>
  )
}

const PRESET_COLORS = [
  '#ffffff', '#e0e7ff', '#dbeafe', '#d1fae5',
  '#fef3c7', '#fce7f3', '#ffe4e6', '#f3f4f6',
  '#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8',
]

const PRESET_ICONS = ['💡', '❓', '✅', '📚', '❤️', '⚠️', '🎯', '💬', '🔍', '📌', '⭐', '🔑']

function CategoryManager() {
  const { categories, addCategory, updateCategory, deleteCategory } = useSettingsStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#ffffff')
  const [editIcon, setEditIcon] = useState('💡')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#f3f4f6')
  const [newIcon, setNewIcon] = useState('💡')

  const isDefault = (id: string) => DEFAULT_CATEGORIES.some((d) => d.id === id)

  const startEdit = (id: string) => {
    const cat = categories.find((c) => c.id === id)
    if (!cat) return
    setEditingId(id)
    setEditName(cat.name)
    setEditColor(cat.color)
    setEditIcon(cat.icon)
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateCategory(editingId, { name: editName.trim(), color: editColor, icon: editIcon })
    setEditingId(null)
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    addCategory({ name: newName.trim(), color: newColor, icon: newIcon })
    setNewName('')
    setNewColor('#f3f4f6')
    setNewIcon('💡')
    setIsAdding(false)
  }

  return (
    <div className="space-y-2">
      <div className="max-h-60 overflow-y-auto space-y-1">
        {categories.map((cat) => {
          if (editingId === cat.id) {
            return (
              <div key={cat.id} className="border border-primary-300 rounded-lg p-2 space-y-2 bg-primary-50">
                <div className="flex gap-2">
                  {/* アイコン選択 */}
                  <div className="relative">
                    <button
                      className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center text-base hover:bg-gray-100"
                      onClick={() => {}}
                    >
                      {editIcon}
                    </button>
                    <div className="absolute top-9 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 z-10 w-44">
                      {PRESET_ICONS.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => setEditIcon(icon)}
                          className={`w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-gray-100 ${editIcon === icon ? 'bg-primary-100' : ''}`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-500"
                    placeholder="カテゴリ名"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${editColor === c ? 'border-primary-500 scale-110' : 'border-gray-300'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="flex-1 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 py-1 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              style={{ backgroundColor: cat.color }}
            >
              <span className="text-sm leading-none">{cat.icon}</span>
              <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
              <button
                onClick={() => startEdit(cat.id)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="編集"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              {!isDefault(cat.id) && (
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                  title="削除"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* 新規追加フォーム */}
      {isAdding ? (
        <div className="border border-primary-300 rounded-lg p-2 space-y-2 bg-primary-50">
          <div className="flex gap-2">
            <select
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-14 text-sm border border-gray-200 rounded-lg px-1 py-1 outline-none focus:border-primary-500 bg-white"
            >
              {PRESET_ICONS.map((icon) => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-500"
              placeholder="カテゴリ名"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${newColor === c ? 'border-primary-500 scale-110' : 'border-gray-300'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex-1 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              追加
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="flex-1 py-1 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-1.5 border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          ＋ カテゴリを追加
        </button>
      )}
    </div>
  )
}

interface SettingsPanelProps {
  accessToken: string | null
}

export function SettingsPanel({ accessToken }: SettingsPanelProps) {
  const { isSettingsOpen, setSettingsOpen } = useUIStore()
  const {
    apiKey, setApiKey,
    aiModel, setAiModel,
    suggestionCount, setSuggestionCount,
    autoSave, setAutoSave,
    edgeStyle, setEdgeStyle,
  } = useSettingsStore()

  const [keyInput, setKeyInput] = useState(apiKey ? '••••••••••••••••' : '')
  const [showKey, setShowKey] = useState(false)
  const [isEditingKey, setIsEditingKey] = useState(false)

  if (!isSettingsOpen) return null

  const handleKeySave = () => {
    if (keyInput && !keyInput.includes('•')) {
      setApiKey(keyInput.trim())
      setKeyInput('••••••••••••••••')
    }
    setIsEditingKey(false)
  }

  const handleKeyEdit = () => {
    setKeyInput('')
    setIsEditingKey(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">設定</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Claude API キー */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Claude API</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">APIキー</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey && isEditingKey ? 'text' : 'password'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      disabled={!isEditingKey}
                      placeholder="sk-ant-..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    {isEditingKey && (
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showKey
                          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    )}
                  </div>
                  {isEditingKey ? (
                    <button
                      onClick={handleKeySave}
                      className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      保存
                    </button>
                  ) : (
                    <button
                      onClick={handleKeyEdit}
                      className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      変更
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  キーはこのブラウザにのみ保存されます。サーバーには送信しません。
                </p>
                {!apiKey && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      ⚠️ APIキーが未設定です。AI拡張機能を使うには
                      <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
                        className="underline ml-0.5">Anthropic Console</a>
                      でキーを取得してください。
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">使用モデル</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value as AIModel)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary-500"
                >
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6（高品質）</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5（高速・低コスト）</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  AI提案数: <span className="font-medium text-gray-700">{suggestionCount}個</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={7}
                  value={suggestionCount}
                  onChange={(e) => setSuggestionCount(Number(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>3</span><span>7</span>
                </div>
              </div>
            </div>
          </section>

          {/* Drive同期 */}
          <DriveSyncSection accessToken={accessToken} />

          {/* カテゴリ管理 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">カテゴリ管理</h3>
            <p className="text-xs text-gray-400 mb-3">
              ノードをカテゴリで分類できます。デフォルトカテゴリは削除できません。
            </p>
            <CategoryManager />
          </section>

          {/* 外観 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">外観</h3>
            <label className="block text-xs text-gray-500 mb-1.5">エッジの形状</label>
            <div className="flex gap-2">
              {([
                { value: 'bezier', label: '曲線' },
                { value: 'smoothstep', label: '折れ線' },
                { value: 'straight', label: '直線' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEdgeStyle(opt.value)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    edgeStyle === opt.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* 保存設定 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">保存</h3>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-600">自動保存</span>
              <button
                role="switch"
                aria-checked={autoSave}
                onClick={() => setAutoSave(!autoSave)}
                className={`relative w-10 h-6 rounded-full transition-colors ${autoSave ? 'bg-primary-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSave ? 'translate-x-4' : ''}`} />
              </button>
            </label>
            <p className="text-xs text-gray-400 mt-1.5">
              Googleドライブにサインイン中は3秒後に自動保存します。未サインイン時はローカルストレージに保存します。
            </p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => setSettingsOpen(false)}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
