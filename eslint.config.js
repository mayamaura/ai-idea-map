import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * モノレポ共通の ESLint 設定。
 * `files` を apps/packages に限定しているため、ルートで `eslint .` を実行しても
 * 移行途中の旧ディレクトリ（ideamap/）は対象にならない。
 */
export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules', '**/src-tauri']),
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // ルートと apps/web の両方に tsconfig.json があるため typescript-eslint が
    // プロジェクトルートを自動判別できない。extends より後ろのブロックで明示的に上書きする
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
])
