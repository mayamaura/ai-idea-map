import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore } from '../../stores/uiStore'
import { clearStoredApiKey } from '../../utils/encryption'

interface InnerProps {
  isUnlockMode: boolean
  onDismiss: () => void
  onUnlock: (pw: string) => Promise<boolean>
  onSetup: (pw: string) => void
  onForgotPassword: () => void
}

// 状態をマウント単位で持つことでモーダルが再表示されるたびにリセットされる
function ModalContent({ isUnlockMode, onDismiss, onUnlock, onSetup, onForgotPassword }: InnerProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setIsLoading(true)
    setError('')
    const ok = await onUnlock(password)
    setIsLoading(false)
    if (!ok) {
      setError('パスワードが正しくありません。再度入力してください。')
    }
  }

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    onSetup(password)
  }

  const eyeOffIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
  const eyeOnIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )

  const passwordField = (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError('') }}
        placeholder={isUnlockMode ? 'マスターパスワード' : 'マスターパスワードを設定'}
        autoFocus
        className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {showPassword ? eyeOffIcon : eyeOnIcon}
      </button>
    </div>
  )

  if (isUnlockMode) {
    return (
      <form onSubmit={(e) => void handleUnlock(e)}>
        <div className="px-6 pt-6 pb-2">
          <div className="text-3xl mb-3 text-center">🔒</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-1">
            APIキーのロックを解除
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-4">
            マスターパスワードを入力してAI機能を有効にしてください。
          </p>
          {passwordField}
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="px-6 pb-5 pt-3 flex flex-col gap-2">
          <button
            type="submit"
            disabled={!password || isLoading}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            ロックを解除
          </button>
          <div className="flex justify-between text-xs">
            <button
              type="button"
              onClick={onDismiss}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              スキップ（AI機能なしで使う）
            </button>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-primary-500 hover:text-primary-700 transition-colors"
            >
              パスワードを忘れた場合
            </button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSetup}>
      <div className="px-6 pt-6 pb-2">
        <div className="text-3xl mb-3 text-center">🛡️</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-1">
          マスターパスワードを設定
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-4">
          APIキーを安全に保護するためにマスターパスワードを設定してください。設定後はリロード時にこのパスワードで復号します。スキップするとAIキーはこのセッションのみ有効です。
        </p>
        {passwordField}
      </div>
      <div className="px-6 pb-5 pt-3 flex flex-col gap-2">
        <button
          type="submit"
          disabled={!password}
          className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          設定する
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
        >
          スキップ（このセッションのみAI機能を使う）
        </button>
      </div>
    </form>
  )
}

export function MasterPasswordModal() {
  const apiKeyLock = useSettingsStore((s) => s.apiKeyLock)
  const needsMasterPasswordSetup = useSettingsStore((s) => s.needsMasterPasswordSetup)
  const masterPasswordPromptDismissed = useSettingsStore((s) => s.masterPasswordPromptDismissed)
  const unlockApiKey = useSettingsStore((s) => s.unlockApiKey)
  const setMasterPassword = useSettingsStore((s) => s.setMasterPassword)
  const dismissMasterPasswordPrompt = useSettingsStore((s) => s.dismissMasterPasswordPrompt)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  const isUnlockMode = apiKeyLock === 'locked' && !masterPasswordPromptDismissed
  const isSetupMode = apiKeyLock !== 'locked' && needsMasterPasswordSetup && !masterPasswordPromptDismissed
  const isVisible = isUnlockMode || isSetupMode

  const handleForgotPassword = () => {
    clearStoredApiKey()
    useSettingsStore.setState({ apiKeyLock: 'none', masterPasswordPromptDismissed: false })
    setSettingsOpen(true)
  }

  if (!isVisible) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalContent
          isUnlockMode={isUnlockMode}
          onDismiss={dismissMasterPasswordPrompt}
          onUnlock={unlockApiKey}
          onSetup={setMasterPassword}
          onForgotPassword={handleForgotPassword}
        />
      </div>
    </div>,
    document.body
  )
}
