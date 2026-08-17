import { describe, expect, it } from 'vitest'
import { getActiveProvider, isProviderReady, type ProviderSettings } from './providerFactory'
import { ClaudeProvider } from './claudeProvider'
import { OllamaProvider } from './ollamaProvider'
import { OpenAIProvider } from './openaiProvider'

function settings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    llmProvider: 'claude',
    apiKey: '',
    claudeModel: 'claude-sonnet-5',
    ollamaModel: '',
    ollamaBaseUrl: '',
    openaiApiKey: '',
    openaiModel: '',
    ...overrides,
  }
}

describe('getActiveProvider', () => {
  it('llmProvider: "ollama" は OllamaProvider を生成する', () => {
    const p = getActiveProvider(settings({ llmProvider: 'ollama', ollamaModel: 'gemma3:12b' }))
    expect(p).toBeInstanceOf(OllamaProvider)
    expect(p.id).toBe('ollama')
  })

  it('llmProvider: "openai" は OpenAIProvider を生成する', () => {
    const p = getActiveProvider(settings({ llmProvider: 'openai', openaiApiKey: 'sk-test' }))
    expect(p).toBeInstanceOf(OpenAIProvider)
    expect(p.id).toBe('openai')
  })

  it('llmProvider: "claude"（既定）は ClaudeProvider を生成する', () => {
    const p = getActiveProvider(settings({ llmProvider: 'claude', apiKey: 'sk-ant-test' }))
    expect(p).toBeInstanceOf(ClaudeProvider)
    expect(p.id).toBe('claude')
  })
})

describe('isProviderReady', () => {
  it('ollama はモデル未選択なら false、選択済みなら true', () => {
    expect(isProviderReady(settings({ llmProvider: 'ollama', ollamaModel: '' }))).toBe(false)
    expect(isProviderReady(settings({ llmProvider: 'ollama', ollamaModel: 'gemma3:12b' }))).toBe(true)
  })

  it('openai はAPIキー未設定なら false、設定済みなら true', () => {
    expect(isProviderReady(settings({ llmProvider: 'openai', openaiApiKey: '' }))).toBe(false)
    expect(isProviderReady(settings({ llmProvider: 'openai', openaiApiKey: 'sk-test' }))).toBe(true)
  })

  it('claude（既定）はAPIキー未設定なら false、設定済みなら true', () => {
    expect(isProviderReady(settings({ llmProvider: 'claude', apiKey: '' }))).toBe(false)
    expect(isProviderReady(settings({ llmProvider: 'claude', apiKey: 'sk-ant-test' }))).toBe(true)
  })
})
