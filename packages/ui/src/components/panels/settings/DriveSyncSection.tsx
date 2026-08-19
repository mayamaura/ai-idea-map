import { useState } from 'react'
import { useUIStore, useSettingsStore } from '@ideamap/core'

interface DriveSyncSectionProps {
  accessToken: string | null
}

export function DriveSyncSection({ accessToken }: DriveSyncSectionProps) {
  const { syncPassword, setMasterPassword, saveSettingsToDrive, loadSettingsFromDrive } = useSettingsStore()
  const { addToast } = useUIStore()
  const [passwordInput, setPasswordInput] = useState(syncPassword ? '••••••••' : '')
  const [isEditing, setIsEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handlePasswordSave = () => {
    if (passwordInput && !passwordInput.includes('•')) {
      setMasterPassword(passwordInput.trim())
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
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">マスターパスワード（ローカル暗号化 & Drive同期）</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        マスターパスワードでAPIキーを暗号化してブラウザに保存し、Driveへの同期にも使用します。別デバイスで同じパスワードを入力して読み込めます。パスワードはDriveに保存されません。
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">マスターパスワード</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword && isEditing ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                disabled={!isEditing}
                placeholder="パスワードを設定..."
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500"
              />
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200"
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
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                変更
              </button>
            )}
          </div>
        </div>

        {!syncPassword && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2">
            マスターパスワードを設定するとAPIキーを安全に保存し、Driveへの同期もできます
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
