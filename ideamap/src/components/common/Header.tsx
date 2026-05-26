import { useUIStore } from '../../stores/uiStore'
import type { SaveStatus } from '../../types'

const saveStatusLabel: Record<SaveStatus, { text: string; color: string }> = {
  saved: { text: '保存済み', color: 'text-green-500' },
  saving: { text: '保存中...', color: 'text-yellow-500' },
  unsaved: { text: '未保存', color: 'text-gray-400' },
  error: { text: '保存エラー', color: 'text-red-500' },
}

export function Header() {
  const { mapTitle, setMapTitle, saveStatus, setSettingsOpen } = useUIStore()

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm z-10 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="5" cy="12" r="2" strokeWidth="2" />
              <circle cx="19" cy="6" r="2" strokeWidth="2" />
              <circle cx="19" cy="18" r="2" strokeWidth="2" />
              <line x1="7" y1="12" x2="17" y2="7" strokeWidth="1.5" />
              <line x1="7" y1="12" x2="17" y2="17" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800 text-sm hidden sm:block">IdeaMap</span>
        </div>
        <input
          type="text"
          value={mapTitle}
          onChange={(e) => setMapTitle(e.target.value)}
          className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none hover:bg-gray-100 focus:bg-gray-100 rounded px-2 py-1 min-w-0 max-w-48 truncate"
          placeholder="マップタイトル"
        />
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-xs ${saveStatusLabel[saveStatus].color} hidden sm:block`}>
          {saveStatusLabel[saveStatus].text}
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="設定"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
