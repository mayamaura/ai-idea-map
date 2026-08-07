import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri は固定ポートの devUrl を見に行くため、ポートが空いていなければ
// 別ポートへフォールバックせず失敗させる（ウィンドウが空白になるのを防ぐ）
const DEV_PORT = 5174

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // WebView は file:// ではなくアプリ内プロトコルのルートから配信されるため base は既定のまま
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    watch: {
      // cargo が書き込み中の DLL を Vite が監視すると EBUSY で dev サーバーごと落ちる
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    // WebView2（Chromium）と WKWebView のみが対象なので、Web版より新しい構文を許容する
    target: 'es2023',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'flow', test: /node_modules[\\/]@xyflow[\\/]/ },
            {
              name: 'ai',
              // apps/web と同じ理由（tools/ 配下が node 専用 API をトップレベルで呼ぶ）で除外する
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
