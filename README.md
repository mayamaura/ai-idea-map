# IdeaMap

AIと一緒に育てるアイデアマップ。ノードをつなぎながら思考を可視化し、Claude AIが新しいアイデアを提案してくれるウェブアプリです。

## 機能

- **マインドマップ** — ノードの追加・編集・削除・移動、ドラッグでエッジ接続
- **AI拡張** — ノードを選択してClaudeにアイデア提案を依頼、採用したものをそのまま追加
- **Googleドライブ連携** — マップをJSONとして保存・読み込み、変更時に自動保存
- **Undo/Redo** — Ctrl+Z / Ctrl+Y でいつでも操作を戻せる
- **自動整列** — dareレイアウトでノードをきれいに並べ直す
- **ダーク/ライトテーマ** — ヘッダーのボタンで切替、設定に永続化
- **レスポンシブ** — PC・スマホ両対応（タッチ操作、ボトムナビ）

## 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | React 18 + TypeScript |
| ビルド | Vite |
| マインドマップ | React Flow |
| スタイリング | Tailwind CSS |
| 状態管理 | Zustand |
| AI | Anthropic SDK (Claude) |
| ストレージ | Google Drive API + localStorage |

## ローカル開発

pnpm workspaces のモノレポです。コマンドはリポジトリのルートで実行します。

```bash
pnpm install
pnpm dev        # Web版 http://localhost:5173
pnpm build      # 型検査 + Web版のプロダクションビルド
```

| ディレクトリ | 中身 |
|---|---|
| `packages/platform` | Platform Adapter の型定義と registry |
| `packages/core` | 型・Zustand ストア・レイアウト計算・LLM 抽象化 |
| `packages/ui` | React コンポーネントと UI hooks |
| `apps/web` | Web版シェル（Google Drive 連携・GIS 認証・共有URL） |
| `apps/desktop` | デスクトップ版シェル（Tauri v2・ローカルファイル保存・OSキーチェーン） |

### デスクトップ版（Tauri v2・開発中）

ローカルLLM（Ollama）連携を目的としたデスクトップ版を `apps/desktop` で開発中です。マップはローカルの `.ideamap` ファイル（実体は Web版と同じ JSON）として保存し、APIキーは OSキーチェーンに置きます。Google Drive 同期と共有URLは Web版だけの機能です。

```bash
pnpm dev:desktop    # Tauri のウィンドウを起動（Vite は 5174）
pnpm build:desktop  # インストーラをビルド
```

ビルドには Rust ツールチェーン（`stable-msvc`）・Visual Studio Build Tools 2022 の C++ ワークロード・WebView2 ランタイムが必要です（[手順](docs/desktop/platform-integration.md#7-開発環境セットアップ手順windows)）。

## デスクトップ版のインストール

[Releases](https://github.com/mayamaura/ai-idea-map/releases) から、お使いの環境に合うファイルをダウンロードしてください。

| OS | ダウンロードするファイル |
|---|---|
| Windows | `IdeaMap_x.y.z_x64_ja-JP.msi` または `IdeaMap_x.y.z_x64-setup.exe` |
| macOS（Apple Silicon） | `IdeaMap_x.y.z_aarch64.dmg` |
| macOS（Intel） | `IdeaMap_x.y.z_x64.dmg` |

同じリリースに添付されている `SHA256SUMS.txt` で、ダウンロードしたファイルが改ざんされていないか検証できます。

```bash
# Windows (PowerShell)
Get-FileHash .\IdeaMap_0.1.0_x64-setup.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 IdeaMap_0.1.0_aarch64.dmg
```

### 初回起動時の警告について（コード署名未対応）

IdeaMap Desktop は個人開発のため、**OS標準のコード署名を行っていません。** そのため初回起動時に次のような警告が出ます。

- **Windows**: 「WindowsによってPCが保護されました」と表示されたら、「詳細情報」をクリックして「実行」を選択してください。
- **macOS**: 「"IdeaMap"は開発元を確認できないため開けません」と表示されたら、Finderでアプリを右クリック（またはControlキーを押しながらクリック）して「開く」を選択してください。それでも開けない場合は「システム設定 → プライバシーとセキュリティ」の下部に出る「このまま開く」を押してください。

これは IdeaMap が OS に未検証であることを示す標準の警告です。ソースコードは本リポジトリで公開しているため、内容はいつでも確認いただけますし、ご不安な場合はソースからビルドしてご利用ください。

### 自動更新

新しいバージョンが公開されると、起動時（および設定パネルの「更新を確認」）に通知します。更新パッケージは署名を検証してから適用するため、コード署名が無くても「配布後に第三者が中身をすり替えて更新させる」ことはできません。

### リリース手順（開発者向け）

1. ルート `package.json` の `version` を更新し、`pnpm sync-version` で下流（`apps/*` と `src-tauri`）へ配る
2. 変更をコミットして `desktop-v<version>` のタグを打って push する
3. [Release Desktop ワークフロー](.github/workflows/release-desktop.yml)が Windows・macOS のインストーラをビルドし、**下書きの** Release を作る
4. 内容を確認して Release を公開する（下書きのままでは自動更新の参照先にならない）

事前に GitHub の Secrets へ Updater の署名鍵を登録しておく必要があります。鍵は `pnpm --filter @ideamap/desktop exec tauri signer generate` で発行し、公開鍵を `apps/desktop/src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に、秘密鍵とパスワードを Secrets に置きます。

| Secret 名 | 中身 |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | 秘密鍵ファイル（`.key`）の中身そのもの |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 鍵生成時に設定したパスワード |

**秘密鍵とパスワードを失うと、以降のバージョンに署名できず自動更新が継続できなくなります。** リポジトリの外で確実に保管してください。

## 使い方

1. ヘッダーの設定アイコンから **Claude APIキー** を入力
2. キャンバスをダブルクリックしてノードを追加
3. ノードを選択し「AIに拡張を依頼」でアイデアを展開
4. Googleアカウントでサインインするとドライブに自動保存（OAuth設定は不要）

## ドキュメント

- [要件定義書](docs/requirements.md)
- [設計書](docs/design.md)
- [実装計画書](docs/implementation-plan.md)
- [デスクトップ版・モノレポ設計](docs/desktop/README.md)
