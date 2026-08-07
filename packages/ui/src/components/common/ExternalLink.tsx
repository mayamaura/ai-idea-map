import type { ReactNode } from 'react'
import { getPlatform } from '@ideamap/platform'

interface ExternalLinkProps {
  href: string
  children: ReactNode
  className?: string
  title?: string
}

/**
 * 外部サイトへのリンク。
 *
 * 素の `<a target="_blank">` はデスクトップ版の WebView では何も起きない
 * （新規ウィンドウを開かせない設定のため）。両プラットフォームで確実に
 * OS 既定ブラウザへ出すため、必ず SystemAdapter 経由にする。
 */
export function ExternalLink({ href, children, className = '', title }: ExternalLinkProps) {
  return (
    <button
      type="button"
      title={title ?? href}
      onClick={() => void getPlatform().system.openExternalUrl(href)}
      className={`underline hover:text-primary-600 dark:hover:text-primary-400 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
