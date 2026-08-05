/**
 * デザイントークンの共有プリセット。
 * `content` はTailwindがクラス名を静的解析する都合上パッケージ名では解決できないため、
 * 各アプリの tailwind.config.js が実ファイルパスで指定する。
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
      },
    },
  },
}
