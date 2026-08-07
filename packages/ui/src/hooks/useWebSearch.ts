import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getPlatform } from '@ideamap/platform'
import { useSettingsStore, OllamaWebSearchClient, type WebSearchClient } from '@ideamap/core'

export interface UseWebSearch {
  /** 検索トグルをUIに出してよいか（デスクトップ版のみ） */
  isAvailable: boolean
  /** APIキーが設定済みか。未設定ならトグルは押せない */
  isConfigured: boolean
  enabled: boolean
  setEnabled: (v: boolean) => void
  /** aiService に渡すクライアント。無効・未設定なら undefined */
  client: WebSearchClient | undefined
}

/**
 * AIに聞く前のWeb検索の状態をまとめて返す。
 * トグルは3つのAI機能で共有し、選択は設定として永続化する。
 */
export function useWebSearch(): UseWebSearch {
  const { webSearchApiKey, webSearchEnabled, setWebSearchEnabled } = useSettingsStore(
    useShallow((s) => ({
      webSearchApiKey: s.webSearchApiKey,
      webSearchEnabled: s.webSearchEnabled,
      setWebSearchEnabled: s.setWebSearchEnabled,
    })),
  )

  // 実行中に変わらない値なので遅延初期化で一度だけ読む
  const [isAvailable] = useState(() => getPlatform().http.canAccessLocalServers)

  const isConfigured = webSearchApiKey !== ''
  const active = isAvailable && isConfigured && webSearchEnabled

  const client = useMemo(
    () => (active ? new OllamaWebSearchClient(webSearchApiKey) : undefined),
    [active, webSearchApiKey],
  )

  return { isAvailable, isConfigured, enabled: webSearchEnabled, setEnabled: setWebSearchEnabled, client }
}
