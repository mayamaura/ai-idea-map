import { useState } from 'react'
import { useSettingsStore, DEFAULT_CATEGORIES } from '@ideamap/core'

const PRESET_COLORS = [
  '#ffffff', '#e0e7ff', '#dbeafe', '#d1fae5',
  '#fef3c7', '#fce7f3', '#ffe4e6', '#f3f4f6',
  '#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8',
]

const PRESET_ICONS = ['💡', '❓', '✅', '📚', '❤️', '⚠️', '🎯', '💬', '🔍', '📌', '⭐', '🔑']

export function CategoryManager() {
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
              <div key={cat.id} className="border border-primary-300 dark:border-primary-600 rounded-lg p-2 space-y-2 bg-primary-50 dark:bg-primary-900/30">
                <div className="flex gap-2">
                  {/* アイコン選択 */}
                  <div className="relative">
                    <button
                      className="w-8 h-8 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-center text-base hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {}}
                    >
                      {editIcon}
                    </button>
                    <div className="absolute top-9 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 z-10 w-44">
                      {PRESET_ICONS.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => setEditIcon(icon)}
                          className={`w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${editIcon === icon ? 'bg-primary-100 dark:bg-primary-900/40' : ''}`}
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
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                    placeholder="カテゴリ名"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${editColor === c ? 'border-primary-500 scale-110' : 'border-gray-300 dark:border-gray-600'}`}
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
                    className="flex-1 py-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-500 transition-colors"
              style={{ backgroundColor: cat.color }}
            >
              <span className="text-sm leading-none">{cat.icon}</span>
              {/* 背景はカテゴリ色（明るいパステル）固定のため、文字色はダークでも暗いままにする */}
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
        <div className="border border-primary-300 dark:border-primary-600 rounded-lg p-2 space-y-2 bg-primary-50 dark:bg-primary-900/30">
          <div className="flex gap-2">
            <select
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-14 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-1 py-1 outline-none focus:border-primary-500 bg-white dark:bg-gray-700 dark:text-gray-100"
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
              className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 outline-none focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              placeholder="カテゴリ名"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${newColor === c ? 'border-primary-500 scale-110' : 'border-gray-300 dark:border-gray-600'}`}
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
              className="flex-1 py-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-1.5 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm rounded-lg hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          ＋ カテゴリを追加
        </button>
      )}
    </div>
  )
}
