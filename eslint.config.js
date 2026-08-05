import js from '@eslint/js'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * モノレポ共通の ESLint 設定。
 * `files` を apps/packages に限定しているので、ルートで `eslint .` を実行しても
 * リポジトリ直下の設定ファイル等は対象にならない。
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
  {
    // 依存方向: apps/* → packages/ui → packages/core → packages/platform（型のみ）
    // の一方向を強制する（docs/desktop/architecture.md §2.3）
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      // パッケージ間の import は @ideamap/* のワークスペース解決になるため、
      // TypeScript の解決器を使わないとゾーン判定ができない
      'import/resolver': {
        typescript: {
          project: ['packages/*/tsconfig.json', 'apps/*/tsconfig.app.json'],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      // 相対パスでパッケージ境界を跨ぐケースを検出する。
      // `@ideamap/*` 指定での違反は pnpm のシンボリックリンク先が解決結果になり
      // このルールのゾーン判定に掛からないため、後段の no-restricted-imports で塞ぐ
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './packages/core/src',
              from: ['./packages/ui/src', './apps'],
              message: 'packages/core は packages/ui / apps に依存できません',
            },
            {
              target: './packages/ui/src',
              from: ['./apps'],
              message: 'packages/ui は apps に依存できません',
            },
            {
              target: './packages/platform/src',
              from: ['./packages/core/src', './packages/ui/src', './apps'],
              message:
                'packages/platform はインタフェース定義専用です。他パッケージへ依存できません',
            },
          ],
        },
      ],
    },
  },
  {
    // ワークスペースのパッケージ名指定での逆流を塞ぐ（上の no-restricted-paths の補完）
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@ideamap/ui', '@ideamap/ui/*'], message: 'packages/core は packages/ui に依存できません' },
            { group: ['@ideamap/web', '@ideamap/desktop'], message: 'packages/core は apps に依存できません' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@ideamap/web', '@ideamap/desktop'], message: 'packages/ui は apps に依存できません' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ideamap/core', '@ideamap/core/*', '@ideamap/ui', '@ideamap/ui/*', '@ideamap/web', '@ideamap/desktop'],
              message: 'packages/platform はインタフェース定義専用です。他パッケージへ依存できません',
            },
          ],
        },
      ],
    },
  },
  {
    // localStorage/sessionStorage は StorageAdapter/SecretAdapter 経由が必須で、
    // packages 配下に正当な直接利用ケースが存在しないため機械的に禁止する。
    // window/document は packages/ui のポータルやDOM測定で正当な用途があるため対象外とし、
    // navigator.clipboard・window.google・<a>ダウンロード等はコードレビューで担保する。
    files: ['packages/core/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'StorageAdapter/SecretAdapter経由で参照してください' },
        { name: 'sessionStorage', message: 'StorageAdapter/SecretAdapter経由で参照してください' },
      ],
    },
  },
  {
    // packages/core は HTTP を直接叩かない。HttpAdapter 経由にすることで
    // デスクトップ版が Tauri の http プラグインに差し替えられる（Ollama の CORS 回避）
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'StorageAdapter/SecretAdapter経由で参照してください' },
        { name: 'sessionStorage', message: 'StorageAdapter/SecretAdapter経由で参照してください' },
        { name: 'fetch', message: 'getPlatform().http（HttpAdapter）経由で呼び出してください' },
      ],
    },
  },
])
