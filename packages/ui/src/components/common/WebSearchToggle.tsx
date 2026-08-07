import type { WebSearchResult } from '@ideamap/core'
import type { UseWebSearch } from '../../hooks/useWebSearch'
import { ExternalLink } from './ExternalLink'

interface WebSearchToggleProps {
  state: UseWebSearch
  /** APIキー未設定のときに設定画面へ誘導する */
  onOpenSettings: () => void
  disabled?: boolean
}

/** AIに聞く前にWeb検索するかを選ぶトグル。デスクトップ版でのみ描画される */
export function WebSearchToggle({ state, onOpenSettings, disabled }: WebSearchToggleProps) {
  if (!state.isAvailable) return null

  if (!state.isConfigured) {
    return (
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        🔎 Web検索を使うにはAPIキーの設定が必要です
      </button>
    )
  }

  return (
    <label
      className={`flex items-center gap-1.5 text-xs select-none ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      } ${state.enabled ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}
    >
      <input
        type="checkbox"
        checked={state.enabled}
        disabled={disabled}
        onChange={(e) => state.setEnabled(e.target.checked)}
        className="accent-primary-600"
      />
      🔎 Web検索で最新情報を使う
    </label>
  )
}

/** 直近の実行で参照した検索結果。クリックで既定ブラウザを開く */
export function WebSearchSources({ results }: { results: WebSearchResult[] }) {
  if (results.length === 0) return null
  return (
    <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
      <p>🔎 参照した情報源（{results.length}件）</p>
      <ul className="space-y-0.5">
        {results.map((r) => (
          <li key={r.url} className="truncate">
            <ExternalLink href={r.url} className="truncate max-w-full text-left block">
              {r.title || r.url}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
