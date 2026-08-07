import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useSettingsStore,
  getActiveProvider,
  isProviderReady,
  type LLMProvider,
  type LLMProviderId,
} from '@ideamap/core'

export interface ActiveProvider {
  /** 現在の設定で選ばれている LLMProvider（Claude / Ollama） */
  provider: LLMProvider
  /** AI機能を実行できる状態か（Claude=APIキー設定済み / Ollama=モデル選択済み） */
  isReady: boolean
  providerId: LLMProviderId
}

/**
 * AI機能を持つパネルが共通で使う Provider 解決フック。
 * settingsStore の該当4項目だけを購読するので、他の設定変更では再生成されない。
 */
export function useActiveProvider(): ActiveProvider {
  const settings = useSettingsStore(
    useShallow((s) => ({
      llmProvider: s.llmProvider,
      apiKey: s.apiKey,
      claudeModel: s.claudeModel,
      ollamaModel: s.ollamaModel,
      ollamaBaseUrl: s.ollamaBaseUrl,
    })),
  )

  const provider = useMemo(() => getActiveProvider(settings), [settings])

  return { provider, isReady: isProviderReady(settings), providerId: settings.llmProvider }
}
