import uiPreset from '@ideamap/ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [uiPreset],
  // Tailwind はクラス名を静的解析するため、パッケージ名ではなく実ファイルパスで指定する必要がある
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [],
}
