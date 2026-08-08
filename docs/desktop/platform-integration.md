# デスクトップ版（Tauri v2）プラットフォーム統合設計

**作成日**: 2026-08-05
**バージョン**: 0.1（ドラフト）
**位置づけ**: 本ドキュメントは `docs/design.md`（Web版設計書）を補完する、デスクトップ版固有の設計書です。Web版のコード・ドキュメントは変更しません。デスクトップ化の目的は **ローカルLLM（Ollama）連携** であり、配布はWindows優先・macOSも視野に入れます。

> **先に [README.md](README.md) を読んでください。** ドキュメント間で結論が食い違う箇所は README §3 の裁定が優先されます。本書に関係する裁定は次の3点です。
> - **§3.8 の Google Drive 連携はデスクトップ版 v1 のスコープ外です。** v1 はローカル完結とし、Web版からの移行は JSON エクスポート／インポートで行います。§3.8 の PKCE ループバック設計は Phase 38（任意）の設計として有効なので、破棄せず着手時に参照してください。
> - **§3.2 の「`import.meta.env` や `'__TAURI__' in window` 判定でエントリポイントを分ける」方式は採用しません。** [architecture.md](architecture.md) §3.5 の `setPlatform()` シングルトン注入に統一します。本書の Tauri API 呼び出しコード例は `apps/desktop/src/platform/*.desktop.ts` の中身として読み替えてください。
> - 本書 §1 は「既存 `ideamap/` をそのままラップする」構成を前提に書かれていますが、実際の配置は [architecture.md](architecture.md) のモノレポ構成（`apps/desktop` が `packages/ui`・`packages/core` を参照する）になります。

---

## 0. 目的とスコープ

- Web版 `ideamap/`（Vite + React 19 + TS + Zustand + React Flow、GitHub Pages配信、バックエンドなし）はそのまま維持し、**同一のReactアプリをTauri v2のWebViewでラップする**形でデスクトップ版を構築します。
- デスクトップ版だけの主要な追加要件は次の2点です。
  1. **Ollama（`http://localhost:11434`）へのローカルHTTPアクセス** — ブラウザのCORS/CSP制約を受けずにローカルプロセスと通信できることがデスクトップ化の最大の動機です。
  2. **OSネイティブな機能**（ローカルファイル保存、OSキーチェーンでの秘密情報保管、ウィンドウ状態記憶、自動更新等）への置き換え。
- 本書はコードの実装そのものではなく、Phase計画に載せる前段の **設計** です。実装時は `ideamap/src-tauri/` を新設し、フロントエンドは可能な限り無改修〜最小改修に留める方針を前提にしています。

---

## 1. 全体アーキテクチャ

```
デスクトップアプリ（Tauri v2）
├── フロントエンド（既存 ideamap/src、ほぼ無改修）
│   ├── React SPA（Vite build → dist/ を WebView にロード）
│   ├── Zustand（mapStore / uiStore / settingsStore）
│   └── プラットフォーム分岐が必要な箇所のみアダプタ層を追加
│       （services/googleDriveService.ts は fetch ベースのため変更不要 / useGoogleAuth.ts は要差し替え）
│
├── Tauri Core（Rust, src-tauri/）
│   ├── tauri.conf.json（ウィンドウ・バンドル・CSP・updater設定）
│   ├── capabilities/*.json（機能ごとの最小権限定義）
│   └── 公式プラグイン
│       ├── fs（ローカルファイル読み書き）
│       ├── dialog（開く/保存ネイティブダイアログ）
│       ├── store（設定の永続キーバリューストア）
│       ├── http（Rust側HTTPクライアント。Ollama疎通に利用可）
│       ├── opener（既定アプリでURL/ファイルを開く・OSブラウザ起動）
│       ├── updater（自動アップデート）
│       ├── notification（保存完了・エラー通知）
│       └── window-state（ウィンドウ位置・サイズの記憶）
│
├── ローカルプロセス
│   └── Ollama（http://localhost:11434、ユーザーが別途起動）
│
└── 外部サービス（任意・オプション機能）
    ├── Anthropic API（クラウドLLMを使う場合。既存 claudeService.ts を流用）
    └── Google Drive API（同期を使う場合のみ。OAuthフローだけ desktop 用に差し替え）
```

Web版との最大の違いは「バックエンドなし・ブラウザのみで完結」という前提が崩れる点です。Tauriの Rust コア（`src-tauri`）が薄いネイティブブリッジとして追加され、ファイルシステム・OSキーチェーン・ローカルHTTPアクセスなど、ブラウザのサンドボックスでは不可能だった処理を担います。

---

## 2. デスクトップ版で置き換わる機能の対応表

実コード（`ideamap/src/...`）を確認したうえでの対応表です。

| 機能 | Web版の実装 | デスクトップ版の実装 | 挙動の差異 | ユーザーへの影響 |
|---|---|---|---|---|
| 設定の永続化 | `settingsStore.ts`（Zustand `persist` ミドルウェア）が `localStorage` キー `ideamap-settings` に `aiModel`/`suggestionCount`/`autoSave`/`theme`/`language`/`nodeShape`/`categories`/`snapToGrid`/`edgeStyle` を保存 | `tauri-plugin-store` で `settings.json` を OS標準の設定ディレクトリ（`$APPCONFIG`）に保存。Zustand の `persist` の `storage` オプションをカスタム実装（store プラグイン経由）に差し替え | `localStorage` は5MB程度の上限があるがローカルファイルには実質上限なし。ファイルは平文JSONとしてディスク上に残る | ユーザーはOS上のアプリ設定フォルダを直接エクスプローラ/Finderで確認できるようになる（削除・バックアップが容易に） |
| APIキーの保管 | `utils/encryption.ts` の `setStoredApiKeyWithPassword`/`getStoredApiKeyWithPassword`（マスターパスワードから PBKDF2 100,000回 + AES-GCM で `localStorage` の `ideamap-apikey-mp` に暗号化保存） | OSキーチェーン（Windows Credential Manager / macOS Keychain / libsecret）に平文キーを直接格納。`keyring` crate をラップした Tauri プラグイン経由でRust側から読み書き（詳細は §4） | Web版は「ローカルストレージ＋マスターパスワード」という多層防御が必要だったが、デスクトップ版はOS自体がユーザーログインで保護するキーチェーンを使うため、**マスターパスワード入力が原則不要**になる | 起動のたびにマスターパスワードを入力する手間がなくなる。一方でOSアカウントを共有しているユーザー間ではキーが見える点は変わらない |
| マップファイルの保存・読込 | `services/storageService.ts`（`localStorage` の `ideamap-current-map` に現在のマップをJSON保存）＋ `services/googleDriveService.ts`（`saveMap`/`loadMap` で Google Drive にJSONアップロード/ダウンロード） | `dialog` プラグインでネイティブの開く/保存ダイアログを表示し、`fs` プラグインで `.ideamap`（実体はJSON）ファイルを直接読み書き。Google Driveは任意のオプション機能として残す（§3.8） | Web版は「ファイル」という概念がなく常に1つの `localStorage` エントリ or Drive上のファイル。デスクトップ版は明示的なファイルパスを持つ「ファイルベース編集」になる | 「名前を付けて保存」でユーザーが管理するファイルツリーの好きな場所に保存できるようになる一方、初めてのユーザーには「開くダイアログ」という一手間が増える |
| 最近開いたファイル | `storageService.ts` の `saveRecentMap`/`loadRecentMaps`（`localStorage` の `ideamap-recent-maps` に Drive の `fileId` ベースで最大5件） | ローカルファイルパスの履歴を `store` プラグインに保存し、あわせてOSの「最近使った項目」（Windowsジャンプリスト／macOS「最近使った項目」メニュー）にも登録 | Web版はDriveの `fileId` を主キーにしていたが、デスクトップ版はファイルの絶対パスを主キーにする必要がある（ファイル移動・削除で無効化されうる） | エクスプローラ/Finder・タスクバーのアイコン右クリックからも最近のマップを開けるようになる |
| エクスポート（JSON/画像/Markdown） | `services/exportService.ts`（`downloadDataUrl`/`downloadText` が `<a download>` を生成しクリックしてブラウザのダウンロード機構を利用） | `dialog.save()` でファイルパスを選ばせ、`fs.writeTextFile`/`fs.writeFile` で直接書き出す。PNG/SVGは `html-to-image` の `toPng`/`toSvg` の出力（data URL）をデコードして書き込む | ブラウザのダウンロードフォルダに固定で落ちる挙動から、ユーザーが保存先を毎回選べる挙動に変わる | 保存先を毎回選べて便利になる反面、初回はダイアログが増える分クリック数が増える |
| 共有URL | `exportService.ts` の `generateShareUrl`/`parseMapFromUrl`（マップJSONをbase64化してURLクエリ `?map=` に埋め込み、`App.tsx` が起動時にパースしてインポート確認ダイアログを出す） | デスクトップアプリは自身のURLを持たないため、この方式は機能しない。**カスタムURIスキーム（例: `ideamap://open?map=...`）** で同等の機能を代替可能だが、初期リリースでは対象外とし、JSONファイルの共有（メール添付・クラウドストレージ経由）に一本化する | Web版のワンクリック共有ができなくなる | 「共有URLをコピー」の代わりに「JSONファイルとして共有」を案内する必要がある（UI文言の調整が要る） |
| 終了前の未保存警告 | `App.tsx` の `beforeunload` イベントハンドラ（`saveStatus` が `unsaved`/`saving` のとき `e.preventDefault()`） | ブラウザの `beforeunload` はTauriのネイティブウィンドウでは発火しないため、Tauriウィンドウの `close-requested` イベントを購読し、同じ `uiStore.saveStatus` を見て確認ダイアログ（`dialog.ask` または既存の `ConfirmDialog` コンポーネント）を出し、キャンセル時は `event.preventDefault()` を呼ぶ形に置き換える | ブラウザ標準の「変更が保存されていません」ダイアログから、アプリ独自デザインの確認ダイアログに変わる（日本語化・デザイン統一ができる） | 表示は変わるが体験としては同等。むしろ文言を自由に作れる分わかりやすくなる |
| ウィンドウ状態の記憶 | Web版はブラウザタブなので概念自体が存在しない | `window-state` プラグインを `tauri::Builder` に登録し、`window-state:default` 権限を付与するだけで、ウィンドウの位置・サイズ・最大化状態を自動的に保存・復元 | Web版になかった新機能 | 次回起動時に前回と同じ位置・サイズでアプリが開く |

---

## 3. ファイル管理モデルの設計

### 3.1 基本方針

Web版は「Google Drive中心・localStorageは一時キャッシュ」という設計でしたが、デスクトップ版は **ローカルファイル中心** に転換します。理由は次のとおりです。

- Tauriアプリはネイティブなファイルシステムアクセスを持つため、わざわざクラウドを経由する必然性が薄い。
- Ollama利用者はオフライン・ローカル完結を志向するユーザー層が多く、「ファイルもローカルに置きたい」というニーズと整合する。
- Google Drive連携はオプション機能として引き続き提供し、「クラウド同期したい人だけ使う」位置づけに格下げする（詳細は §3.8）。

### 3.2 開く／保存／名前を付けて保存

`dialog` プラグインのネイティブダイアログを使用します。

```ts
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

// 開く
const path = await open({
  multiple: false,
  filters: [{ name: 'IdeaMap マップ', extensions: ['ideamap', 'json'] }],
})
if (typeof path === 'string') {
  const text = await readTextFile(path)
  const mapFile: MapFile = JSON.parse(text)
  // useMapStore.getState().loadFromSerialized(...) へ渡す
}

// 名前を付けて保存
const savePath = await save({
  defaultPath: `${mapTitle}.ideamap`,
  filters: [{ name: 'IdeaMap マップ', extensions: ['ideamap'] }],
})
if (savePath) {
  await writeTextFile(savePath, JSON.stringify(mapFile, null, 2))
}
```

既存の `services/storageService.ts` はロジックを差し替えるのではなく、**プラットフォーム判定で実装を切り替えるアダプタ**（例: `storageService.web.ts` / `storageService.desktop.ts` を `import.meta.env` や `'__TAURI__' in window` 判定でエントリポイントを分ける）を新設するのが既存コードへの影響を最小化できます。

### 3.3 自動保存の対象

`hooks/useAutoSave.ts` は現状 `saveMapLocally(mapFile)`（`localStorage` へ常時保存）と Google Drive への `saveMap`（PATCH/POST）の2系統を持っています。デスクトップ版では次のように整理します。

- **開いているファイルが存在する場合**（ユーザーが「開く」or「名前を付けて保存」でファイルパスを確定済み）: そのファイルパスに対して `writeTextFile` で上書き保存する（Web版のDrive PATCH相当）。
- **ファイル未確定の場合**（新規マップ）: `useAutoSave.ts` の既存コメントにもある「マップ未読込のうちは保存しない」ガード（`hasActiveMap` チェック、`9c13440` で修正されたバグの再発防止ロジック）をそのまま踏襲しつつ、自動保存の書き込み先を一時領域（`$APPLOCALDATA/autosave/<mapId>.ideamap`）にして、ユーザーが明示的に「名前を付けて保存」するまでは実ファイルを汚さない。
- 衝突チェック（`fetchMapAppProperties` によるDriveとの `mapId` 突き合わせ）は、ローカルファイル運用では原則不要（同時に2プロセスから同一ファイルを開くケースは稀）。Drive同期を有効にしている場合のみ、既存の衝突検出ロジックを流用する。

### 3.4 `.ideamap` 拡張子とファイル関連付け

`tauri.conf.json` の `bundle.fileAssociations` で拡張子をOSに登録します。

```json
{
  "bundle": {
    "fileAssociations": [
      {
        "ext": ["ideamap"],
        "name": "IdeaMap マップファイル",
        "description": "IdeaMap で作成したアイデアマップ",
        "role": "Editor",
        "mimeType": "application/json"
      }
    ]
  }
}
```

エクスプローラ／Finderで `.ideamap` ファイルをダブルクリックした際、TauriはOSから渡される起動引数（Windows）やmacOSの `open` イベントとしてファイルパスを受け取ります。これを拾うために `tauri-plugin-single-instance`（同じアプリの多重起動を防ぎ、2つ目の起動をイベントとして既存ウィンドウに転送する）と組み合わせるのが定石です。中身はJSON（既存の `MapFile` 型）のままにして良く、拡張子だけ変えることで「他のJSONビューアに関連付けを奪われない」実利があります。

**実装（Phase 37）**: `apps/desktop/src-tauri/src/launch.rs` が起動引数からマップファイルらしきパス（`.ideamap`/`.json`、`-` 始まりのオプションと先頭の実行ファイル自身は除外）を1つ選び `PendingLaunchFile` に保持する。フロントエンド（`apps/desktop/src/launchFile.ts`）は `take_launch_file` コマンドで起動直後に1回だけ取り出す。`tauri-plugin-single-instance` は他のプラグインより先に登録し、2つ目のプロセスの引数は `ideamap://open-map-file` イベントとして既存ウィンドウへ転送する。macOS は起動引数ではなく `RunEvent::Opened` でファイルパスを受け取るため、`lib.rs` は `tauri::Builder::run(context)` ではなく `build(context)` → `app.run(closure)` の形に変更している（**macOS 実機は未検証**）。

**起動引数のパスへの `fs` 許可（重要）**: §5.4／§18.5 のとおり `fs:scope` はアプリ専用ディレクトリのみに絞ってあり、ユーザーが選んだパスは `dialog` プラグインが実行時に許可を足す設計になっている。**ダブルクリック起動は `dialog` を通らないため、この仕組みが効かない。** そのため `launch.rs` の `grant_fs_access()` が `tauri_plugin_fs::FsExt::try_fs_scope()` と `tauri::scope::Scopes` の両方に対して明示的に `allow_file()` を呼ぶ。これが無いと `take_launch_file` で取得したパスの読み込みが `forbidden path` で失敗する。一方、後述のドラッグ&ドロップ（§3.6）は Tauri 本体が Drop イベント処理の中で同じ許可を出しているため、この明示的な呼び出しは不要（`tauri` 2.11.5 の `src/manager/webview.rs` の `DragDropEvent::Drop` 分岐で確認済み）。

### 3.5 OSの「最近使った項目」連携

- Windows: `opener` プラグイン経由、またはRust側で `SHAddToRecentDocs` 相当のAPIを呼ぶ必要があります（ジャンプリストへの登録は追加のRustコードが必要になる可能性が高く、**未確認** — Tauri公式プラグインだけで完結するか検証が必要です）。
- macOS: `NSDocumentController.shared.noteNewRecentDocumentURL` 相当の処理が必要で、これもTauri公式プラグインの範囲外である可能性が高く **未確認**。
- 確実に実装できる代替として、アプリ内の「最近開いたファイル」リストを `store` プラグインで保持し、ファイルダッシュボード（`FileOpenDashboard.tsx` の後継）に表示する方式を必須ラインとし、OSネイティブな「最近使った項目」への統合は Phase を分けて追加検証する任意機能とします。

**実装（Phase 34）**: アプリ内の「最近開いたファイル」リストは `FileAdapter.listRecent()`（`apps/desktop/src/platform/file.desktop.ts`。パスを主キーに `store` プラグインへ保存し、移動・削除されたファイルは一覧から自動的に除外する）と `DesktopFileDashboard.tsx` で実装済み。**OSネイティブの「最近使った項目」「ジャンプリスト」統合は Phase 37 でも着手していない。** 任意機能のまま未解決（§8 #3）。

### 3.6 ファイルのドラッグ&ドロップ受け入れ

Tauri v2はウィンドウレベルの `onDragDropEvent`（`getCurrentWebview().onDragDropEvent`）でOSからのファイルドロップを検知できます。`tauri.conf.json` の `app.windows[].dragDropEnabled`（既定 `true`）を有効にしたうえで、ドロップされたファイルパスの拡張子が `.ideamap`/`.json` であれば読み込む処理を `App.tsx` 相当の初期化処理に追加します。ブラウザ標準の `ondrop` イベントと共存できるかは実装時に要検証（Tauriのドラッグ&ドロップは既定でOS側イベントを優先し、HTML5の `dragover`/`drop` を奪う場合があるため、React Flow のノードドラッグ操作と競合しないか確認が必要）。

**実装・実測結果（Phase 37）**: `dragDropEnabled` を `false` → `true` に変更し、`apps/desktop/src/components/FileDropOverlay.tsx` が `getCurrentWebview().onDragDropEvent` を購読する。ドラッグ中はオーバーレイを表示し、`.ideamap`/`.json` 以外がドロップされたときは案内トーストを出す。未保存の変更があるときは開く前に確認ダイアログを挟む。**競合の懸念は実測で解消した。** デスクトップ実機（`pnpm dev:desktop` + CDP アタッチ）で、`dragDropEnabled: true` の状態のまま ①React Flow のノードをポインタ操作で 140,84 px ドラッグ移動できること ②WebView 内の HTML5 `dragstart`（`PresentationOrderPanel` の並べ替えが依存している）が発火することを確認した。React Flow のノード操作は HTML5 の drag&drop ではなくポインタイベント（d3-drag）で実装されているため、OSレベルのファイルドロップとは競合しない。ただし **OSから実際にファイルを掴んでウィンドウへドロップする操作**（イベント注入ではなく本物のドラッグ操作）は CDP からは再現できず未検証のまま。

### 3.7 外部でファイルが変更された場合の扱い

- 最小実装: ウィンドウが `focus` イベントで前面に戻ったタイミングで、開いているファイルの `mtime`（更新日時）を `fs.stat` 相当のAPIで再取得し、アプリが最後に書き込んだ時刻より新しければ「外部で変更されています。再読み込みしますか？」の確認ダイアログを出す（`useAutoSave.ts` の `hiddenAtRef`/`FOCUS_RECHECK_MS` によるバックグラウンド復帰検知パターンを踏襲できる）。
- 発展形としてファイルシステム監視（`notify` crateベースのウォッチャ、`fs` プラグインには現状ウォッチAPIが含まれないため別途Rust実装が必要）でリアルタイム検知する案もあるが、初期リリースではオーバーエンジニアリングと判断し見送る。

**実装したアルゴリズム（Phase 37、`apps/desktop/src/externalChange.ts`）**: `getCurrentWindow().onFocusChanged` を購読し、前面に戻ったときだけ `FileAdapter.getMetadata()` で mtime を取り直す。

1. 開いているファイルについて、まだ基準（baseline）を記録していない場合（起動直後・別ファイルへの切り替え直後）は、取得した mtime をそのまま基準として記録するだけでダイアログは出さない。ファイルを開いた直後の1回目のフォーカス復帰で誤検知しないための措置。
2. 基準がある場合は `既知の時刻 = max(記録した baseline.mtime, uiStore.lastSavedAt)` に `MTIME_TOLERANCE_MS`（2000ms）の余裕を足したものと比較する。保存直後は自分が書いた mtime が `lastSavedAt` よりわずかに新しくなりうるため、この余裕が無いと自分の保存を外部変更と誤検知する。
3. 取得した mtime がこの許容範囲を超えたときだけ「ファイルが外部で変更されています」の確認ダイアログを出す。未保存の変更がある場合は文言を変え `danger: true` にする。同じ mtime に対しては1回しか尋ねない（`promptedMtime` で記録）。
4. 「読み込み直す」を選ぶと `openMapFile()` で再読み込みし、読み込めた時点の mtime を新しい基準にする。**「キャンセル」（開いたままにする）を選んだ場合も基準をその mtime まで進める。** そうしないと次のフォーカス復帰のたびに同じ確認が繰り返し出てしまう。

ファイルシステム監視（`notify` crate）は上記の判断どおり、初期リリースにはオーバースペックとして Phase 37 でも見送った。

### 3.8 Google Drive連携をデスクトップ版でも残すか

**結論: 残します。ただしオプション機能に格下げし、OAuthの実現方式のみ全面的に作り直します。**

判断理由:
- 既存ユーザーがWeb版で作成したマップをデスクトップ版でシームレスに引き継げる導線を残したい。
- `services/googleDriveService.ts` は `fetch` ベースの素朴なREST呼び出しであり、Google Drive APIはブラウザからのCORSアクセスを許可しているため、**Tauriの WebView 内から同じ `fetch` コードをほぼ無改修で呼び出せます**（`driveRequest`、`saveMap`、`loadMap` などの関数はそのまま流用可能。必要なのは `tauri.conf.json` のCSP `connect-src` に `https://www.googleapis.com` を追加することだけ）。

一方で **`hooks/useGoogleAuth.ts` は全面的に置き換えが必要** です。理由は実コード調査の結果、次の事実が判明したためです。

- 現行実装は Google Identity Services（GIS）の `google.accounts.oauth2.initTokenClient` によるトークンモデル（インプリシットフロー相当）で、ブラウザのポップアップウィンドウにGoogleのログイン画面を表示する方式です。
- ところがGoogleは2023年以降、**組み込みWebView（embedded user agent）からのOAuth認可リクエストを `disallowed_useragent` エラーで一律ブロック**しています（Android `WebView`、iOS/macOS `WKWebView` が名指しされており、Tauriが使うOS標準WebView（Windows: WebView2、macOS: WKWebView）も対象になります）。つまり **GISのポップアップをTauriウィンドウ内で開いても認可画面はブロックされ、ログインできません。**
- Googleの公式ガイド「OAuth 2.0 for iOS & Desktop Apps」では、デスクトップアプリ向けに **ループバックIPアドレスフロー（`redirect_uri=http://127.0.0.1:<port>`）** を明示的にサポートしており、これはOSの**外部（既定）ブラウザ**でログイン画面を開かせ、ローカルに一時起動したHTTPサーバーでリダイレクトを受け取る方式です。

これを踏まえたデスクトップ版OAuth設計は以下のとおりです。

1. Google Cloud Consoleで発行するOAuthクライアントIDを、既存の「ウェブアプリケーション」用とは別に **「デスクトップアプリ」種別で新規発行**する（デスクトップアプリ種別はクライアントシークレットを埋め込む必要がなく、PKCEと組み合わせて安全に配布可能）。
2. `tauri-plugin-oauth`（コミュニティプラグイン。ローカルループバックサーバーを起動し `start()` でポート番号を取得、`onUrl` コールバックでリダイレクトURLを受け取る設計）または同等の自前Rust実装で、ランダムな空きポートに `http://127.0.0.1:<port>` のリスナーを立てる。
3. PKCE（`code_verifier`/`code_challenge`）を生成し、`opener` プラグインの `openUrl()` でOS既定ブラウザに認可URLを開く。**`opener:allow-open-url` はコマンドの許可だけで、URLスコープは別に指定しないと全て拒否される**（Phase 35 で実際に踏んだ。`{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }] }` の形で書く）。
4. ブラウザでユーザーがログイン・許可すると `http://127.0.0.1:<port>/?code=...` にリダイレクトされ、ループバックサーバーが認可コードを受信する。
5. 受信した認可コードを、PKCEの `code_verifier` とともにGoogleのトークンエンドポイント（`https://oauth2.googleapis.com/token`）にPOSTしてアクセストークン／リフレッシュトークンを取得する。
6. 取得したトークンは §4 で述べるOSキーチェーンに保存し、`googleDriveService.ts` の各関数へ渡す（この部分は既存コードを流用）。

`ideamap/src/hooks/useGoogleAuth.ts` は上記フローに合わせて全面的に書き換えが必要ですが、**呼び出し側（`App.tsx`、`useAutoSave.ts`、`FileOpenDashboard.tsx` 等）が消費するインターフェース（`isSignedIn`/`accessToken`/`signIn`/`signOut`/`userEmail` 等）は互換に保てる**ため、フック内部の実装だけを差し替える設計にすれば波及範囲を抑えられます。

Google Drive連携を使わないユーザーへの移行パス（コード署名なし配布初期は「ローカル完結」を推す方針とも合致）:

- 初回起動時のオンボーディングで「Web版からマップを引き継ぎますか？」と案内し、Web版の「JSONエクスポート」機能（`exportAsJson`、変更不要）で書き出したファイルを、デスクトップ版の「開く」ダイアログでそのまま読み込ませる（`MapFile` の型はWeb/デスクトップで共通のため変換不要）。
- Drive連携を設定しないユーザーは完全にローカルファイルのみで運用でき、OAuth関連コードのロードすら不要（遅延importで初期バンドルからも分離する）。

#### Phase 38 での実装結果（2026-08-09）

上記の設計は概ねそのまま実装したが、**5点で判断を変えている。裁定は [README.md](README.md) §3.1-H が優先される。**

| 上記の記述 | 実際の実装 |
|---|---|
| 「`tauri-plugin-oauth` または同等の自前Rust実装」 | **自前実装を採用**（`src-tauri/src/oauth.rs`、`std::net::TcpListener`）。プラグインを足すと4点セットの保守が増えるのに対し、必要なのは1本の GET のクエリを読むことだけだった |
| 「`googleDriveService.ts` の関数はそのまま流用可能」 | **`fetch` → `HttpAdapter.request` の書き換えと、`FormData`/`Blob` → `multipart/related` 手組みへの変更が必要だった。** 前者は `packages/core` の規約、後者は plugin-http での `FormData` の挙動が未検証なため。実体は `packages/core/src/services/driveService.ts` |
| 「CSPの `connect-src` に `https://www.googleapis.com` を追加することだけ」 | **CSP は変更不要だった。** `HttpAdapter` 経由の通信は Rust 側の plugin-http が発行するため WebView の CSP を通らない。必要だったのは capability（`capabilities/google-drive.json`）だけ |
| PKCE の生成場所 | `code_challenge`（SHA-256）は **Rust 側**で計算する。`crypto.subtle` はセキュアコンテキストでしか使えず、Tauri の WebView でそれが保証されるか未実測のため |
| `access_type=offline` | **送らない。** installed app には常にリフレッシュトークンが返るため（Google 公式）。これは Web server フローとの重要な差 |

#### Google Cloud Console 側の設定手順（開発者の手作業）

デスクトップ版の Drive 連携を実際に動かすには、以下をユーザー（開発者）が行う必要がある。**コードだけでは完結しない。**

1. [Google Cloud Console](https://console.cloud.google.com) で Web版と同じプロジェクトを開く（Drive API は有効化済みのはず）。
2. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」→ アプリケーションの種類に **「デスクトップアプリ」** を選ぶ。Web版の「ウェブアプリケーション」種別のクライアントIDは**使い回せない**。
3. リダイレクトURIの登録は不要（デスクトップアプリ種別はループバックのポートを事前登録しない）。
4. 発行されたクライアントID**とクライアントシークレットの両方**を `apps/desktop/.env` に置く（`apps/desktop/.env.example` が雛形）。

   ```
   VITE_GOOGLE_DESKTOP_CLIENT_ID=xxxx.apps.googleusercontent.com
   VITE_GOOGLE_DESKTOP_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
   ```

   **シークレットは PKCE を使っていても必要。** 省略すると認可画面までは進むが、
   トークン交換で 400 `invalid_request` "client_secret is missing." になる（README §3.1-H #4）。
   `.env` を書き換えたら Vite の dev サーバーを再起動する（`pnpm dev:desktop` を立て直す）。

5. OAuth 同意画面のスコープに `https://www.googleapis.com/auth/drive.file` と `openid` `email` が含まれていることを確認する。`drive.file` は非機微スコープなので重い審査は不要。
6. **公開ステータスを「本番環境」にする。** 「テスト」のままだとリフレッシュトークンが7日で失効し、1週間ごとに再サインインが必要になる。

未設定のままでもアプリは動く（起動画面のドライブ欄が「未設定」の案内になるだけ）。

---

## 4. 秘密情報の保管設計

### 4.1 現状（`utils/encryption.ts`）の振り返り

現行のマスターパスワード方式は次の3層構造です。

1. `encryptWithPassword`/`decryptWithPassword`: パスワードから PBKDF2（100,000回、SHA-256）で AES-GCM 256bit鍵を導出し、APIキーを暗号化。
2. `settingsStore.ts` の `apiKeyLock`（`'none' | 'locked' | 'unlocked'`）でロック状態を管理し、`MasterPasswordModal` が起動時にパスワード入力を促す。
3. Google Drive連携時は `saveSettingsToDrive`/`loadSettingsFromDrive`（`googleDriveService.ts` の `saveAppSettings`/`loadAppSettings`）で暗号化済みAPIキーと `salt` を `settings.json` としてDriveにも同期する。

これはブラウザの `localStorage` が「同一オリジンなら誰でも読める」制約下での現実的な最善策ですが、デスクトップアプリではOS自体がユーザー単位でアクセス制御されたセキュアストレージ（キーチェーン）を提供するため、この多層構造は過剰防御になります。

### 4.2 デスクトップ版の設計: OSキーチェーンへの移行

Tauri公式には秘密情報保管専用プラグインとして `tauri-plugin-stronghold`（IOTA Stronghold暗号エンジン）がありますが、調査の結果 **Stronghold は非推奨化が進んでおり、Tauri v3では削除予定とアナウンスされています**。また Stronghold自体はOSキーチェーンを使わず独自の暗号化ボールト方式（結局どこかにマスターキーやパスワードを保存する必要がある）のため、今回の要件（マスターパスワード入力を不要にしたい）には不向きです。

そのため、デスクトップ版では **Rustの `keyring` crate をラップしたTauriプラグイン**（コミュニティ実装が既に存在。自前でThinラッパーを実装するのも比較的小規模）を採用し、Windows Credential Manager / macOS Keychain / Linux Secret Service（libsecret）にAPIキーを直接保存する設計とします。

```rust
// src-tauri/src/keychain.rs（設計イメージ。実装時に検証すること）
use keyring::Entry;

const SERVICE: &str = "com.ideamap.desktop";

#[tauri::command]
fn set_api_key(account: String, key: String) -> Result<(), String> {
    Entry::new(SERVICE, &account)
        .and_then(|e| e.set_password(&key))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_api_key(account: String) -> Result<String, String> {
    Entry::new(SERVICE, &account)
        .and_then(|e| e.get_password())
        .map_err(|e| e.to_string())
}
```

フロントエンド側は `utils/encryption.ts` の `setStoredApiKeyWithPassword`/`getStoredApiKeyWithPassword` 相当のインターフェースを持つ `utils/encryption.desktop.ts` を新設し、内部で上記Rustコマンドを `invoke('set_api_key', ...)` のように呼び出す形にします。呼び出し元の `settingsStore.ts` からは抽象化された同じ関数名で呼べるようにし、プラットフォーム判定でモジュールを切り替えます。

### 4.3 マスターパスワード入力は不要にできるか

**不要にできます。** OSキーチェーンはOSログイン（Windows Hello/パスワード、macOSログインパスワード/Touch ID）で既に保護されているため、アプリ側で追加のパスワードを課す必要はありません。`settingsStore.ts` の `apiKeyLock`/`needsMasterPasswordSetup`/`MasterPasswordModal` はデスクトップ版では完全に無効化し、起動時に自動でキーチェーンから読み出して `apiKey` にセットする設計にします（`initApiKey` 相当の処理をデスクトップ用に分岐）。

### 4.4 Web版との設定同期をどうするか

- Web版の「マスターパスワードでDriveの `settings.json` を暗号化して同期する」仕組みは、デスクトップ版でも**そのまま利用可能**です（Drive連携を有効にしている場合）。ただしデスクトップ版はキーチェーンに平文で保存しているため、Driveに上げる直前だけ一時的にマスターパスワード（またはランダム生成した同期専用パスワード）で暗号化する、という「同期のためだけの一時暗号化」という位置づけに変わります。
- 同期を使わないユーザーには、そもそもマスターパスワードという概念自体を見せない（設定画面から該当UIを条件分岐で非表示にする）ようにし、UXの複雑化を避けます。

### 4.5 Ollama利用時はAPIキー自体が不要

Ollamaはローカルで動作するため認証キーを必要としません。`claudeService.ts` に相当するAI呼び出し層に「プロバイダ」の概念を追加し（`aiModel` の型 `AIModel` を拡張、あるいは新たに `aiProvider: 'claude' | 'ollama'` を `settingsStore.ts` に追加）、Ollama選択時は §4のキーチェーン処理・マスターパスワードUI一式を丸ごとスキップできる設計にすることで、「AI機能を使うのにOS認証もクラウドアカウントも一切不要」という、デスクトップ版ならではの体験を実現できます（この部分はプロバイダ抽象化の詳細設計であり、本書のスコープ外の別Phaseとして切り出すことを推奨します）。

---

## 5. Tauri設定の具体例

> **Phase 34 で実装済み（2026-08-07）。** 実際の設定は `apps/desktop/src-tauri/tauri.conf.json` と `apps/desktop/src-tauri/capabilities/*.json` が正です。
> 本節の例から意図的に変えた点（capability を `main-window` / `file-access` / `ai-http` の3つに整理したこと、`fs:scope` を絞って `tauri-plugin-persisted-scope` で補うこと、`dragDropEnabled: false` にしたこと等）は [README.md](README.md) §3.1-D の表が優先されます。

### 5.1 `tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "IdeaMap",
  "version": "../ideamap/package.json",
  "identifier": "com.ideamap.desktop",
  "build": {
    "beforeDevCommand": "npm run dev --prefix ../ideamap",
    "beforeBuildCommand": "npm run build --prefix ../ideamap",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../ideamap/dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "IdeaMap",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "dragDropEnabled": true,
        "visible": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://localhost:11434 http://127.0.0.1:* https://api.anthropic.com https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com; font-src 'self' data:",
      "capabilities": [
        "main-window",
        "ollama-http",
        "file-access",
        "google-oauth"
      ]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "dmg", "app"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "createUpdaterArtifacts": true,
    "fileAssociations": [
      {
        "ext": ["ideamap"],
        "name": "IdeaMap マップファイル",
        "description": "IdeaMap で作成したアイデアマップ",
        "role": "Editor"
      }
    ]
  },
  "plugins": {
    "updater": {
      "pubkey": "<tauri signer generate で発行した公開鍵の中身をここに貼る>",
      "endpoints": [
        "https://github.com/<github-user>/<repo>/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

補足:
- `version` に `package.json` へのパスを直接指定できるかは実装時のTauriバージョンにより挙動差があるため **未確認**。確実な方法は、CIでビルド前に `ideamap/package.json` の値を `tauri.conf.json` の `version` フィールドへスクリプトで注入することです（§6.4）。
- `connect-src` に `http://127.0.0.1:*` を含めているのは、OAuthのループバックサーバー（毎回ポートが変わる）とAI提案取得等のfetchを想定したものです。ポートを固定できるなら `http://127.0.0.1:<固定ポート>` に絞るほうが安全です。

### 5.2 ケイパビリティ（`src-tauri/capabilities/*.json`）

Tauri v2は権限を機能ごとの capability ファイルに分割し、`tauri.conf.json` の `app.security.capabilities` で明示的に有効化する設計を推奨しています（列挙しない限り自動では有効になりません）。**「広く開けすぎない」ために、機能ごとにファイルを分け、対象ウィンドウ・URLパターンを最小限に絞ります。**

`src-tauri/capabilities/main-window.json`（基本ウィンドウ操作）

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-window",
  "description": "メインウィンドウの基本操作権限",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-title",
    "core:window:allow-close",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-ask",
    "dialog:allow-message",
    "notification:default",
    "window-state:default"
  ]
}
```

`src-tauri/capabilities/ollama-http.json`（Ollamaへの通信専用。**ホストを `localhost` に固定し、それ以外のHTTP先へは許可しない**）

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "ollama-http",
  "description": "ローカルOllama（http://localhost:11434）への通信のみ許可する",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [
        { "url": "http://localhost:11434/*" },
        { "url": "http://127.0.0.1:11434/*" }
      ]
    }
  ]
}
```

`src-tauri/capabilities/file-access.json`（マップファイルの読み書き専用。`$APPDATA` 配下と、ユーザーが `dialog` で明示的に選んだパスのみ）

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "file-access",
  "description": "マップファイル・自動保存領域への読み書き権限",
  "windows": ["main"],
  "permissions": [
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$APPDATA" },
        { "path": "$APPDATA/**" },
        { "path": "$APPLOCALDATA/autosave/**" }
      ]
    }
  ]
}
```

`dialog` プラグイン経由でユーザーが選択した任意パス（`$APPDATA` の外、例えば `Documents` フォルダ）への書き込みは、`dialog:allow-save`/`dialog:allow-open` が返すパスに対しては `fs` のスコープ外でも書き込みが許可される「dialog-fs連携」の挙動になるかは**未確認**であり、実装時に検証が必要です（挙動によっては `fs:scope` に `$HOME/Documents/**` 等を明示的に追加する必要があります）。

`src-tauri/capabilities/google-oauth.json`（Drive連携を有効にしたユーザーのみ関係する権限。既定では有効化しない設計も検討可）

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "google-oauth",
  "description": "Google OAuth ループバックフローとDrive APIアクセス",
  "windows": ["main"],
  "permissions": [
    { "identifier": "opener:allow-open-url", "allow": [{ "url": "https://*" }] },
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://oauth2.googleapis.com/*" },
        { "url": "https://www.googleapis.com/*" },
        { "url": "https://accounts.google.com/*" }
      ]
    }
  ]
}
```

`src-tauri/capabilities/updater.json`

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "updater",
  "description": "自動アップデートの確認・適用権限",
  "windows": ["main"],
  "permissions": ["updater:default"]
}
```

### 5.3 CSP設定の考え方

- `connect-src` はホワイトリスト方式にし、Ollama（`http://localhost:11434`）、Anthropic API（`https://api.anthropic.com`）、Google関連3ドメインのみを列挙します。`*` によるワイルドカード許可は行いません。
- `script-src` は `'self'` のみとし、`'unsafe-eval'` は含めません（Reactのビルド成果物は静的アセットのため不要）。
- `style-src` は Tailwind のインラインスタイル利用実態に合わせて `'unsafe-inline'` を許可する想定ですが、可能であれば nonce/hash 方式への置き換えを将来検討します。

### 5.4 最小権限の考え方

- **capability ファイルは機能単位で分割し、1ファイル1責務にする**（今回のように `ollama-http`/`file-access`/`google-oauth`/`updater` に分割）。これにより「Ollama通信のためだけに開けた `http` 権限が、意図せずGoogle APIへのアクセスも許してしまう」といった権限の意図しない拡大を防げます。
- `http:default` の `allow` は **ホスト単位ではなくパス込みのURLパターンで絞り、ワイルドカードは末尾の `/*` に限定する**。
- `fs:scope` は **アプリ専用ディレクトリ（`$APPDATA`/`$APPLOCALDATA`）を既定とし、ユーザーが明示的にダイアログで選んだパス以外への書き込みは許可しない**。「アプリが勝手にどこでもファイルを書ける」状態を避けます。
- Google連携（`google-oauth` capability）は、Drive連携機能をオンにしたユーザーだけに適用したい場合、Tauriの `platforms`/`windows` フィルタだけでは動的なオン・オフはできないため、**「機能自体を使わないユーザーにはOAuth関連コードを読み込ませない」というフロントエンド側の遅延ロードと組み合わせて、実質的な攻撃面を減らす**設計にします（capability自体は静的に有効化されている点に注意。動的な権限剥奪はTauri v2の標準機能には見当たらず **未確認**）。

---

## 6. ビルド・配布・自動更新

> **Phase 36 で実装済み（2026-08-08）。** 実際の設定は `.github/workflows/release-desktop.yml`・`apps/desktop/src-tauri/tauri.conf.json`・`scripts/sync-version.mjs`・`apps/desktop/src/updater.ts` が正です。
> 本節の例（モノレポ移行前の `desktop/` `ideamap/` 構成・`npm`）から意図的に変えた点（pnpm workspaces 化、バージョニングは同期スクリプト方式に統一したこと、updater/process の Rust依存を `cfg` でデスクトップ限定にしたこと等）は [README.md](README.md) §3.1-F の表が優先されます。

### 6.1 ローカルビルド手順

Windows（開発機で実行）:

```powershell
# MSI（Windows Installer）と NSIS（.exe インストーラ）の両方を生成
pnpm --filter @ideamap/desktop tauri build
```

macOS（ビルドはmacOS実機またはmacOSランナーが必要。WindowsからのクロスビルドはApple側の制約で不可）:

```bash
pnpm --filter @ideamap/desktop tauri build -- --target aarch64-apple-darwin
# または
pnpm --filter @ideamap/desktop tauri build -- --target x86_64-apple-darwin
```

生成物は既定で `apps/desktop/src-tauri/target/release/bundle/` 配下（`msi/`、`nsis/`、`dmg/`、`macos/` 等）に出力されます。ルートの `pnpm build:desktop`（`tsc -b && pnpm --filter @ideamap/desktop tauri build`）でも同じビルドを実行できます。

### 6.2 GitHub Actionsによるクロスプラットフォームビルド

実装は `.github/workflows/release-desktop.yml` です。`desktop-v*` タグの push（または手動実行）で起動し、3つのジョブで構成されます。

| ジョブ | 内容 |
|---|---|
| `verify-version` | ビルド前に `node scripts/sync-version.mjs --check` でバージョンの一貫性を検査し、タグ（`desktop-v<version>`）とルート `package.json` の `version` が一致するかも確認する。ズレていればここで失敗させ、後続のビルドを走らせない |
| `build` | Windows・macOS（`aarch64-apple-darwin` / `x86_64-apple-darwin`）のマトリクスビルド。`pnpm/action-setup` + `actions/setup-node` + `dtolnay/rust-toolchain` + `swatinem/rust-cache`（`workspaces: './apps/desktop/src-tauri -> target'`）のあと `pnpm install --frozen-lockfile` し、`tauri-apps/tauri-action@v0`（`projectPath: ./apps/desktop`）でビルドと GitHub Release への公開（`releaseDraft: true`）を行う |
| `checksums` | `build` の後に、公開されたリリースの成果物一式を `gh release download` で取得し `sha256sum` で `SHA256SUMS.txt` を生成してリリースに添付する（`latest.json` と過去の `SHA256SUMS.txt` 自体は集計対象から除く） |

補足:
- `TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD` は **updater用の署名鍵**（`tauri signer generate` で発行するUpdater専用の鍵ペア）であり、**コード署名証明書とは別物**です。Updater署名鍵は無料・自己発行可能なので、コード署名証明書がなくても自動更新の整合性検証自体は最初から導入できます。
- `tauri-action` は `latest.json`（Updaterが参照するマニフェスト）を自動生成し、指定したGitHub Releaseにアップロードします。
- `releaseDraft: true` のため、ビルドが成功しても Release は下書きのまま公開されません。内容を確認して手動で公開するまで、`plugins.updater.endpoints` の `latest.json` はこのリリースを参照しません（誤って未確認のビルドが自動更新で配られるのを防ぐ）。

### 6.3 `tauri-plugin-updater` の設定

- `tauri.conf.json` の `bundle.createUpdaterArtifacts: true` を設定するとビルド時に各バンドルの署名ファイル（`.sig`）が生成されます。
- `plugins.updater.pubkey` にはUpdater署名鍵の**公開鍵の中身**（ファイルパスではなく文字列そのもの）を貼り付けます。`apps/desktop/src-tauri/tauri.conf.json` にコミット済みです。秘密鍵とパスワードはリポジトリ外（開発機）に保管し、GitHub Secrets（`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）への登録はユーザーの手作業として**未実施**です。
- `plugins.updater.endpoints` に `https://github.com/mayamaura/ai-idea-map/releases/latest/download/latest.json` を指定し、GitHub Releasesの最新版マニフェストを自動的に参照します。
- Rust側の依存（`tauri-plugin-updater` / `tauri-plugin-process`）は `src-tauri/Cargo.toml` の `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` に置き、`lib.rs` では `#[cfg(desktop)]` でプラグイン登録しています（モバイル向けビルドでは自動更新・再起動という概念自体が無いため）。
- 権限は `src-tauri/capabilities/updater.json`（`updater:default` / `process:allow-restart`）で許可しています。
- フロントエンド側の実装は `apps/desktop/src/updater.ts` です。起動5秒後の自動チェック（`scheduleStartupUpdateCheck()`。失敗・更新なしは無言）と、設定パネルの `UpdaterSection`（`apps/desktop/src/components/UpdaterSection.tsx`）からの手動チェック（結果を必ずトースト/ダイアログで返す）の2経路があります。要点を抜粋します。

```ts
// apps/desktop/src/updater.ts（抜粋）
export async function checkForUpdate(silent: boolean): Promise<boolean> {
  const update = await check()
  if (!update) return false

  const accepted = await ask(`新しいバージョン ${update.version} が利用できます。…`)
  if (!accepted) return false

  // 未保存の変更があると再起動で失われる。保存の完了を最大10秒待ってから落とす
  await flushPendingSave()
  await update.downloadAndInstall()
  await relaunch()
  return true
}
```

更新パッケージの署名検証は Rust 側（`tauri-plugin-updater`）が公開鍵で行うため、コード署名証明書が無くても「配布後にすり替えられたものを掴む」ことは防げます。更新の取得自体は Rust 側（reqwest）が行うため、WebView の CSP（`tauri.conf.json` の `csp`/`devCsp`）には関係せず、Phase 36 で変更していません。

### 6.4 バージョニング方針

**実装済み（Phase 36・2026-08-08）。** ルート `package.json` の `version`（初期値 `0.1.0`）を単一の真実とし、`scripts/sync-version.mjs` が下流の4ファイル（`apps/web/package.json`・`apps/desktop/package.json`・`apps/desktop/src-tauri/tauri.conf.json`・`apps/desktop/src-tauri/Cargo.toml`）へ配ります。**Web版とデスクトップ版は同じアプリケーションバージョン番号を共有する**方針です。

```bash
pnpm sync-version    # ルートの version を4ファイルへ配る
pnpm check-version   # ズレていたら非ゼロ終了（CI の verify-version ジョブが実行）
```

`tauri.conf.json` の `version` にパッケージへの相対パス文字列（`"../../../package.json"`）を直接書けるかは、Phase 36 で実測して**指定できることを確認しました**（`cargo check` と `tauri inspect` の双方が `src-tauri` 基準でパスを解決）。ただし `apps/web/package.json` と `Cargo.toml` はどのみち同期スクリプトが要るため、仕組みを二重に持たない判断で `tauri.conf.json` も同期スクリプトによる数値配布のままにしています（実測結果の詳細は [README.md](README.md) §5「Phase 36 で解消した項目」、採用しなかった理由は §3.1-F）。

Gitタグは `desktop-v0.1.0` のようにプレフィックスを付け、Web版のデプロイ（GitHub Pagesへのpush）とは別トリガー（`.github/workflows/release-desktop.yml`）で運用します。`verify-version` ジョブがタグ名とルート `package.json` の `version` の一致も検査します。

### 6.5 コード署名なしで始める場合の現実的な運用

現時点でコード署名証明書は未取得とのことなので、初期リリースは無署名で配布する前提を置きます。裏取りできた事実は次のとおりです。

- **Windows**: 無署名バイナリはSmartScreenで「発行元不明のため実行がブロックされました」という警告が出ます。ユーザーは「詳細情報」→「実行」で回避できますが、初見のユーザーには不安を与えます。EV証明書であれば即座に警告が解消されますが、OV証明書（個人でも取得しやすい安価なタイプ）ではSmartScreenの警告は解消されず、一定期間・一定ダウンロード数の"評判"が蓄積されて初めて警告が緩和される仕組みです。
- **macOS**: 無署名（未公証）アプリは Gatekeeper が「壊れているため開けません」に近い強い警告を出し、初見では起動すらできないように見えます。回避には、ユーザーが「システム設定 → プライバシーとセキュリティ」から手動で許可するか、`xattr -d com.apple.quarantine <App>.app` で検疫属性を削除する必要があります。Apple Developer Programは年間$99で、無料プランでは開発・テスト目的の署名しかできず配布用の公証（notarization）はできません。

現実的な運用（ユーザー案内文の例）:

> **初回起動時の注意（署名未対応について）**
> IdeaMap Desktopは現在、個人開発のためOS標準のコード署名を行っていません。そのため、初回起動時に以下のような警告が表示される場合があります。
>
> - **Windows**: 「WindowsによってPCが保護されました」と表示された場合は、「詳細情報」をクリックし、「実行」を選択してください。
> - **macOS**: 「"IdeaMap"は開発元を確認できないため開けません」と表示された場合は、Finderでアプリを右クリック（またはControlキーを押しながらクリック）し、「開く」を選択してください。それでも開けない場合は「システム設定 → プライバシーとセキュリティ」の下部に表示される「このまま開く」ボタンを押してください。
>
> これはIdeaMapが未検証であることを示すOS標準の警告であり、GitHub上でソースコードを公開しているため内容はいつでも確認いただけます。ご不安な場合はソースからビルドしてご利用ください。

- README・リリースノート・ダウンロードページに上記案内を掲載し、加えて **リリースにSHA256チェックサムを添付**して改ざんされていないことを検証可能にする、という最低限の信頼担保策を併用します。
- Updater自体は署名鍵（§6.3）で更新パッケージの整合性を検証するため、コード署名証明書がなくても「配布後に第三者が中身をすり替えて自動更新させる」リスクは防げます。

### 6.6 後から署名を導入する移行パス

1. まずWindows向けにOV証明書（個人でも取得可能な安価な選択肢）を導入し、SmartScreen警告文言だけでも変化させる（即時解消はしない点に注意）。
2. ダウンロード数・利用実績が積み上がった段階でEV証明書へ切り替えれば、SmartScreenの警告は即時解消されます。
3. macOSはApple Developer Program（年$99）に加入し、`codesign` + `notarytool` による公証フローをCIに追加します（`tauri-action` は署名情報を環境変数で渡すだけで対応可能）。
4. いずれの場合も `tauri.conf.json` の `bundle.macOS.signingIdentity`/`bundle.windows.certificateThumbprint` 等、署名用の設定項目を追加するだけで済み、アプリのコード自体への変更は不要です。

---

## 7. 開発環境セットアップ手順（Windows）

AIエージェント（Claude Code）が実行できる粒度でコマンドを列挙します。上から順に実行してください。

> **Phase 34 時点の実績（2026-08-07）**: 開発機には §7.1〜§7.4 がすべて導入済みでした（rustc 1.97.1 `stable-x86_64-pc-windows-msvc` / Visual Studio Build Tools 2022（`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`）/ WebView2 Runtime 151.0.4129.59 / Node.js 24.18.0）。
> §7.5 以降は**モノレポ構成後のコマンドに読み替えてください**。プロジェクトは `npm create tauri-app` を使わず手書きで作成し、依存は `apps/desktop/package.json` に pnpm で追加しています。
>
> ```powershell
> pnpm install            # ルートで実行
> pnpm dev:desktop        # = pnpm --filter @ideamap/desktop tauri dev
> pnpm build:desktop      # = tsc -b && pnpm --filter @ideamap/desktop tauri build
> ```
>
> 導入した Tauri プラグインは `dialog` / `fs` / `store` / `http` / `opener` / `clipboard-manager` / `persisted-scope` / `updater` / `process` の9つです（`updater`/`process` は Phase 36 で追加）。`notification` と `window-state` は未導入（それぞれ未使用・Phase 37）。

### 7.1 Rustツールチェーン

```powershell
winget install --id Rustlang.Rustup -e
```

インストール後、新しいシェルを開いて確認します。

```powershell
rustc --version
cargo --version
rustup default stable-msvc
```

### 7.2 Visual Studio Build Tools（C++ビルドツール）

Rust for Windows（MSVCターゲット）のビルドには "Desktop development with C++" ワークロードが必要です。

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### 7.3 WebView2ランタイム

Windows 10 (1803以降) および Windows 11には標準搭載されていますが、念のため確認・インストールします。

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e
```

### 7.4 Node.js

`ideamap/` の既存開発環境と共通です。バージョンは `package.json` のビルド要件（Vite 8 / React 19 対応）に合わせてLTS最新系を推奨します。

```powershell
winget install --id OpenJS.NodeJS.LTS -e
node -v
npm -v
```

### 7.5 Tauri CLIとプロジェクト初期化

```powershell
# デスクトップ用の新規ディレクトリで Tauri を初期化する場合の例
npm create tauri-app@latest desktop -- --template react-ts
# もしくは既存の ideamap を frontend として指定して src-tauri のみ後付けする場合
cd desktop
npm install
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/plugin-store @tauri-apps/plugin-http @tauri-apps/plugin-opener @tauri-apps/plugin-updater @tauri-apps/plugin-notification @tauri-apps/plugin-window-state
```

Rust側の対応クレートも `src-tauri/Cargo.toml` に追加します。

```powershell
cd src-tauri
cargo add tauri-plugin-fs tauri-plugin-dialog tauri-plugin-store tauri-plugin-http tauri-plugin-opener tauri-plugin-updater tauri-plugin-notification tauri-plugin-window-state
```

### 7.6 開発サーバー起動・動作確認

```powershell
npm run tauri dev
```

`beforeDevCommand`（`tauri.conf.json`）が `ideamap/` の `npm run dev` を自動起動するため、既存のVite開発サーバーがそのままTauriウィンドウ内に表示されます。

### 7.7 Ollama動作確認（デスクトップ版の主目的）

```powershell
# Ollama自体は別途インストール済みであることを前提とする
ollama list
ollama serve
```

`http://localhost:11434/api/tags` にTauriウィンドウ内から `fetch` できることを、DevTools（`npm run tauri dev` 中は右クリック→「検証」で開ける）のConsoleで確認します。

```js
await fetch('http://localhost:11434/api/tags').then(r => r.json())
```

これが `capabilities/ollama-http.json` の `http:default` 許可設定と `tauri.conf.json` の CSP `connect-src` 設定が正しく機能しているかの最終確認になります。

---

## 8. リスクと未解決事項

判断を保留した点・要検証事項を列挙します。

| # | 項目 | 内容 | 対応方針 |
|---|---|---|---|
| 1 | `version` フィールドへのパッケージ相対パス指定 | `tauri.conf.json` の `version` に `package.json` へのパスを直接渡せるかは未確認 | **Phase 36 で解消（2026-08-08）。** `"../../../package.json"` のような相対パスを指定でき、`cargo check`（tauri-build）と `tauri inspect`（tauri CLI）の両方が `src-tauri` を基準に解決することを実測で確認した。ただし `apps/web/package.json` と `Cargo.toml` も揃える必要がありどのみち同期スクリプトが要るため、本プロジェクトでは採用せず §6.4 の `scripts/sync-version.mjs` による数値同期方式を採用した |
| 2 | `dialog` で選択した任意パスへの `fs` 書き込み許可の実際の挙動 | `fs:scope` の外にあるユーザー選択パスへの書き込みがdialog-fs連携で自動的に許可されるか未確認 | **Phase 34 で解消（2026-08-07）。** ダイアログで選んだパスは `fs:scope` の外でも読み書きできることを実機確認した（`dialog` プラグインが実行時にスコープを付与する）。あわせて、ダイアログを通していない `fs:scope` 外のパス（`~/Documents` 直下の直読み）は `forbidden path` で拒否されることも確認済み＝スコープは意図どおり最小に効いている。したがって `$HOME/Documents/**` の明示追加は不要。次回起動への引き継ぎには `tauri-plugin-persisted-scope` を採用している |
| 3 | OSの「最近使った項目」（ジャンプリスト／macOS最近使った項目）へのネイティブ統合 | Tauri公式プラグインの範囲内で完結するか未確認。追加のRust実装が必要な可能性 | 初期リリースはアプリ内リストのみとし（Phase 34 で実装済み）、OSネイティブ統合は Phase 37 でも着手せず見送った。必要になった段階で別途検証する任意機能のまま |
| 4 | Tauriのドラッグ&ドロップイベントと React Flow のノードドラッグ操作の競合可能性 | `dragDropEnabled` がHTML5標準の `dragover`/`drop` を奪う場合、React Flow内のノードD&D操作に影響する懸念 | **Phase 37 で解消（2026-08-08）。** `dragDropEnabled: true` の状態で、デスクトップ実機（CDPアタッチ）にて React Flow のノードをポインタ操作で140,84px移動できること、WebView内のHTML5 `dragstart` が発火することを確認した。React Flowのノード操作はHTML5 drag&dropではなくポインタイベント（d3-drag）で実装されているため競合しない。詳細は `docs/desktop/README.md` §5「Phase 37 で解消した項目」・§3.6 |
| 5 | ファイルシステム監視（外部変更のリアルタイム検知） | `fs` プラグインに監視APIがなく、`notify` crateの自前実装が必要 | **Phase 37 で実装・確定。** フォーカス復帰時の mtime 比較方式（`apps/desktop/src/externalChange.ts`）を採用し、リアルタイム監視（`notify` crate）は初期リリースでは見送った。実機で「初回は誤検知しない」「2回目以降は検知する」「キャンセル時も基準を進めて繰り返し尋ねない」ことを確認済み（§3.7） |
| 6 | Google OAuthループバックサーバーのポート固定可否 | 固定ポートにするとCSPを絞れる一方、ポート競合時に失敗しうる。動的ポート採番との両立方針は未検証 | 実装時に `tauri-plugin-oauth` 等の挙動を確認し、フォールバック戦略を決める |
| 7 | Windowsジャンプリストへのカスタムタスク登録・macOS Dockメニュー拡張 | 未着手・未調査 | Phase外。ユーザー要望が出た段階で再検討 |
| 8 | `keyring` crateのLinux（libsecret）環境依存 | 配布優先度はWindows/macOSだが、将来Linux対応時にlibsecretが未インストールな環境でのフォールバック挙動が未確認 | Linux対応は本書のスコープ外。着手時に別途調査 |
| 9 | コード署名なし配布時の実際のダウンロード転換率への影響 | SmartScreen/Gatekeeper警告がユーザー離脱に与える定量的影響は未計測 | リリース後の実利用データで判断し、必要性が高ければ§6.6の署名導入を前倒し |
| 10 | AIプロバイダ抽象化（Claude/Ollama切り替え）の詳細設計 | `settingsStore.ts`/`claudeService.ts` の型・関数をどう拡張するかは本書スコープ外 | [llm-abstraction.md](llm-abstraction.md) として切り出し済み。Phase 32 で `LLMProvider` を実装、Ollama 実装は Phase 35 |
| 12 | `keyring` crate の API | 本書 §4.2 のコード例は keyring v3 相当。実際に導入した v4.1.6 では `keyring::v1::Entry` に移動している | **Phase 34 で解消。** `apps/desktop/src-tauri/src/keychain.rs` が `keyring::v1::{Entry, Error}` を使い、`NoEntry` を「未設定」として `null` / `false` / no-op に写している |
| 11 | 共有URL機能の代替（カスタムURIスキーム） | `ideamap://` スキームでの代替は設計のみ言及し実装方式は未検討 | 需要が確認できた場合に別途設計 |

---

## 9. 情報源・検証状況

本書の記述は次の一次情報を確認したうえで作成しています（2026年8月時点）。

- Tauri v2公式ドキュメント（`v2.tauri.app`）: プラグイン一覧、`http`/`fs`/`dialog`/`updater`/`window-state` の権限設定、capabilities（`security/capabilities`）、Windows開発の前提条件（`start/prerequisites`）
- `tauri-apps/plugins-workspace`（GitHub）: 公式プラグインの実体確認
- Google公式ドキュメント「OAuth 2.0 for iOS & Desktop Apps」「Loopback IP Address flow Migration Guide」（`developers.google.com`）: ループバックフローの仕様
- Google Developers Blog「Upcoming security changes to Google's OAuth 2.0 authorization endpoint in embedded webviews」: 組み込みWebViewからのOAuthブロックポリシー
- `FabianLars/tauri-plugin-oauth`（GitHub）: ループバックOAuthプラグインの実装例
- `tauri-apps/tauri-action`（GitHub）・Tauri公式「Distribute → GitHub」: GitHub Actionsによるビルド・署名・リリースの構成
- Tauri公式「Distribute → Sign → Windows/macOS」: 無署名配布時のSmartScreen/Gatekeeper挙動、証明書コスト
- 各種ベンチマーク記事（2026年公開分含む）: Tauri/Electronのバンドルサイズ・メモリ使用量の実測値（複数ソースの記述を突き合わせ、幅のある数値として記載）

未確認として明記した項目は §8 のリスク一覧に集約しています。実装フェーズでの一次検証（実機でのビルド・動作確認）を必須とし、本書の記述と相違があれば本書側を更新してください。
