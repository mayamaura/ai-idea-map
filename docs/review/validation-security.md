# セキュリティレビュー 検証レポート — IdeaMap

検証日: 2026-06-28  
対象: `docs/review/security.md`（一次レポート 2026-06-28）  
検証方法: Web調査（WebSearch / WebFetch）+ 実コード確認  

---

## 検証サマリ

一次レポートからの主な変更点を以下にまとめる。

| 指摘ID | 判定 | 変更概要 |
|--------|------|---------|
| 高-1 | REFINED | `dangerouslyAllowBrowser` の公式スタンスを追記。BYOK パターンは公式が明示的に許容。spend cap（Monthly Spend Limit）の存在を補強 |
| 高-2 | REFINED | IndexedDB + `extractable:false` 方式の「XSS に対しては無効」という重大な落とし穴を追記。一次レポートの推奨 A（IndexedDB）の限界を明確化 |
| 高-3 | REFINED | CVE 番号・CVSS スコアを更新（CVE-2026-53571、CVSS 7.5～8.2）。修正版として 8.0.16 を確認 |
| 中-2 | REFINED | Markdown サニタイズ方針を「DOMPurify 単体導入（推奨）」に変更。react-markdown への全面移行は過剰工数と判断。独自堅牢化は中リスク継続として非推奨 |

---

## 各指摘の検証結果

---

### [高-1] Claude API キーのブラウザ直接呼び出し（構造的リスク）

**判定: REFINED**

**最新事情:**  
Anthropic 公式 TypeScript SDK ドキュメント（2026 年時点）では、`dangerouslyAllowBrowser: true` について以下のシナリオを「危険でない可能性がある（might not be dangerous）」として明示的に認めている。

> "Open-source webapps: You can store users' API keys in localStorage and only send them directly to Anthropic, allowing more tinkering-style apps"  
> "Internal Tools: If the application is used solely within a controlled internal environment where the users are trusted"

すなわち **BYOK（Bring Your Own Key）パターン**——ユーザー自身が自分のキーをアプリに持ち込む構成——は Anthropic 公式が許容するユースケースとして文書化されている。IdeaMap はまさにこのパターンに該当する。

一方で Hacker News での議論では、OAuth 対応がない現状では API Key ベースが唯一の選択肢であり、コミュニティも BYOK を現実解として受け入れている。

**最終推奨（更新）:**  
- 緩和策 A（Anthropic Console での Monthly Spend Limit 設定）: **引き続き最優先**。これは Anthropic 公式ドキュメントが明示する緩和策に合致する。  
- 緩和策 B（プロキシ）: 個人 BYOK ツールとしての性格上、過剰工数。構造変更なら一次レポートの判断を維持。  
- 追加緩和策 C: キーのスコープを `claude.ai` 関連のみに絞った **専用キーを使用する**よう UI で促す。キーロールオーバーの頻度も案内する（Anthropic ベストプラクティス準拠）。  

**出典:**  
- [Anthropic TypeScript SDK — Browser usage セクション](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript)  
- [API Key Best Practices — Anthropic Help Center](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure)  
- [HN: dangerouslyAllowBrowser の意味についての議論](https://news.ycombinator.com/item?id=41326384)

---

### [高-2] ローカル保管の API キー暗号化が実質無効

**判定: REFINED（推奨 A の評価を下方修正）**

**最新事情（IndexedDB + extractable:false の落とし穴）:**  
一次レポートの「推奨対応 1: `extractable: false` で IndexedDB に保存」には重大な制約がある。

> "extractable is only facing JavaScript, not hackers"  
> "client-side crypto does not protect against XSS, and if an attacker runs JavaScript on your page, they can use your keys"

`extractable: false` の CryptoKey は JavaScript から生の鍵素材を**エクスポートできない**が、**その鍵を使って暗号化・復号を実行する関数は呼び出せる**。XSS が成立すれば攻撃者は鍵素材を抜かずとも、鍵を使って API キーを復号できる。つまり `extractable: false` + IndexedDB は**「XSS に対しては何の防御にもならない」**という本質的な限界がある。

さらに、コピーされたブラウザプロファイル（SQLite ファイル直接読み取り）に対しても IndexedDB は保護を提供しない。これは現行の localStorage 方式と本質的リスクは同等である（どちらも物理アクセスやブラウザプロファイルコピーに脆弱）。

**最終推奨（更新）:**  
1. **推奨 A（改訂）: 現行 localStorage 暗号化の廃止 + セッションメモリのみ保持**  
   最も安全かつシンプルな設計。ページ滞在中のみ Zustand ストアに保持し、リロードで消える。IndexedDB 移行は XSS 耐性を高めず、工数対効果が低い。  
2. **推奨 B（維持）: `encryptWithPassword()`（Drive 同期用）は現行のまま**  
   `syncPassword` をユーザーが入力する本物のパスワードとして使う設計は正しい。ここは一次レポートの評価を維持する。  
3. **補足**: ハードコードパスフレーズ `'ideamap-v1'` による「デバイスローカル暗号化」は依然 security theater であり早急な廃止が妥当。

**出典:**  
- [Saving Web Crypto Keys using IndexedDB — GitHub Gist](https://gist.github.com/saulshanabrook/b74984677bccd08b028b30d9968623f5)  
- [Auth/DPoP: non-extractable keys の限界についての議論](https://github.com/dollspace-gay/proto-blue/issues/12)  
- [Storing keys in a non-extractable way — nodejs/webcrypto](https://github.com/nodejs/webcrypto/issues/13)

---

### [高-3] Vite 依存パッケージに high 脆弱性（Windows パス bypass）

**判定: REFINED（CVE 情報を更新）**

**最新事情:**  
この脆弱性は 2026-06-01 に正式発行された **CVE-2026-53571**（GHSA-fx2h-pf6j-xcff）として確認済み。

| 項目 | 内容 |
|------|------|
| CVE | CVE-2026-53571 |
| CVSS スコア | 7.5～8.2（High） |
| 影響バージョン | Vite 8.0.0–8.0.15、7.0.0–7.3.4、6.4.2 以前 |
| 修正バージョン | **8.0.16**、7.3.5、6.4.3 |
| 攻撃内容 | NTFS ADS パス形式（`/.env::$DATA?raw` 等）で `server.fs.deny` をバイパスし機密ファイルを読み取り |

一次レポートの「8.0.16 以上にアップデート」は**正確**。本プロジェクトは Windows 11 上で開発しているため、開発サーバー稼働中に `--host` を使っている場合は `.env` ファイルが外部から読み取られるリスクがある。

**最終推奨（維持・補強）:**  
- `npm update vite` で即時 8.0.16+ に更新する（小工数、早急）。  
- 開発中も `--host` フラグを使わない（ローカル限定で起動する）。  
- 環境ファイル（`.env`）を `server.fs.allow` ディレクトリの外に配置することも有効な追加緩和策。  

**出典:**  
- [GitHub Advisory: GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)  
- [Eventus Security Advisory: Vite Vulnerability Exposes Environment Files on Windows](https://advisory.eventussecurity.com/advisory/vite-vulnerability-exposes-environment-files-on-windows/)

---

### [中-1] API キーがメモリ（Zustand ストア）に平文保持

**判定: CONFIRMED**

一次レポートの評価は妥当。XSS 対策（[中-2]）を優先するという方針も維持。

ただし [高-2] の更新と一致させると：localStorage の暗号化を廃止してセッションメモリのみ保持する場合、Zustand ストア上の平文保持は**設計上避けられない**。その場合は XSS 対策が唯一の防御線となるため [中-2] の優先度がより高まる。

**最終推奨（維持）:** [中-2] の XSS 対策を先行し、その後 [高-2] の設計変更を実施する順序が合理的。

---

### [中-2] `dangerouslySetInnerHTML` + 独自 sanitizer の組み合わせ

**判定: REFINED（ライブラリ選定を具体化）**

詳細は「Markdown サニタイズ方針の結論」セクションを参照。

---

### [中-3] 同期パスワードが Zustand ストアに平文保持

**判定: CONFIRMED**

一次レポートの評価・推奨は妥当。追加情報なし。

---

### [中-4] 共有 URL にマップデータ全体を base64 エンコード埋め込み

**判定: CONFIRMED**

個人ツールとしての許容範囲という評価は妥当。追加情報なし。

---

### [中-5] JSON インポート時の型検証が不十分

**判定: CONFIRMED**

Zod 導入推奨は妥当。プロトタイプ汚染の現実的リスクが低いという評価も正確（現代 V8 エンジンの挙動に依拠）。

---

### [低-1] Google アクセストークンの sessionStorage 保存

**判定: CONFIRMED**

sessionStorage の使用は適切な設計。GIS Implicit Flow の短命トークンという制約も変わらない。

---

### [低-2] `.env` ファイルがリポジトリに存在

**判定: CONFIRMED**

ただし [高-3] の Vite 脆弱性（CVE-2026-53571）との組み合わせで、開発中に `--host` を使う場合は `.env` が外部から読み取られるリスクが具体化するため、[高-3] の修正と同時に注意を払うべき。

---

### [低-3] `prompt: ''` による自動再認証

**判定: CONFIRMED**

一次レポートの評価は妥当。

---

## Markdown サニタイズ方針の結論

### 現状の `renderMarkdownSimple()` の評価

```typescript
// utils/markdown.ts — 現行実装（15行）
text.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // ... タグ生成
```

**現状の安全性**: 入力全体を先にエスケープしてからタグを生成するため、ユーザーが `<script>` を入力しても `&lt;script&gt;` になり XSS にはならない。**現時点での実害リスクは低い**。

**将来リスク**: 正規表現ベースの独自実装は「将来のパターン追加時に XSS を混入させやすい設計」である点が問題。コードレビューが必須で、メンテナー交代時の品質維持が困難。

---

### ライブラリ選定比較

| 項目 | DOMPurify 単体 | react-markdown + rehype-sanitize | 独自実装を堅牢化 |
|------|----------------|----------------------------------|-----------------|
| バンドルサイズ増加 | **小**（minified ~26KB、gzip ~7–10KB） | **大**（react-markdown 本体 + unified エコシステム、gzip 換算で ~40–80KB 以上） | ゼロ |
| 実装コスト | **小**（1–2時間） | 中（依存追加 + コンポーネント書き換え） | 中（DOMParser + ホワイトリスト） |
| 信頼性 | 高（cure53 監査済み、週次リリース） | 高（remarkjs/rehype エコシステム） | 低（独自実装のレビュー負荷） |
| 将来拡張性 | 中（Markdown 構文拡張には向かない） | 高（remark プラグインで機能追加容易） | 低 |
| 本プロジェクトへの適合度 | **高**（現行の独自 Markdown 構文を維持しつつ安全化） | 低（既存の Tailwind クラス付きタグ出力との互換が困難） | 低 |

**バンドルサイズの詳細根拠:**  
- DOMPurify: v3.4.11（2026-06-17 リリース）、minified < 30 KB、gzip 約 7–10 KB（推測）  
- react-markdown: v10.x、unified エコシステムの依存により dependencies が多く、rehype-sanitize・rehype-raw を追加するとトータル gzip 換算で 40–80 KB 超になると推定される（推測）  
  ※ 正確な数値は bundlephobia.com での確認を推奨（2026-06 時点でページ取得不可のため推定）  

### 結論: **DOMPurify 導入（推奨）**

`react-markdown` への全面移行は以下の理由で**推奨しない**:

1. 現行の `renderMarkdownSimple()` は Tailwind のクラス名を直接タグに埋め込む設計（`<h1 class="text-sm font-bold...">`）であり、react-markdown の ComponentPropsWithoutRef ベースのカスタマイズと互換性がない。全コンポーネントの書き換えが必要。
2. unified エコシステムのバンドルサイズ増加が、別途改善課題として挙げられているバンドル肥大と逆行する。
3. react-markdown 自体は `dangerouslySetInnerHTML` を使わないが、`rehype-raw` を追加しない限り HTML タグを出力できず、現行の Tailwind クラス付きタグ出力が失われる。

**推奨実装手順:**

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```typescript
// utils/markdown.ts に追加
import DOMPurify from 'dompurify'

export function renderMarkdownSimple(text: string): string {
  const raw = text
    .replace(/&/g, '&amp;')
    // ... 既存の変換ロジック（変更なし）
    .replace(/\n/g, '<br />')

  // DOMPurify で最終サニタイズ（許可タグを明示的にホワイトリスト化）
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'strong', 'em', 'code', 'li', 'br'],
    ALLOWED_ATTR: ['class'],
  })
}
```

この変更により:
- 独自実装の将来的な XSS 混入リスクを DOMPurify がバックストップとして防ぐ
- 既存コンポーネント（IdeaNode, PresentationMode, NodeDetailPanel, NodePanel）の変更ゼロ
- `ALLOWED_TAGS` ホワイトリストにより意図しないタグが生成されても無害化される
- バンドル増加は gzip 約 7–10 KB（推定）の最小限

---

## 参考文献

| URL | 参照用途 |
|-----|---------|
| https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript | Anthropic SDK ブラウザ使用の公式スタンス |
| https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure | Anthropic API キーベストプラクティス |
| https://news.ycombinator.com/item?id=41326384 | dangerouslyAllowBrowser に関するコミュニティ議論 |
| https://gist.github.com/saulshanabrook/b74984677bccd08b028b30d9968623f5 | WebCrypto + IndexedDB パターン解説 |
| https://github.com/nodejs/webcrypto/issues/13 | extractable:false の限界についての議論 |
| https://github.com/dollspace-gay/proto-blue/issues/12 | non-extractable CryptoKey の XSS 耐性限界 |
| https://github.com/advisories/GHSA-fx2h-pf6j-xcff | CVE-2026-53571 Vite 脆弱性の GitHub Advisory |
| https://advisory.eventussecurity.com/advisory/vite-vulnerability-exposes-environment-files-on-windows/ | Vite 脆弱性の詳細解説（Eventus Security） |
| https://github.com/cure53/DOMPurify | DOMPurify 公式リポジトリ（v3.4.11） |
| https://strapi.io/blog/react-markdown-complete-guide-security-styling | react-markdown のセキュリティ設定ガイド |
| https://www.npmjs.com/package/dompurify | DOMPurify npm パッケージページ |
| https://www.npmjs.com/package/react-markdown | react-markdown npm パッケージページ |
