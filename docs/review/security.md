# セキュリティレビュー — IdeaMap

レビュー日: 2026-06-28  
対象: `ideamap/src/` 全体（フロントエンドのみ SPA）

---

## 総評

IdeaMap は個人用ツールという性格上、サーバーサイドが存在せず攻撃面は比較的狭い。しかし Claude API キーをブラウザで直接扱う構造は「利便性とリスクのトレードオフ」として意図的に選ばれており、このリスクを最小化する追加策が部分的にしか実装されていない。最大の問題は、デバイス固有性のない定数文字列（`'ideamap-v1'`）をパスワードとして使う擬似暗号化によって、localStorage の暗号化が実質的に意味をなしていない点である。XSS 面では `dangerouslySetInnerHTML` を使いながらも独自 sanitizer が HTML エスケープを先行適用しているため現状の実害リスクは低い。共有 URL は設計上の情報露出経路だが個人利用の範囲では許容可。npm audit は開発時のみ使う Vite に high 1 件（Windows パス bypass）を検出しており早急な更新が推奨される。

---

## 重大度別サマリ表

| 重大度 | 件数 |
|--------|------|
| 高     | 3    |
| 中     | 5    |
| 低     | 3    |
| **合計** | **11** |

---

## 指摘詳細

### [高-1] Claude API キーのブラウザ直接呼び出し（構造的リスク）

- **重大度**: 高
- **対象ファイル**: `ideamap/src/services/claudeService.ts` — 全関数内 `new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })`
- **現状**: `@anthropic-ai/sdk` をブラウザ上で直接使用し、ユーザーが入力した API キーをリクエスト時にメモリ経由で渡している。SDK 自体が `dangerouslyAllowBrowser: true` を要求しており、設計上の意図的な選択。
- **リスク / 影響**: ブラウザの devtools（Network タブ）で任意のリクエストが閲覧可能であり、攻撃者が同一マシンにアクセスできる状況では API キーが直接取得できる。XSS が成立した場合はページ内から Anthropic API を呼び出されてコスト被害を受ける可能性がある。
- **推奨対応**:
  1. （緩和策A: 軽量）Anthropic Console でキーに利用上限（Monthly Spend Limit）と信頼できる IP レンジを設定する。ブラウザ直接呼び出し自体は維持しつつ被害上限を設ける。
  2. （緩和策B: 根本）自前またはマネージドのプロキシ（例: Cloudflare Workers / Vercel Edge Functions）を挟み、ブラウザはプロキシエンドポイントのみを知る構造にする。個人ツールとしては工数対効果が低い場合がある。
- **推定工数**: A=小、B=大

---

### [高-2] ローカル保管の API キー暗号化が実質無効

- **重大度**: 高
- **対象ファイル**: `ideamap/src/utils/encryption.ts` — `deriveKey()` 関数（行 70-86）
- **現状**: デバイス固有暗号化の目的で AES-GCM + PBKDF2（iterations: 100,000, SHA-256）を使用しているが、導出元パスワードがソースコードにハードコードされた定数文字列 `'ideamap-v1'` である。ソルトは `localStorage` に平文保存。
- **リスク / 影響**: `localStorage` の内容（`ideamap-apikey-enc` と `ideamap-salt`）を取得した攻撃者はソースコードから導出パラメータを復元して即座に復号できる。デバイスのファイルシステム読み取りやブラウザプロファイルコピーにより API キーが漏洩する。暗号化は存在するが意味をなさない（security theater）。
- **推奨対応**:
  1. Web Crypto API の `crypto.subtle.generateKey` でデバイス固有の鍵を生成し、`extractable: false` で `IndexedDB`（CryptoKey ストア）に保存する。エクスポート不可の鍵にすれば devtools からも取得不能になる。
  2. または、localStorage 暗号化を廃止し、「API キーはページをリロードするたびに入力する」設計に切り替える（シンプルで安全）。
- **推定工数**: 中（IndexedDB 方式）

---

### [高-3] Vite 依存パッケージに high 脆弱性（Windows パス bypass）

- **重大度**: 高（ただし開発時のみ影響・本番バンドルには含まれない）
- **対象ファイル**: `ideamap/package.json` — `"vite": "^8.0.12"`
- **現状**: `npm audit` の結果、Vite 8.0.0-8.0.15 に 2 件の脆弱性が検出された。
  - `server.fs.deny` が Windows の代替パスでバイパスされる（high, GHSA-fx2h-pf6j-xcff, CWE-22）
  - `launch-editor` 経由で NTLMv2 ハッシュが UNC パスから漏洩する（moderate, GHSA-v6wh-96g9-6wx3）
- **リスク / 影響**: 開発サーバー（`npm run dev`）を公開ネットワーク上で起動している場合、ホスト上の任意ファイルが読み取られる可能性がある。ローカルのみで `dev` を使う場合の実害は低い。プロダクションビルドには含まれない。
- **推奨対応**: `npm update vite` で 8.0.16 以上にアップデートする。
- **推定工数**: 小

---

### [中-1] API キーがメモリ（Zustand ストア）に平文保持

- **重大度**: 中
- **対象ファイル**: `ideamap/src/stores/settingsStore.ts` — `apiKey: string` フィールド
- **現状**: `setApiKey` で `settingsStore` の `apiKey` フィールドに平文で保持される。Zustand ストアはグローバルなメモリオブジェクトであるため、XSS が成立した場合は `useSettingsStore.getState().apiKey` で即座に取得可能。
- **リスク / 影響**: XSS 経由の API キー漏洩。`dangerouslySetInnerHTML` の存在（[中-2] 参照）と組み合わせた場合のリスクが高まる。
- **推奨対応**: API キーを呼び出し直前にのみ復号する設計（ストアには暗号文だけ保持し、`claudeService` 内で復号→使用→即破棄）にすることでメモリ上の露出時間を短縮できる。完全な解決には [高-2] の IndexedDB 方式が必要。
- **推定工数**: 中

---

### [中-2] `dangerouslySetInnerHTML` + 独自 sanitizer の組み合わせ

- **重大度**: 中
- **対象ファイル**: `ideamap/src/utils/markdown.ts`、`ideamap/src/components/canvas/IdeaNode.tsx`（行 231）、`PresentationMode.tsx`（行 83）、`NodePanel.tsx`（行 51）、`NodeDetailPanel.tsx`（行 217）
- **現状**: `renderMarkdownSimple()` は `&`, `<`, `>` を HTML エスケープした後で `<h1>`, `<strong>`, `<em>`, `<code>`, `<li>` タグを文字列置換で生成し、`dangerouslySetInnerHTML` に渡している。react-markdown 等の外部ライブラリは未使用。
- **リスク / 影響**: 現在の実装は入力全体をエスケープしてからタグ付けするため、ユーザーが直接 `<script>` を埋め込んでも無害化される。ただし正規表現ベースの置換は `*(.+?)*` のネストや CRLF 混在で予期しないHTML断片が生成される可能性がある。将来のパターン追加時に XSS を混入させるリスクが高い設計である。
- **推奨対応**: `react-markdown` + `rehype-sanitize` に切り替えることで、sanitize ロジックをメンテナンスされたライブラリに委譲する。または独自実装を維持するなら DOMParser を用いて parse 後に許可要素のみを残すホワイトリスト方式にする。
- **推定工数**: 小（react-markdown 導入）

---

### [中-3] 同期パスワードが Zustand ストアに平文保持・persist 対象外だが生存期間が長い

- **重大度**: 中
- **対象ファイル**: `ideamap/src/stores/settingsStore.ts` — `syncPassword: string` フィールド、`SettingsPanel.tsx`（行 11）
- **現状**: Drive 同期に使う `syncPassword` はページ滞在中メモリに平文保持される。`partialize` で `localStorage` への persist は除外されており、リロードで消える。ただし XSS が成立した場合は `useSettingsStore.getState().syncPassword` で取得可能。
- **リスク / 影響**: syncPassword が漏洩すると Drive 上の暗号化済み API キー（`settings.json`）を復号できる。二段階の秘密がどちらも同一ページのメモリにあるため、XSS 1 回で両方が漏洩するリスクがある。
- **推奨対応**: syncPassword は使用直前のみ prompt ダイアログで入力させ、ストアには保持しない設計が望ましい。Drive 同期操作は頻繁ではないため UX 影響は小さい。
- **推定工数**: 小

---

### [中-4] 共有 URL にマップデータ全体を base64 エンコード埋め込み

- **重大度**: 中
- **対象ファイル**: `ideamap/src/services/exportService.ts` — `generateShareUrl()`（行 267-273）
- **現状**: マップデータ全体を JSON→base64 変換して `?map=...` クエリパラメータに埋め込む。URL をコピーして共有する設計。
- **リスク / 影響**:
  - ブラウザの閲覧履歴・ブックマークにマップデータが残存する
  - URL をコピー＆ペーストした場合に Slack / メール等のリンクプレビューがサーバーに URL を送信し、結果的にマップデータがサードパーティサーバーのログに残る
  - API キーは URL に含まれないため機密度は低いが、アイデアコンテンツが意図せず漏洩するリスクがある
  - 50,000 文字超で警告あり（実装済み）
- **推奨対応**: 個人ツールとしては現状維持でも許容範囲。機密性が高いマップには使用しないよう UI 上での注意書きを強化する（現在の注意書きは十分）。抜本的には短縮URL + サーバーサイドストレージが必要だが SPA 設計に反する。
- **推定工数**: 低（注意書き強化のみなら小）

---

### [中-5] JSON インポート時の型検証が不十分（プロトタイプ汚染リスクは低いが構造検証が弱い）

- **重大度**: 中
- **対象ファイル**: `ideamap/src/services/exportService.ts` — `importFromJson()`（行 172-189）、`parseMapFromUrl()`（行 277-289）
- **現状**: `JSON.parse()` 後に `Array.isArray(data.nodes) && Array.isArray(data.edges)` のみ確認して受け入れている。各ノードの `id`、`title`、`x`、`y` の型・範囲・最大値チェックなし。
- **リスク / 影響**:
  - プロトタイプ汚染：`JSON.parse()` は `__proto__` キーを含む JSON を Object.prototype に混入させないため、最新 V8 エンジンでは現実的リスクは低い。
  - DoS：非常に大きな `nodes` 配列（例: 10 万件）が渡された場合、React Flow のレンダリングで UI がフリーズする可能性がある。
  - 任意 HTML 埋め込み：`title` や `body` フィールドに長大な文字列や制御文字が含まれていても受け入れる。ただしレンダリング時に `renderMarkdownSimple` が HTML エスケープするため現状の XSS リスクは低い。
- **推奨対応**: `zod` 等のスキーマバリデーションを導入し、ノード数の上限（例: 500件）と各フィールドの型・長さを検証する。
- **推定工数**: 中

---

### [低-1] Google アクセストークンの sessionStorage 保存

- **重大度**: 低
- **対象ファイル**: `ideamap/src/hooks/useGoogleAuth.ts` — `saveTokenToSession()`（行 23-27）
- **現状**: Google OAuth アクセストークンを `sessionStorage` に保存してタブ間共有しない設計（`localStorage` より安全）。スコープは `drive.file` と `userinfo.email` のみで最小権限。
- **リスク / 影響**: XSS が成立した場合は `sessionStorage` から直接取得可能。ただし GIS Implicit Flow トークンは短命（1時間）で、自動更新は `tokenClientRef` 経由でポップアップを必要とするため、漏洩後の継続悪用は困難。
- **推奨対応**: 現状は適切な設計。XSS 対策（[中-2]）を優先することで間接的にリスクを低減できる。
- **推定工数**: 不要

---

### [低-2] `.env` ファイルがリポジトリに存在（Google Client ID を含む）

- **重大度**: 低
- **対象ファイル**: `ideamap/.env`（Google Client ID: `1000155830526-5n7i127in5vhhlpa375gepekaeururlj.apps.googleusercontent.com`）
- **現状**: `.gitignore` で `.env` は除外対象に指定されているため、通常の git 操作では公開リポジトリに push されない。`VITE_GOOGLE_CLIENT_ID` はビルド時にバンドルへ埋め込まれ、本番配信時もブラウザから参照可能な値である。
- **リスク / 影響**: Google Client ID 自体は機密情報ではなく、GCP Console で OAuth クライアントの許可オリジンを適切に制限していれば漏洩しても悪用できない。ただし `.env` ファイルが誤って push された場合、Client ID が git 履歴に残るリスクがある。
- **推奨対応**: GCP Console で OAuth クライアントの「承認済みの JavaScript 生成元」を本番ドメインのみに制限していることを確認する。`.env` の git 管理状態を定期確認する（`git status` でトラッキングされていないこと）。
- **推定工数**: 不要（設定確認のみ）

---

### [低-3] `prompt: ''` による自動再認証（ユーザー同意なし）

- **重大度**: 低
- **対象ファイル**: `ideamap/src/hooks/useGoogleAuth.ts` — `scheduleRefreshAt()`（行 88-99）、`requestAccessToken({ prompt: '' })`
- **現状**: ページロード時および `visibilitychange` イベント時に `AUTO_AUTH_FLAG='true'` であれば UI を表示せずに `prompt: ''` でトークン更新を試みる。
- **リスク / 影響**: 設計上の意図は正しくユーザー体験向上のための実装。GIS の `prompt: ''` はポップアップなしで既存の同意を利用するが、ユーザーがサインアウトを意図していない限り問題ない。`access_denied` 時はフラグを削除する処理も実装済み。
- **推奨対応**: 現状は問題なし。`AUTO_AUTH_FLAG` が `localStorage` に残ることで共有 PC でのリスクがあるが、これは `signOut()` でクリア済み（行 251）。
- **推定工数**: 不要

---

## 付録: npm audit 結果サマリ（2026-06-28 実行）

| 重大度 | 件数 | 対象パッケージ | CVE/Advisory |
|--------|------|----------------|--------------|
| high   | 1    | vite 8.0.0-8.0.15 | GHSA-fx2h-pf6j-xcff（`server.fs.deny` bypass, CWE-22/200） |
| moderate | 1  | vite 8.0.0-8.0.15 | GHSA-v6wh-96g9-6wx3（NTLMv2 hash disclosure, CWE-73/522） |
| low    | 0    | —              | — |

- **総脆弱性数**: 2件（1パッケージ）
- **修正可否**: `npm update vite` で fixAvailable
- **本番影響**: vite は devDependencies のみ。プロダクションバンドルには含まれず、`dev` サーバーを公開ネットワークに晒していなければ実害リスクは低い。

> 生結果は `ideamap/` ディレクトリ内で `npm audit --json` を実行して確認できる。
