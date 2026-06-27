import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import type { SaveStatus } from '../../types'

const saveStatusLabel: Record<SaveStatus, { text: string; color: string }> = {
  saved: { text: '保存済み', color: 'text-green-500' },
  saving: { text: '保存中...', color: 'text-yellow-500' },
  unsaved: { text: '未保存', color: 'text-gray-400' },
  error: { text: '保存エラー', color: 'text-red-500' },
  conflict: { text: '競合あり', color: 'text-orange-500' },
}

interface HeaderProps {
  isSignedIn: boolean
  isGoogleLoading: boolean
  clientIdMissing: boolean
  userEmail: string | null
  onGoogleSignIn: () => void
  onGoogleSignOut: () => void
}

export function Header({
  isSignedIn,
  isGoogleLoading,
  clientIdMissing,
  userEmail,
  onGoogleSignIn,
  onGoogleSignOut,
}: HeaderProps) {
  const { mapTitle, setMapTitle, saveStatus, currentFileId, lastSavedAt, requestSave, setSettingsOpen, setMapListOpen, setAnalysisPanelOpen, setChatPanelOpen, setFileDashboardOpen, openConfirmDialog } = useUIStore()
  const { theme, setTheme } = useSettingsStore()
  const isOnline = useOnlineStatus()

  // 「接続済み」ドロップダウンメニュー
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  // メニュー外クリックで閉じる（Toolbar と同じパターン）
  useEffect(() => {
    if (!showAccountMenu) return
    const handler = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Element)) {
        setShowAccountMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAccountMenu])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const saveTarget = isSignedIn && currentFileId ? 'Drive' : 'ローカル'
  const lastSavedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null
  const saveTooltip = `${lastSavedTime ? `最終保存 ${lastSavedTime} / ` : ''}クリックで今すぐ保存`

  const handleSignOut = () => {
    setShowAccountMenu(false)
    openConfirmDialog({
      title: 'サインアウト',
      message: 'Googleドライブへの自動保存が停止します。編集内容はこの端末のローカルには保存され続けます。',
      confirmLabel: 'サインアウト',
      danger: true,
      onConfirm: onGoogleSignOut,
    })
  }

  return (
    <div className="flex-shrink-0 z-10">
      {/* オフラインバナー */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500 text-white text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a3 3 0 010-5.656M6.343 6.343a9 9 0 000 12.728m3.536-3.536a3 3 0 000-5.656" />
          </svg>
          オフライン — ローカルに保存中
        </div>
      )}
    <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
              <line x1="5" y1="11" x2="12" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="3" x2="19" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="11" x2="12" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="19" y1="11" x2="12" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="15" x2="12" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="19" x2="15" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="3" r="1.5" fill="white" />
              <circle cx="5" cy="11" r="1.5" fill="white" />
              <circle cx="19" cy="11" r="1.5" fill="white" />
              <circle cx="12" cy="15" r="2" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm hidden sm:block">IdeaMap</span>
        </div>
        <div className="flex items-center gap-1 group">
          <input
            type="text"
            value={mapTitle}
            onChange={(e) => setMapTitle(e.target.value)}
            className="text-sm font-medium text-gray-700 dark:text-gray-200 bg-transparent border-none outline-none hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 rounded px-2 py-1 min-w-0 max-w-32 sm:max-w-48 truncate"
            placeholder="マップタイトル"
          />
          <button
            onClick={() => setFileDashboardOpen(true)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="マップを切り替える"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => requestSave()}
          className={`text-xs ${saveStatusLabel[saveStatus].color} hidden sm:block cursor-pointer hover:underline`}
          title={saveTooltip}
        >
          {saveStatusLabel[saveStatus].text} · {saveTarget}
        </button>

        {/* Google Drive ボタン */}
        {isSignedIn ? (
          <>
            {/* モバイル用アイコンボタン（マップ一覧）は残す */}
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

            {/* デスクトップ: 「接続済み」ボタン → クリックでドロップダウン */}
            <div ref={accountMenuRef} className="relative hidden sm:block">
              <button
                onClick={() => setShowAccountMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-600 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                title="接続済み — クリックでメニュー"
              >
                <GoogleIcon />
                <span>接続済み</span>
                <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  {/* メールアドレス（クリック不可） */}
                  {userEmail && (
                    <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 truncate select-none">
                      {userEmail}
                    </div>
                  )}
                  <div className="border-t border-gray-100 dark:border-gray-700" />
                  {/* マップ一覧 */}
                  <button
                    onClick={() => { setShowAccountMenu(false); setMapListOpen(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    マップ一覧
                  </button>
                  {/* サインアウト */}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    サインアウト
                  </button>
                </div>
              )}
            </div>
          </>
        ) : clientIdMissing ? (
          <button
            disabled
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg opacity-70 cursor-not-allowed"
            title="VITE_GOOGLE_CLIENT_ID が設定されていません（管理者にお問い合わせください）"
          >
            <GoogleIcon />
            <span className="hidden sm:block">Drive未設定</span>
          </button>
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

        {/* AIチャットボタン */}
        <button
          onClick={() => setChatPanelOpen(true)}
          className="items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors hidden sm:flex"
          title="AIとチャット（Ctrl+Shift+C）"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>AIチャット</span>
        </button>
        <button
          onClick={() => setChatPanelOpen(true)}
          className="p-2 rounded-lg text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors sm:hidden"
          title="AIとチャット"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        {/* マップ分析ボタン */}
        <button
          onClick={() => setAnalysisPanelOpen(true)}
          className="items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors hidden sm:flex"
          title="AIでマップ全体を分析"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>マップ分析</span>
        </button>
        <button
          onClick={() => setAnalysisPanelOpen(true)}
          className="p-2 rounded-lg text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors sm:hidden"
          title="AIでマップ全体を分析"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>

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
    </div>
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
