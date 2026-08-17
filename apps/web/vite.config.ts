import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 本番ビルドの index.html に CSP メタタグを注入する（Phase 42）。
 *
 * 開発サーバーには適用しない: Vite の HMR（WebSocket・インラインプリアンブル）が
 * CSP 違反になるため。デスクトップ版が csp / devCsp を分けているのと同じ理屈。
 *
 * 各ディレクティブの根拠:
 * - script-src: ビルド後の index.html にインラインscriptは無い。GIS クライアントのみ許可
 * - style-src 'unsafe-inline': 画像エクスポート（html-to-image）が全要素に style.cssText を
 *   代入するため必須。外すと PNG/SVG エクスポートのスタイルが崩れる
 * - img-src data:: index.css のカーソル用 SVG data URI
 * - connect-src: Claude / OpenAI / Google Drive API / GIS 内部通信。
 *   Ollama（localhost）は Web 版では UI から選択不可のため意図的に許可しない
 * - frame-src / gsi パス許可: Google 公式ガイドの推奨値
 * - frame-ancestors は <meta> では無効なため含めない（必要ならホスティング側ヘッダーで設定）
 */
const CSP_CONTENT = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com https://www.googleapis.com https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const injectCsp: PluginOption = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return {
      html,
      tags: [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_CONTENT },
          injectTo: 'head-prepend',
        },
      ],
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), injectCsp],
  base: '/ai-idea-map/',
  build: {
    rolldownOptions: {
      output: {
        // 全コードが単一チャンクに集約されると初回ロードのパース／コンパイルが一点に集中するため、
        // 更新頻度の低いベンダーを分離してブラウザキャッシュを効かせる。
        // Vite 8 の rolldown では manualChunks のオブジェクト形式が使えないので codeSplitting.groups を使う。
        // html-to-image / @dagrejs/dagre は動的 import 済みのため自動で別チャンクになる（ここでは指定しない）
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'flow', test: /node_modules[\\/]@xyflow[\\/]/ },
            {
              name: 'ai',
              // @anthropic-ai/sdk の tools/ 配下は node 専用 API（util.promisify 等）をトップレベルで
              // 呼ぶ遅延チャンク。eager なベンダーチャンクに取り込むと起動時に落ちるため除外する
              test: (id) => {
                const p = id.replace(/\\/g, '/')
                return p.includes('/node_modules/@anthropic-ai/') && !p.includes('/sdk/tools/')
              },
            },
          ],
        },
      },
    },
  },
})
