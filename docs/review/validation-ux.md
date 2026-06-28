# UX レビュー 検証レポート — IdeaMap プロジェクト

**検証日**: 2026-06-28  
**検証対象**: `docs/review/ux.md` の各指摘をソースコードで相互検証  
**検証者**: コードリーディングのみ（実機テストなし）

---

## 検証サマリ

一次レビューの精度は全体的に高い。高優先7件のうち5件は CONFIRMED、1件は REFINED（実質的な指摘は正しいが詳細に訂正あり）、1件は REFUTED（誤検知）。中優先では【中-3】のグループ削除2択ダイアログ説明が実コードと食い違うため REFINED。

### 一次レビューからの変更点

| 指摘 | 判定変更 | 内容 |
|------|---------|------|
| 高-2 AISuggestionPanel ダーク未対応 | CONFIRMED（強化） | 最外 `div` と内部要素を全件確認。`dark:` クラスが一切ない。全体が白で浮く問題は確定 |
| 高-3 NodeDetailPanel Esc がコミット | REFINED | 指摘の行番号（L48-55）は正確。ただし「バックグラウンドクリック（`commitAndClose`）も同様にコミット扱い」の点が一次レビューに抜けている。Esc だけでなく背景クリックも同じ問題 |
| 高-7 削除後 selectedNodeId 残存 | REFUTED（部分否定） | ショートカットキー（Delete/Backspace）の `deleteSelected()` は L126-129 で `activeNode?.selected` チェック後に `setSelectedNodeId(null)` を呼んでいる。「`selected=false` かつ `selectedNodeId` が設定されている」状態は通常発生しにくい。ただしキーボードショートカット以外（例: `mapStore.deleteNode()` 直接呼び出し経路）では選択解除が漏れる可能性は残るため、REFUTED ではなく「低優先度に格下げ REFINED」が適切 |
| 中-3 グループ削除の2択 | REFINED | 一次レビューは「ダイアログで2択を提供」と推奨しているが、`handleDeleteGroupChoice` のコードを見ると `openConfirmDialog` の message に「グループ枠のみ解除して子ノードを残すか選択してください」と書いてある（L187-188）にもかかわらずダイアログには「グループと子を削除」ボタンしかなく、グループ解除の手段がダイアログ内に実在しない。実態はむしろダイアログの文言とUIが矛盾している（「選択してください」と言って1択しかない）点が問題 |
| 低-5 Ctrl+Shift+C が操作ガイド未記載 | CONFIRMED | `KeyboardShortcutsModal.tsx` の SHORTCUTS を確認。「表示・検索」セクションに `Ctrl+Shift+C` の行がなく、実装済みショートカットが一覧に載っていないことを確認 |

---

## 高・中指摘の検証結果

### 【高-1】NodeActionBar 削除ボタン：確認なし即削除 — CONFIRMED

- **コード確認**: `IdeaCanvas.tsx` L89 `onClick={() => { deleteNode(selectedNodeId); setSelectedNodeId(null) }}`
- **補足**: 右クリックメニューの `handleDeleteNode`（`ContextMenu.tsx` L142-165）は `hasConnectedEdges(targetId)` をチェックして接続ありで `openConfirmDialog` を呼ぶのに対し、NodeActionBar は接続有無を確認せずに即削除する。非対称性は確定的。
- **訂正 file:line**: `IdeaCanvas.tsx` L89（一次レビューの L89-96 と一致、問題の本体は L89 の onClick）

### 【高-2】AISuggestionPanel ダークモード未対応 — CONFIRMED（指摘強化）

- **コード確認**: `AISuggestionPanel.tsx` 全文を確認。最外ラッパー `div`（L252）が `bg-white`。内部の `border-gray-100`、`text-gray-800`、`text-gray-700`、`text-gray-500`、`text-gray-400`、`bg-gray-50`、`border-gray-200` 等すべてに `dark:` クラスが存在しない。
- **比較**: `AIChatPanel.tsx` は `dark:bg-gray-800`、`dark:border-gray-700` 等を持ち、`NodeDetailPanel.tsx` も同様。AISuggestionPanel だけが完全な非対応。
- **訂正**: 一次レビューの記述通り。誤検知なし。

### 【高-3】NodeDetailPanel Esc がコミット扱い — REFINED（指摘は正しいが補足あり）

- **コード確認**: `NodeDetailPanel.tsx` L49-51 で `e.key === 'Escape'` → `commitAndClose()` を呼び出すことを確認。IdeaNode の L99-102 では逆に `editText.current = nodeData.title; setEditingNodeId(null)`（破棄）。
- **追加指摘**: 背景クリック（L113 `onClick={commitAndClose}`）も同様にコミット扱いになる。背景クリックは「閉じる」の直感的操作なので、ここで保存されるのも一貫性の問題として同等の摩擦を生む。
- **訂正 file:line**: L49-51（Esc）、L113（背景クリック）の2箇所が問題箇所

### 【高-4】接続モード中ロングプレス二重発火 — CONFIRMED（要実機確認）

- **コード確認**: `IdeaNode.tsx` L108-120 の `handleTouchStart` 内に `connectingFromNodeId` チェックが存在しないことを確認。`longPressTimer.current = setTimeout(...)` は `connectingFromNodeId` が非null のときも無条件に実行される。
- **流れ**: 接続モード中に別ノードをタップ → `IdeaCanvas.tsx` の `handleNodeClick`（L144）で接続完了 → 同時に `handleTouchStart` の 500ms タイマーも起動 → 500ms 後にコンテキストメニューが開く可能性。
- **コードで確定できる部分**: ガード処理が存在しないことは確定。実際の二重発火の頻度は実機タップ速度に依存するため「実機確認」ラベルは妥当。
- **訂正 file:line**: `IdeaNode.tsx` L108（handleTouchStart の先頭にガードが必要）

### 【高-5】AIチャット履歴クリア確認なし — CONFIRMED

- **コード確認**: `AIChatPanel.tsx` L266-272 の「クリア」ボタン onClick に `clearChatHistory()` 直接呼び出し。`openConfirmDialog` は呼ばれていない。
- **訂正 file:line**: L267（一次レビューの L265-272 と一致）

### 【高-6】WelcomeModal の接続説明がスマホユーザーに誤誘導 — CONFIRMED

- **コード確認**: `WelcomeModal.tsx` L11-13 の `STEPS[1]`（「アイデアをつなぐ」）の説明文は「ノードにカーソルを合わせるとハンドルが現れます。ドラッグして別のノードへ接続しましょう。」のみ。スマホ向けの補足（接続モード方式）は一切ない。
- **追加観察**: `STEPS[0]`（「アイデアを追加」）には「左下の「+」ボタン」の言及があり、スマホを意識した記述が混在している。STEPS[1] だけが PC 前提のままになっている。
- **訂正 file:line**: `WelcomeModal.tsx` L13（STEPS[1].desc）

### 【高-7】削除後 selectedNodeId 残存 — REFINED（REFUTED から低優先 REFINED に変更）

- **コード確認**: `useKeyboardShortcuts.ts` L121-130 を確認。Delete/Backspace キーの処理では `map.deleteSelected()` の後に `if (activeNode?.selected) ui.setSelectedNodeId(null)` を呼んでいる。この判定は `activeNode` が `selected=true` のときのみ選択解除するが、通常ユーザーがDeleteキーを押す状況では `selectedNodeId` と `node.selected` は一致している（`setSelectedNodeId` と `selectOnlyNode` が連動して呼ばれる）。
- **残存リスク**: `mapStore.deleteNode()` 直接呼び出し（NodeActionBar や NodeDetailPanel）では `setSelectedNodeId(null)` が別途呼ばれている（IdeaCanvas.tsx L89、NodeDetailPanel.tsx L95）。実際のゴースト状態が発生する経路は限定的。
- **判定**: 理論上のリスクはあるが、実際の再現ケースが具体的でないため「高」から「低-8」相当に格下げ。

### 【中-3】グループ削除の ConfirmDialog 文言の矛盾 — REFINED（より深刻）

- **コード確認**: `ContextMenu.tsx` L184-193 の `handleDeleteGroupChoice` を確認。ダイアログ `message` に「グループ枠のみ解除して子ノードを残すか選択してください。」と書いてあるが（L188）、`confirmLabel` は「グループと子を削除」のみで「解除」ボタンは存在しない。
- **判定**: 一次レビューは「非対称さ」と述べているが、実際は「2択の選択をうながしながら選択肢が1つしかない」というダイアログ文言のバグ。message を「このノードの子ノードを含めてすべて削除します。」に修正するだけで解決する。

---

## 「要実機確認」項目の仕分け

### コードで確定できる（実機不要）

| 指摘 | 確定内容 |
|------|---------|
| 高-4 ロングプレス二重発火 | ガード処理が存在しないことはコードで確定。発火頻度のみ実機依存 |
| 中-7 接続モードバナー PC 全幅 | `IdeaCanvas.tsx` L319 で `left: 0, right: 0` 固定。スマホ/PC 問わず全幅が確定 |
| 低-4 エンプティ状態のダブルクリック | `onDoubleClick` ハンドラーはあるが、`dblclick` イベントがモバイルで発火しない点は仕様上の事実。コードは `onDoubleClick` のみ実装。スマホでは機能しないことはコードから確定 |
| 低-5 Ctrl+Shift+C 操作ガイド未記載 | SHORTCUTS テーブルに行が存在しないことはコードで確定 |
| 低-2 handleStop 後 mentionedNodeIds 未クリア | `AIChatPanel.tsx` L134-137 の `handleStop` を確認。`setMentionedNodeIds([])` の呼び出しがなく、指摘は正確。低優先だが CONFIRMED |

### 実機が必要な項目

| 指摘 | 実機が必要な理由 |
|------|---------------|
| 高-4 二重発火の実際の発火頻度 | タッチイベントのタイミングと `handleNodeClick` の実行速度は実機の JS エンジン速度に依存 |
| 中-8 PresentationMode スワイプ未実装 | コードにスワイプ実装がないことは確定。実用摩擦の度合いは実機確認が要る |
| 中-9 iOS Safari での window.prompt フォーカス問題 | プラットフォーム固有挙動 |
| Phase 25/26 全体のレイアウト確認 | CSS の `sm:` ブレークポイント等は画面サイズで変わる実機確認事項 |
| 低-7 BAR_HALF_WIDTH によるバー見切れ | `getBoundingClientRect` が取れるのは実機 DOM のみ |

---

## 最優先で対応すべき UX 改善トップ5

以下はコードで CONFIRMED が確定し、実装コスト（推定「小」）に対して実用摩擦が大きい順に並べた。

### 1. 【高-2】AISuggestionPanel ダークモード完全未対応
- `AISuggestionPanel.tsx` 全体に `dark:` クラスが存在しない。ダークモード設定ユーザーに最も多用されるパネルが白背景で浮く。
- 修正: `bg-white` → `bg-white dark:bg-gray-800`、`border-gray-100` → `border-gray-100 dark:border-gray-700` 等を全要素に追加。

### 2. 【高-3】NodeDetailPanel の Esc・背景クリックがコミット扱い
- `NodeDetailPanel.tsx` L49-51（Esc）および L113（背景クリック）が `commitAndClose()` を呼ぶ。IdeaNode インライン編集の Esc（破棄）と真逆の挙動。
- 修正: Esc と背景クリックで `closeNodeDetail()` のみ呼ぶよう変更（blur による自動保存は維持）。

### 3. 【高-1】NodeActionBar 削除ボタンで確認なし即削除
- `IdeaCanvas.tsx` L89。接続線があってもダイアログが出ない。スマホ誤タップによる意図しないデータ損失リスク。
- 修正: `hasConnectedEdges(selectedNodeId)` チェックを追加し、右クリックメニューと同じパターン（`openConfirmDialog`）を適用。

### 4. 【高-5】チャット履歴クリアが確認なし
- `AIChatPanel.tsx` L267。長い会話が即座に全削除される。スマホ誤タップリスクが高い。
- 修正: `openConfirmDialog` を経由して `clearChatHistory` を呼ぶ（ConfirmDialog パターンは既存実装を流用）。

### 5. 【高-4】接続モード中ロングプレスで二重発火の可能性
- `IdeaNode.tsx` L108。`connectingFromNodeId` が非null のときもタイマーを起動する。
- 修正: `handleTouchStart` の先頭に `if (connectingFromNodeId) return` を追加するだけ（ただし `connectingFromNodeId` を IdeaNode に渡す必要があるため、`useUIStore` から取得する）。

---

## 誤検知・格下げ一覧

| 指摘 | 変更内容 | 理由 |
|------|---------|------|
| 高-7 selectedNodeId 残存 | 高 → 低-8 相当 | 主要削除経路（NodeActionBar・NodeDetailPanel・ショートカット）はすべて `setSelectedNodeId(null)` を呼んでいる。実際の再現経路が限定的 |
| 中-3 グループ削除2択 | 問題の本質を訂正 | 「非対称さ」ではなく「ダイアログ文言（2択をうながす）とUI（1択のみ）の矛盾」。修正は message 文言の変更だけで可 |
