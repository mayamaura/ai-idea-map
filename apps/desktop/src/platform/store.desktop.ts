import { LazyStore } from '@tauri-apps/plugin-store'

/**
 * アプリのキーバリュー永続化ファイル（$APPCONFIG/app-data.json）。
 * StorageAdapter（設定・開いているファイルID）と FileAdapter（最近開いたファイル）が共用する。
 *
 * LazyStore は最初のアクセスまでファイルを読まないため、
 * setPlatform() より前にこのモジュールが評価されても副作用が起きない。
 */
export const appStore = new LazyStore('app-data.json')
