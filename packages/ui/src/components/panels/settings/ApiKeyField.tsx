import { useState, type ReactNode } from 'react'

interface ApiKeyFieldProps {
  /** 保存済みキーの有無。マスク表示の初期値に使う */
  hasKey: boolean
  onSave: (key: string) => void
  placeholder: string
  /** マスターパスワード方式でロック中か。ロック中は入力欄の代わりに解錠ボタンを出す */
  locked: boolean
  onUnlockClick: () => void
  /** OSキーチェーンで保護されているか。保存先の案内文言をプロバイダ共通で出し分ける */
  isKeychainBacked: boolean
  /** 未設定時の注意書き・発行リンクなどプロバイダ固有の内容。フィールドの下に描画する */
  children?: ReactNode
}

/**
 * APIキー入力欄（ロック中の解錠ボタン分岐 / 表示切り替え / 保存・変更ボタン）。
 * Claude・OpenAI のどちらもマスターパスワードで保護される同じ仕組みなので共通化する。
 */
export function ApiKeyField({ hasKey, onSave, placeholder, locked, onUnlockClick, isKeychainBacked, children }: ApiKeyFieldProps) {
  const [keyInput, setKeyInput] = useState(hasKey ? '••••••••••••••••' : '')
  const [showKey, setShowKey] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = () => {
    if (keyInput && !keyInput.includes('•')) {
      onSave(keyInput.trim())
      setKeyInput('••••••••••••••••')
    }
    setIsEditing(false)
  }

  const handleEdit = () => {
    setKeyInput('')
    setIsEditing(true)
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">APIキー</label>
      {locked ? (
        // ロック中: 入力欄の代わりに解錠ボタンを表示
        <button
          onClick={onUnlockClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          🔒 ロックを解除してAPIキーを使う
        </button>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey && isEditing ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={!isEditing}
              placeholder={placeholder}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500"
            />
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showKey
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            )}
          </div>
          {isEditing ? (
            <button
              onClick={handleSave}
              className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
            >
              保存
            </button>
          ) : (
            <button
              onClick={handleEdit}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              変更
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
        {isKeychainBacked
          ? 'キーはこの端末のOSキーチェーンにのみ保存されます。サーバーには送信しません。'
          : 'キーはこのブラウザにのみ保存されます。サーバーには送信しません。'}
      </p>
      {children}
    </div>
  )
}
