# @ideamap/web — Web版シェル

`packages/ui` と `packages/core` を土台にした Web 版のシェルです。
Google Drive 同期・GIS 認証・共有URL という Web でしか成立しない機能をここに閉じ込めています。
プロジェクト全体の情報はリポジトリルートの [README.md](../../README.md) を参照してください。

## 開発

コマンドはリポジトリのルートで実行してください（pnpm workspaces）。

```bash
pnpm install
pnpm dev      # このアプリの開発サーバーが起動する
pnpm build
```

## 環境変数

`.env` に以下を設定します。

```
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```
