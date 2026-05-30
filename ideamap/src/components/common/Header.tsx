import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { SaveStatus } from '../../types'

const saveStatusLabel: Record<SaveStatus, { text: string; color: string }> = {
  saved: { text: '保存済み', color: 'text-green-500' },
  saving: { text: '保存中...', color: 'text-yellow-500' },
  unsaved: { text: '未保存', color: 'text-gray-400' },
  error: { text: '保存エラー', color: 'text-red-500' },
}

interface HeaderProps {
  isSignedIn: boolean
  isGoogleLoading: boolean
  onGoogleSignIn: () => void
  onGoogleSignOut: () => void
}

export function Header({
  isSignedIn,
  isGoogleLoading,
  onGoogleSignIn,
  onGoogleSignOut,
}: HeaderProps) {
  const { mapTitle, setMapTitle, saveStatus, setSettingsOpen, setMapListOpen } = useUIStore()
  const { theme, setTheme } = useSettingsStore()

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10 flex-shrink-0">
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
          <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm hidden sm:block">IdeaMap</span>
        </div>
        <input
          type="text"
          value={mapTitle}
          onChange={(e) => setMapTitle(e.target.value)}
          className="text-sm font-medium text-gray-700 dark:text-gray-200 bg-transparent border-none outline-none hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 rounded px-2 py-1 min-w-0 max-w-48 truncate"
          placeholder="マップタイトル"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs ${saveStatusLabel[saveStatus].color} hidden sm:block`}>
          {saveStatusLabel[saveStatus].text}
        </span>

        {/* Google Drive ボタン */}
        {isSignedIn ? (
          <>
            <button
              onClick={() => setMapListOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors hidden sm:flex"
              title="マップ一覧"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>マップ一覧</span>
            </button>
            <button
              onClick={() => setMapListOpen(true)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors sm:hidden"
              title="マップ一覧"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
            <button
              onClick={onGoogleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-600 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition-colors hidden sm:flex"
              title="Googleドライブ接続済み"
            >
              <GoogleIcon />
              <span>接続済み</span>
            </button>
          </>
        ) : (
          <button
            onClick={onGoogleSignIn}
            disabled={isGoogleLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Googleドライブに接続"
          >
            {isGoogleLoading ? (
              <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span className="hidden sm:block">
              {isGoogleLoading ? '接続中...' : 'Drive接続'}
            </span>
          </button>
        )}

        {/* テーマ切替ボタン */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
