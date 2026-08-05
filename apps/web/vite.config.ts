import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
