import type { ConnectionSuggestion } from '@ideamap/core'
import { AILoadingIndicator } from '../../common/AILoadingIndicator'

interface ConnectionsTabProps {
  isLoading: boolean
  connectionSuggestions: ConnectionSuggestion[]
  dismissedConnections: Set<string>
  onFindConnections: () => void
  onCancel: () => void
  onApprove: (suggestion: ConnectionSuggestion) => void
  onReject: (key: string) => void
}

/** 「つながり」タブ。既存ノード間の隠れた接続候補をAIに探させる */
export function ConnectionsTab({
  isLoading,
  connectionSuggestions,
  dismissedConnections,
  onFindConnections,
  onCancel,
  onApprove,
  onReject,
}: ConnectionsTabProps) {
  const visibleConnections = connectionSuggestions.filter(
    (s) => !dismissedConnections.has(`${s.sourceId}:${s.targetId}`)
  )

  return (
    <div className="p-5 space-y-4">
      <button
        onClick={onFindConnections}
        disabled={isLoading}
        className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'AI が探索中...' : 'つながりを探す'}
      </button>

      {isLoading && (
        <AILoadingIndicator message="関連するノードを探しています..." onCancel={onCancel} />
      )}

      {!isLoading && visibleConnections.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {visibleConnections.length}件の接続候補が見つかりました
          </p>
          {visibleConnections.map((suggestion) => {
            const key = `${suggestion.sourceId}:${suggestion.targetId}`
            return (
              <div
                key={key}
                className="p-3 rounded-xl border border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 space-y-2"
              >
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
                    {suggestion.sourceTitle}
                  </span>
                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
                    {suggestion.targetTitle}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.reason}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(suggestion)}
                    className="flex-1 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    接続する
                  </button>
                  <button
                    onClick={() => onReject(key)}
                    className="flex-1 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    却下
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && connectionSuggestions.length > 0 && visibleConnections.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
          すべての提案を処理しました
        </div>
      )}

      {!isLoading && connectionSuggestions.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          <span className="text-3xl mb-3 block">🔗</span>
          ノード間の隠れたつながりをAIが探します
        </div>
      )}
    </div>
  )
}
