/**
 * Platform Adapter のインタフェース定義。
 *
 * 設計の根拠は docs/desktop/architecture.md §3。実装は apps/web / apps/desktop 側にのみ置き、
 * このパッケージには型と registry 以外を入れない（他パッケージへ依存しない最終ノードに保つ）。
 *
 * マップ内容を `unknown` で受け渡すのは、`MapFile` 型を持つ `@ideamap/core` への
 * 逆向き依存（platform → core の循環）を避けるため。既存の googleDriveService も
 * `saveMap(content: unknown)` / `loadMap(): Promise<unknown>` で同じ扱いをしている。
 */

// ---- StorageAdapter: 設定・最近使ったマップ等の Key-Value 永続化 ----

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

// ---- FileAdapter: マップファイルの読み書き ----

export interface FileRef {
  /** Web = Google Drive の fileId、Desktop = ローカルの絶対パス */
  id: string
  name: string
  origin: 'cloud' | 'local'
  updatedAt: string
}

export interface RecentFileEntry {
  ref: FileRef
  title: string
}

export interface FileAdapter {
  /** クラウド／ローカルの保存先が今すぐ使えるか（Web = Drive サインイン済み） */
  readonly isRemoteReady: boolean
  /** 最近開いたマップの一覧（ダッシュボード表示用） */
  listRecent(): Promise<RecentFileEntry[]>
  /** ref 省略時はファイル選択ダイアログ（Desktop）／マップ一覧（Web）を開く。キャンセル時は null */
  openFile(ref?: FileRef): Promise<{ ref: FileRef; content: unknown } | null>
  /** 既存ファイルへの上書き保存 */
  saveFile(ref: FileRef, content: unknown): Promise<FileRef>
  /** 新規保存（Web = Drive へ新規作成、Desktop = 名前を付けて保存ダイアログ）。キャンセル時は null */
  saveFileAs(content: unknown, suggestedName: string): Promise<FileRef | null>
  deleteFile(ref: FileRef): Promise<void>
  /**
   * 衝突検出用の軽量メタデータ取得。
   * Web = Drive の appProperties.mapId、Desktop = ファイルの mtime とファイル内 mapId
   */
  getMetadata(ref: FileRef): Promise<{ mapId: string | null; updatedAt: string } | null>
  /** オフライン復旧用のローカル控えを書く（Web = localStorage、Desktop = autosave ファイル） */
  saveLocalMirror(content: unknown): Promise<void>
  /**
   * 生成物（PNG / SVG / Markdown / JSON）の書き出し。
   * Web = `<a download>`、Desktop = 保存ダイアログ + fs。
   * `saveFileAs` はマップ本体の保存専用なので、書き出しは別メソッドに分けている。
   */
  exportBlob(suggestedName: string, blob: Blob): Promise<void>
}

// ---- SecretAdapter: APIキー等の秘密情報 ----

export interface SecretAdapter {
  hasSecret(key: string): Promise<boolean>
  /**
   * Web は WebCrypto 暗号化のため passphrase が必須、Desktop（OSキーチェーン）は無視する。
   * architecture.md §3.1 の定義に passphrase 引数を追加したのは、
   * Web 実装がマスターパスワード方式を維持するのに必要なため。
   */
  getSecret(key: string, passphrase?: string): Promise<string | null>
  setSecret(key: string, value: string, passphrase?: string): Promise<void>
  clearSecret(key: string): Promise<void>
  /** 旧形式（Phase 27 以前のハードコード鍵）の秘密情報が残っているか。Desktop は常に false */
  hasLegacySecret(key: string): Promise<boolean>
  /** 旧形式の秘密情報を読み出す（移行専用）。Desktop は常に null */
  getLegacySecret(key: string): Promise<string | null>
  /** 旧形式の秘密情報を削除する（移行完了後）。Desktop は no-op */
  clearLegacySecret(key: string): Promise<void>
  /**
   * true の場合、呼び出し元はマスターパスワードのUIを表示しない。
   * Web = false（WebCrypto 暗号化にパスワードが必須）、
   * Desktop = true（OSキーチェーンが OS ログインで既に保護されている）
   */
  readonly isPassphraseFree: boolean
}

// ---- HttpAdapter: ローカルHTTPアクセス可否の差を吸収 ----
// LLM 呼び出し自体の抽象化（プロンプト整形・ストリーミング等）は
// docs/desktop/llm-abstraction.md で扱う。ここでは「誰が実際に fetch するか」の境界のみ定義する。

export interface HttpAdapter {
  /** 任意のURLに到達可能か（Ollama 等のローカルサーバー起動確認に使用） */
  canReach(url: string): Promise<boolean>
  /**
   * Web = ブラウザの fetch（CORS 制約を受ける）
   * Desktop = Tauri の http プラグイン経由（Rust 側から発行するため CORS の制約を受けない）
   */
  request(input: string, init?: RequestInit): Promise<Response>
  /**
   * `fetch` 互換関数そのものを返す。@anthropic-ai/sdk のように
   * fetch 実装の差し替え口を持つライブラリへ渡すために使う。
   */
  getFetch(): typeof fetch
}

// ---- SystemAdapter: クリップボード・外部URL・終了前確認・通知 ----

export interface SystemAdapter {
  copyToClipboard(text: string): Promise<void>
  openExternalUrl(url: string): Promise<void>
  /**
   * 終了前確認ハンドラを登録する。ハンドラが false を返すと終了をキャンセルする。
   * Web = beforeunload、Desktop = ウィンドウの close-requested イベント。
   * 戻り値は登録解除用の関数。
   */
  onBeforeExit(handler: () => boolean | Promise<boolean>): () => void
  notify(message: string, type: 'info' | 'success' | 'error'): void
}

// ---- 集約型 ----

export interface Platform {
  storage: StorageAdapter
  file: FileAdapter
  secret: SecretAdapter
  http: HttpAdapter
  system: SystemAdapter
}
