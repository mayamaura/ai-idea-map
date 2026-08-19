import type { MapAnalysis, WebSearchResult } from '@ideamap/core'
import { WebSearchToggle, WebSearchSources } from '../../common/WebSearchToggle'
import { AILoadingIndicator } from '../../common/AILoadingIndicator'
import type { UseWebSearch } from '../../../hooks/useWebSearch'

interface AnalysisTabProps {
  webSearch: UseWebSearch
  isLoading: boolean
  mapAnalysis: MapAnalysis | null
  searchSources: WebSearchResult[]
  onAnalyze: () => void
  onCancel: () => void
  onOpenSettings: () => void
  copyToClipboard: (text: string) => Promise<void>
}

/** 「全体分析」タブ。マップ全体のテーマ・見落とし領域・重要ノードを要約する */
export function AnalysisTab({
  webSearch,
  isLoading,
  mapAnalysis,
  searchSources,
  onAnalyze,
  onCancel,
  onOpenSettings,
  copyToClipboard,
}: AnalysisTabProps) {
  const analysisText = mapAnalysis
    ? [
        `【主要テーマ】\n${mapAnalysis.summary}`,
        mapAnalysis.missingAreas.length > 0
          ? `【見落としているかもしれない領域】\n${mapAnalysis.missingAreas.map((a) => `・${a}`).join('\n')}`
          : null,
        mapAnalysis.importantNodeTitles.length > 0
          ? `【重要度の高いノード】\n${mapAnalysis.importantNodeTitles.map((t) => `・${t}`).join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : ''

  return (
    <div className="p-5 space-y-4">
      {/* Web検索は「見落としている領域」の指摘に効くので全体分析タブにだけ置く */}
      <WebSearchToggle state={webSearch} disabled={isLoading} onOpenSettings={onOpenSettings} />
      <button
        onClick={onAnalyze}
        disabled={isLoading}
        className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'AI が分析中...' : 'マップ全体を分析'}
      </button>

      {isLoading && (
        <AILoadingIndicator message="マップを読み取っています..." onCancel={onCancel} />
      )}

      {mapAnalysis && !isLoading && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">主要テーマ</p>
            <p className="text-sm text-gray-700 dark:text-gray-200">{mapAnalysis.summary}</p>
          </div>

          {mapAnalysis.missingAreas.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">見落としているかもしれない領域</p>
              <ul className="space-y-1">
                {mapAnalysis.missingAreas.map((area, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-1.5">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mapAnalysis.importantNodeTitles.length > 0 && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">重要度の高いノード</p>
              <ul className="space-y-1">
                {mapAnalysis.importantNodeTitles.map((title, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">★</span>
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => void copyToClipboard(analysisText)}
            className="w-full py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            分析結果をコピー
          </button>

          <WebSearchSources results={searchSources} />
        </div>
      )}

      {!mapAnalysis && !isLoading && (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          <span className="text-3xl mb-3 block">📊</span>
          ボタンを押してマップ全体を分析します
        </div>
      )}
    </div>
  )
}
