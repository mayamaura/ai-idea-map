import type { Category, ClusterSuggestion } from '@ideamap/core'
import { AILoadingIndicator } from '../../common/AILoadingIndicator'

interface ClustersTabProps {
  isLoading: boolean
  clusterSuggestions: ClusterSuggestion[]
  appliedClusters: Set<number>
  getCategoryById: (id: string) => Category | undefined
  onSuggestClusters: () => void
  onCancel: () => void
  onApply: (cluster: ClusterSuggestion, idx: number) => void
}

/** 「グループ」タブ。テーマ別にノードをまとめ、カテゴリを一括適用する提案を出す */
export function ClustersTab({
  isLoading,
  clusterSuggestions,
  appliedClusters,
  getCategoryById,
  onSuggestClusters,
  onCancel,
  onApply,
}: ClustersTabProps) {
  return (
    <div className="p-5 space-y-4">
      <button
        onClick={onSuggestClusters}
        disabled={isLoading}
        className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'AI が分類中...' : 'グループ化を提案'}
      </button>

      {isLoading && (
        <AILoadingIndicator message="ノードを分類しています..." onCancel={onCancel} />
      )}

      {!isLoading && clusterSuggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {clusterSuggestions.length}グループの提案があります。カテゴリを一括適用できます。
          </p>
          {clusterSuggestions.map((cluster, idx) => {
            const cat = getCategoryById(cluster.categoryId)
            const applied = appliedClusters.has(idx)
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border space-y-2 transition-opacity ${
                  applied ? 'opacity-50' : ''
                }`}
                style={{ borderColor: cat?.color ?? '#e5e7eb', backgroundColor: `${cat?.color ?? '#f9fafb'}40` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {cat && <span className="text-base leading-none">{cat.icon}</span>}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{cluster.groupName}</span>
                    {cat && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">→ {cat.name}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{cluster.nodeIds.length}件</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cluster.nodeTitles.map((title, i) => (
                    <span
                      key={i}
                      className="inline-block text-xs px-2 py-0.5 bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    >
                      {title}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => onApply(cluster, idx)}
                  disabled={applied}
                  className="w-full py-1.5 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {applied ? '適用済み' : 'カテゴリを一括適用'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && clusterSuggestions.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          <span className="text-3xl mb-3 block">🗂</span>
          AIがノードをテーマ別にグループ分けして、カテゴリを提案します
        </div>
      )}
    </div>
  )
}
