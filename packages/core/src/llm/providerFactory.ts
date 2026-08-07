import type { LLMProviderId } from '../types'
import type { LLMProvider } from './types'
import { ClaudeProvider } from './claudeProvider'
import { OllamaProvider } from './ollamaProvider'

/**
 * LLMProvider を組み立てるのに必要な設定だけを切り出した型。
 * settingsStore の状態そのものを受け取ると UI が余計なフィールドまで購読することになるため、
 * 使う4項目に絞ってある。
 */
export interface ProviderSettings {
  llmProvider: LLMProviderId
  apiKey: string
  claudeModel: string
  ollamaModel: string
  ollamaBaseUrl: string
}

/** 現在の設定でアクティブな LLMProvider を生成する */
export function getActiveProvider(s: ProviderSettings): LLMProvider {
  if (s.llmProvider === 'ollama') return new OllamaProvider(s.ollamaBaseUrl, s.ollamaModel)
  return new ClaudeProvider(s.apiKey, s.claudeModel)
}

/**
 * AI機能を実行できる状態か。Claude はAPIキー、Ollama はモデル選択が前提になる。
 * （Ollama は認証が無いので APIキーは不要）
 */
export function isProviderReady(s: ProviderSettings): boolean {
  return s.llmProvider === 'ollama' ? s.ollamaModel !== '' : s.apiKey !== ''
}
