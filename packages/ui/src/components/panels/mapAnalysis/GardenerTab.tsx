import type { GardenerSuggestion } from '@ideamap/core'
import { AILoadingIndicator } from '../../common/AILoadingIndicator'

interface GardenerTabProps {
  isLoading: boolean
  gardenerSuggestions: GardenerSuggestion[]
  appliedGardener: Set<number>
  getTitle: (id: string) => string
  onReviewMap: () => void
  onCancel: () => void
  onApply: (suggestion: GardenerSuggestion, idx: number) => void
}

/** ガーデナー提案の見た目・ラベルを kind ごとに出し分ける提案カード */
function GardenerCard({
  suggestion,
  applied,
  getTitle,
  onApply,
}: {
  suggestion: GardenerSuggestion
  applied: boolean
  getTitle: (id: string) => string
  onApply: () => void
}) {
  const KIND_LABEL: Record<GardenerSuggestion['kind'], string> = {
    deepen: '🌱 深掘り',
    merge: '🔗 統合',
    bridge: '🌉 橋渡し',
    question: '❓ 問いかけ',
  }

  return (
    <div
      className={`p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 space-y-2 transition-opacity ${
        applied ? 'opacity-50' : ''
      }`}
    >
      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{KIND_LABEL[suggestion.kind]}</p>

      {suggestion.kind === 'merge' ? (
        <div className="space-y-1">
          {suggestion.targetNodeIds.map((id) => (
            <p key={id} className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {getTitle(id)}
            </p>
          ))}
        </div>
      ) : suggestion.kind === 'bridge' ? (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
            {getTitle(suggestion.targetNodeIds[0] ?? '')}
          </span>
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
            {getTitle(suggestion.targetNodeIds[1] ?? '')}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          {suggestion.targetNodeIds[0] && (
            <p className="text-xs text-gray-500 dark:text-gray-400">対象: {getTitle(suggestion.targetNodeIds[0])}</p>
          )}
          {suggestion.title && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{suggestion.title}</p>
          )}
          {suggestion.body && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{suggestion.body}</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.reason}</p>

      <button
        onClick={onApply}
        disabled={applied}
        className="w-full py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {applied ? '適用済み' : '適用する'}
      </button>
    </div>
  )
}

/** 「ガーデナー」タブ。庭師の目でマップを見て、深掘り・統合・橋渡し・問いかけを提案する */
export function GardenerTab({
  isLoading,
  gardenerSuggestions,
  appliedGardener,
  getTitle,
  onReviewMap,
  onCancel,
  onApply,
}: GardenerTabProps) {
  return (
    <div className="p-5 space-y-4">
      <button
        onClick={onReviewMap}
        disabled={isLoading}
        className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'AI がレビュー中...' : 'マップをレビュー'}
      </button>

      {isLoading && (
        <AILoadingIndicator message="庭師の目でマップを見ています..." onCancel={onCancel} />
      )}

      {!isLoading && gardenerSuggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {gardenerSuggestions.length}件の提案があります
          </p>
          {gardenerSuggestions.map((suggestion, idx) => (
            <GardenerCard
              key={idx}
              suggestion={suggestion}
              applied={appliedGardener.has(idx)}
              getTitle={getTitle}
              onApply={() => onApply(suggestion, idx)}
            />
          ))}
        </div>
      )}

      {!isLoading && gardenerSuggestions.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          <span className="text-3xl mb-3 block">🌱</span>
          AIが庭師のようにマップを見て、深掘り・統合・橋渡し・問いかけを提案します
        </div>
      )}
    </div>
  )
}
