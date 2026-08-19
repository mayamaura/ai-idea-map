import type { ChangeEvent, RefObject } from 'react'
import type { LLMProviderId } from '@ideamap/core'
import { ApiKeyRequired } from '../../common/ApiKeyRequired'

export type BrainDumpTarget = 'new' | 'append'

interface ImportTabProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileImport: (e: ChangeEvent<HTMLInputElement>) => void
  pasteText: string
  onPasteTextChange: (value: string) => void
  onPasteImport: () => void
  brainDumpEnabled: boolean
  onBrainDumpEnabledChange: (value: boolean) => void
  isReady: boolean
  providerId: LLMProviderId
  onOpenSettings: () => void
  brainDumpText: string
  onBrainDumpTextChange: (value: string) => void
  isBrainDumpLoading: boolean
  brainDumpTarget: BrainDumpTarget
  onBrainDumpTargetChange: (target: BrainDumpTarget) => void
  onBrainDumpExtract: () => void
  onCancelBrainDump: () => void
}

/** 「インポート」タブ。JSONファイル読み込み・テキスト貼り付け・AIブレインダンプ構造化 */
export function ImportTab({
  fileInputRef,
  onFileImport,
  pasteText,
  onPasteTextChange,
  onPasteImport,
  brainDumpEnabled,
  onBrainDumpEnabledChange,
  isReady,
  providerId,
  onOpenSettings,
  brainDumpText,
  onBrainDumpTextChange,
  isBrainDumpLoading,
  brainDumpTarget,
  onBrainDumpTargetChange,
  onBrainDumpExtract,
  onCancelBrainDump,
}: ImportTabProps) {
  return (
    <>
      {/* JSON ファイルインポート */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          JSON ファイルから読み込み
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          IdeaMap の JSON ファイルをインポートします。現在のマップは置き換えられます。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={onFileImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          JSONファイルを選択
        </button>
      </div>

      {/* テキスト/Markdown ペースト */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          テキストからノードを作成
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          1行1ノード。スペース2個またはタブでインデントすると親子関係になります。
          Markdown のリスト（- や *）にも対応。
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => onPasteTextChange(e.target.value)}
          placeholder={`例:\nメインテーマ\n  サブトピック1\n    詳細A\n  サブトピック2\n別のテーマ`}
          rows={6}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono"
        />
        <button
          onClick={onPasteImport}
          disabled={!pasteText.trim()}
          className="w-full py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ノードを追加
        </button>
      </div>

      {/* AIで構造化（ブレインダンプ→マップ生成、Phase 44） */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            AIで構造化（ブレインダンプ）
          </span>
          <input
            type="checkbox"
            checked={brainDumpEnabled}
            onChange={(e) => onBrainDumpEnabledChange(e.target.checked)}
            className="rounded"
          />
        </label>

        {brainDumpEnabled && (
          !isReady ? (
            <ApiKeyRequired
              providerId={providerId}
              className="py-4"
              onOpenSettings={onOpenSettings}
            />
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                議事録・メモ・箇条書きなどを貼り付けると、AIが階層構造を抽出してマインドマップを生成します。
              </p>
              <textarea
                value={brainDumpText}
                onChange={(e) => onBrainDumpTextChange(e.target.value)}
                placeholder={`例:\n新機能の企画会議\n- ターゲットは中小企業\n- 価格帯は月額1000円〜\n- 競合はA社とB社`}
                rows={6}
                disabled={isBrainDumpLoading}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onBrainDumpTargetChange('new')}
                  disabled={isBrainDumpLoading}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                    brainDumpTarget === 'new'
                      ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  新規マップとして生成
                </button>
                <button
                  onClick={() => onBrainDumpTargetChange('append')}
                  disabled={isBrainDumpLoading}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                    brainDumpTarget === 'append'
                      ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  現在のマップに追記
                </button>
              </div>

              {isBrainDumpLoading ? (
                <div className="flex items-center justify-center gap-3 py-1.5">
                  <span className="animate-spin w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full flex-shrink-0" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">AIが構造を抽出しています...</span>
                  <button
                    onClick={onCancelBrainDump}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <button
                  onClick={onBrainDumpExtract}
                  disabled={!brainDumpText.trim()}
                  className="w-full py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  マップを生成
                </button>
              )}
            </>
          )
        )}
      </div>
    </>
  )
}
