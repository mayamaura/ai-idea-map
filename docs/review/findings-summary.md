# レビュー統合サマリ（検証済み最終版）— IdeaMap

レビュー日: 2026-06-28

本書は4観点の一次レビュー（`security.md` / `refactoring.md` / `performance.md` / `ux.md`）を、
オーケストレーターによる**直接コード検証**および**相互レビュー＋Web調査**（`validation-security.md` /
`validation-tech.md` / `validation-ux.md`）で訂正・確定した最終統合版である。

---

## 0. 検証で判明した一次レビューの主な誤り（重要）

| 項目 | 一次レビューの主張 | 検証結果（確定） |
|---|---|---|
| ファイル行数 | claudeService 733/487行, AIChatPanel 795行, IdeaCanvas 700+行 | 実測: claudeService=**400**, AIChatPanel=**460**, IdeaCanvas=**367**, mapStore=**1032**。「肥大化」は **mapStore のみ** |
| Markdown描画 | project-overview「react-markdown 使用・XSS耐性あり」 | **誤り**。独自 `renderMarkdownSimple()` を `dangerouslySetInnerHTML` で4箇所使用。react-markdown 未使用 |
| 暗号化対策[高-2] | IndexedDB の `extractable:false` 鍵へ移行 | **Web検証で否定**。XSS時は鍵を「使う」だけで復号でき無意味。正解は localStorage暗号化撤廃＋セッションメモリのみ |
| APIキー露出[高-1] | 「構造的リスク」 | **過大**。Anthropic公式がBYOK/ブラウザ直接利用を許容ユースケースに明記。spend-limit案内で十分、プロキシ不要 |
| Markdown修正案 | react-markdown + rehype-sanitize | **過剰**。DOMPurify単体（gzip +約7-10KB）で十分 |
| UX[高-7] selectedNodeId残存 | 高優先のバグ | **実質誤検知**。3経路とも `setSelectedNodeId(null)` 済み → 格下げ |
| perf[高] IdeaNode二重find | 12,000回/秒の高負荷 | 理論値過大。実発火頻度は低く重要度 高→**中** |

> 教訓: 一次レビューの「行数」「ライブラリ使用」「定量的負荷」の記述には誤りが混在していた。
> 以降の数値・事実は本書（検証済み）を正とする。

---

## 1. 重要度 × 工数マトリクス（検証後）

| | 工数 小 | 工数 中 | 工数 大 |
|---|---|---|---|
| **重要度 高** | vite更新, uiStoreバグ, DOMPurify, AISuggestionPanelダーク, Esc挙動統一, 削除確認(2箇所), ロングプレスガード, vite manualChunks, IdeaNodeセレクタ統合 | encryption保管方式見直し, displayNodes/Edges最適化, mapStoreスライス分割 | （なし） |
| **重要度 中** | createClient集約, APIキー注意書き, パネルセレクタ最適化, window.prompt→Dialog(一部) | グループジオメトリ抽出, html-to-image/dagre遅延ロード, aria/フォーカストラップ | スマホ実機確認(Phase25/26) |
| **重要度 低** | 各種DRY(ApiKeyRequired/expandGroupIds), ショートカット一覧追記, スライダーUI | 後方互換処理の集約 | （見送り）claudeService/AIChatPanel分割 |

---

## 2. 確定した改善項目（カテゴリ別・検証済み）

### セキュリティ（出典: validation-security.md）
- **vite 8.0.16+ へ更新**（CVE-2026-53571 / CVSS 7.5-8.2）[小・最優先・確定]
- **encryption.ts のハードコードパスフレーズ `'ideamap-v1'` 廃止**＋APIキー保管方式の見直し [中・**要方針判断**]
- **DOMPurify 導入**で `renderMarkdownSimple()` 出力をホワイトリスト sanitize（`ALLOWED_TAGS: ['h1','h2','h3','strong','em','code','li','br']`）[小]
- APIキー入力欄に **spend-limit 設定 + 専用キー** の案内を表示 [小]
- （低）JSONインポートの簡易スキーマ検証（zod等）/ 共有URL注意書きは現状維持で可

### パフォーマンス（出典: validation-tech.md）
- **vite.config.ts に manualChunks** でベンダー分割（811kB単一チャンク → 分割）[小・効果大]
- **IdeaNode の二重 `find()` をセレクタ統合＋`useShallow`**（NodeActionBar の二重findも同時）[小]
- **displayNodes / displayEdges の全ノード・全エッジ `.map()` 最適化**（dim状態を各ノードで自己購読）[中]
- パネル群 / Toolbar / Header の **Zustandセレクタ最適化**（ストア全体購読をやめる）[小〜中]
- html-to-image / @dagrejs/dagre の **動的 import 遅延ロード** [中]

### リファクタリング（出典: validation-tech.md）
- **claudeService.ts の `new Anthropic()` 5重複を `createClient()` に集約** [小]
- **mapStore.ts のグループジオメトリ4関数を `utils/` へ抽出**（mapLayout.ts の重複も解消）[中]
- **mapStore.ts(1032行) の責務分割**（履歴/ノード/エッジ/グループのスライス化）[中] ← 唯一の真の肥大化ファイル
- 小規模DRY: `ApiKeyRequired` 共通化、`expandGroupIds` 共通化、後方互換処理の集約 [小]
- **見送り**: claudeService.ts(400)・AIChatPanel.tsx(460) の分割（通常サイズのため不要）

### UX（出典: validation-ux.md）
- **AISuggestionPanel のダークモード対応**（`dark:` クラス皆無）[小]
- **NodeDetailPanel の Esc / 背景クリック挙動を統一**（現状コミット扱い→破棄 or 明示確認）[小]
- **NodeActionBar の削除に確認**（接続線あり時。右クリックメニューと整合）[小]
- **AIチャット履歴クリアに確認ダイアログ** [小]
- **接続モード中ロングプレス二重発火ガード**（`handleTouchStart` に `connectingFromNodeId` ガード）[小]
- window.prompt（エッジ/グループラベル）を `InputDialog` 化 [中]
- エラーフィードバック拡充 / aria属性 / モーダルのフォーカストラップ [中]
- グループ削除ダイアログの文言バグ修正（message が2択を示唆するがボタン1つ）[小]

### 「実装済み（確認中）」フェーズの確定
- Phase 14（AIチャット）/ 18（UX小改善）/ 25・26（スマホ）の動作確認。
- スマホは実機確認チェックリスト（`ux.md` に Phase14:15項目・Phase18:9項目・Phase25:11項目・Phase26:12項目）を使用。
- 最優先実機確認: **接続モード中ロングプレス二重発火**（UX高-4）。

---

## 3. Phase 27 以降の構成案（検証反映版）

### Phase 27: セキュリティ & 確定バグ修正（規模: 小〜中）
- [ ] vite を 8.0.16+ に更新（CVE-2026-53571）
- [ ] `uiStore.ts:243` `setSearchOpen` バグ修正（`open ? '' : ''`）
- [ ] `encryption.ts` ハードコードパスフレーズ廃止＋APIキー保管方式の変更（→ 要判断）
- [ ] DOMPurify 導入で `renderMarkdownSimple()` 出力を sanitize
- [ ] APIキー入力欄に spend-limit / 専用キーの注意書き

### Phase 28: パフォーマンス最適化（規模: 小〜中）
- [ ] vite.config.ts manualChunks でベンダー分割
- [ ] IdeaNode / NodeActionBar のセレクタ統合 + useShallow
- [ ] displayNodes / displayEdges の全map最適化（各ノード自己購読化）
- [ ] パネル / Toolbar / Header のセレクタ最適化
- [ ] html-to-image / dagre の動的 import

### Phase 29: リファクタリング（規模: 小〜中）
- [ ] claudeService.ts `createClient()` 集約
- [ ] mapStore.ts グループジオメトリ4関数を utils へ抽出（重複解消）
- [ ] mapStore.ts のスライス分割（履歴/ノード/エッジ/グループ）
- [ ] 小規模DRY（ApiKeyRequired / expandGroupIds / 後方互換集約）

### Phase 30: UX 改善バッチ（規模: 小〜中）
- [ ] AISuggestionPanel ダークモード対応
- [ ] NodeDetailPanel Esc / 背景クリック挙動の統一
- [ ] NodeActionBar 削除確認 / チャット履歴クリア確認
- [ ] 接続モード中ロングプレス二重発火ガード
- [ ] window.prompt → InputDialog、エラーフィードバック / aria / フォーカストラップ

### Phase 31: 「確認中」フェーズの動作確認 & 確定（規模: 中）
- [ ] Phase 25/26 スマホ実機確認（ロングプレス二重発火を最優先）
- [ ] Phase 14 AIチャットのアクション動作確認
- [ ] Phase 18 UX小改善の動作確認
- [ ] `implementation-plan.md` のステータスを `[x]✅` / `✅ 完了` に更新

---

## 4. 要ユーザー判断（着手前）

1. **APIキー保管方式**（最重要）: ①セッションメモリのみ（暗号化撤廃・毎回再入力＝最も安全） / ②現状維持＋注意書きのみ（再入力不要だが暗号化は形骸のまま） / ③ユーザー設定のマスターパスワードで暗号化（起動時に1回入力）。
   - 旧案の「IndexedDB移行」は検証により無効と判明したため選択肢から除外。
2. **Phase 実施順**: 提案順（27→31）か、UX/即効性を先行させるか。
3. **mapStore 分割の深度**: ジオメトリ抽出のみ（低リスク）か、スライス分割まで踏み込むか（推奨: 抽出＋軽量スライス）。
