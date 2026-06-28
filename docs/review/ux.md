# UX レビュー — IdeaMap プロジェクト

**レビュー日**: 2026-06-28  
**レビュー対象**: Phase 14（AIチャット）、Phase 18（UX小改善）、Phase 25/26（スマホ対応）を中心に全体横断  
**ソース確認**: コードを実際に読んだ事実に基づく。実機テストが必要な箇所は「要実機確認」と明記。

---

## 総評

全体として機能密度が高く、個人向けアイデアマップツールとして十分な品質に達している。Undo/Redo、AI提案キャンセル、衝突検出、オフラインフォールバックなど堅牢な仕組みが揃っている。一方で「確認なし削除」「モバイルでのダークモード未適用箇所」「AISuggestionPanel のダークモード欠落」「接続モード中のロングプレス二重発火リスク」「NodeDetailPanel で Esc がコミット扱いになる混乱」の5点は実用摩擦として重要度が高い。スマホ対応（Phase 25/26）は方針・実装とも良好だが、要実機確認の箇所が多く残っている。アクセシビリティは全体的に後回し状態であり、最低限のキーボードフォーカストラップとaria属性の付与が望ましい。

---

## 重要度別サマリ表

| 重要度 | 件数 | 代表的指摘 |
|--------|------|-----------|
| 高 | 7 | NodeActionBar削除確認なし、AISuggestionPanel ダーク未対応、Esc がコミット扱い、接続モード中ロングプレス二重発火リスク、チャット履歴クリア確認なし、WelcomeModal スマホ接続説明誤り、deletedNodeId 選択解除漏れ |
| 中 | 11 | 子/兄弟トグルの説明不足、提案0件時の追加ボタン残留、グループ削除の2択 confirm 文言、フォーカス管理欠如、aria属性未整備、BottomNav 削除不在、接続モードバナーがPC上でも見える問題（要確認）、PresentationMode スワイプ未対応、エッジラベル入力が window.prompt、発表リスト空のCtrl+P 無反応、カテゴリラベルのダーク未対応 |
| 低 | 7 | チャット空状態で @ヒントが先に見える、mentionNodeIds がクリア後も残る可能性、提案スライダーの range UI のラベル不足、エンプティ状態ガイドのスマホタッチ記述なし、NodeActionBar BAR_HALF_WIDTH ハードコード、ドットインジケーターが多い場合に折り返し未検討、操作ガイドのCtrl+Shift+C 未記載 |

---

## 指摘詳細

---

### 【高-1】NodeActionBar の削除ボタン：確認なし即削除

- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（NodeActionBar内 削除ボタン、L89-97）
- **現状**: `deleteNode(selectedNodeId)` を直接呼び出す。接続線があっても確認ダイアログは表示されない。
- **UX上の問題**: 右クリックメニューの「ノードを削除」は接続線がある場合に `ConfirmDialog` を表示するのに、NodeActionBar の削除ボタンは確認なし。スマホでは NodeActionBar が主要削除手段になるため、誤タップによるデータ損失リスクが高い。Undo は可能だがユーザーは気づかないことが多い。
- **推奨対応**: `hasConnectedEdges(selectedNodeId)` をチェックして接続あり時のみ ConfirmDialog を挟む（右クリックメニューと同じパターン）。または削除ボタンの押下に 500ms の long-press を要求するか、Undo のヒントトーストを表示する。
- **推定工数**: 小

---

### 【高-2】AISuggestionPanel がダークモード未対応

- **対象ファイル**: `ideamap/src/components/panels/AISuggestionPanel.tsx`
- **現状**: パネル全体が `bg-white`、テキストが `text-gray-800`、ボーダーが `border-gray-100` のままで `dark:` クラスが一切ない。
- **UX上の問題**: ダークテーマ設定時にこのパネルだけが白背景で浮き上がり、視覚的な一貫性が崩れる。Phase 24 でダークモード網羅と記録されているが AISuggestionPanel は対象外だったと推測される。
- **推奨対応**: AIChatPanel・NodeDetailPanel と同じパターン（`dark:bg-gray-800`、`dark:border-gray-700`、`dark:text-gray-100` 等）を適用する。
- **推定工数**: 小

---

### 【高-3】NodeDetailPanel：Esc がコミット（保存）扱いになる混乱

- **対象ファイル**: `ideamap/src/components/panels/NodeDetailPanel.tsx`（L48-55）
- **現状**: `Esc` キーで `commitAndClose()` が呼ばれ、編集中の内容を保存して閉じる。IdeaNode のインライン編集では逆に `Esc` が「変更破棄して編集終了」（L99-102）。
- **UX上の問題**: Esc の挙動が場所によって「保存して閉じる」と「破棄して閉じる」に乖離しており、ユーザーが混乱しやすい。詳細パネルを開いて内容を書き変えたが気が変わった場合に Esc で閉じると意図せず上書き保存される。
- **推奨対応**: NodeDetailPanel の Esc は「内容を破棄して閉じる」または「コミットせず閉じる（blur 経由で保存）」に統一する。あるいは Esc で閉じる前に変更差分がある場合「変更を保存しますか？」を軽量に確認する（モーダル不要、トーストアクションで可）。
- **推定工数**: 小

---

### 【高-4】接続モード中のノードロングプレスが二重発火する可能性

- **対象ファイル**: `ideamap/src/components/canvas/IdeaNode.tsx`（L108-120）、`ideamap/src/components/canvas/IdeaCanvas.tsx`（L144-160）
- **現状**: 接続モード中（`connectingFromNodeId` が非null）に別ノードをタッチすると、`handleNodeClick` で接続確定が走る（L146-154）。同時に IdeaNode の `handleTouchStart` の 500ms タイマーも走り始める。`touchstart` → 500ms後 → コンテキストメニュー開く、という流れが接続確定後も並走しうる。
- **UX上の問題**: ユーザーが接続先を長押し気味にタップした場合に接続が確定した後でコンテキストメニューが開いてしまうリスクがある。要実機確認。
- **推奨対応**: `handleTouchStart` の冒頭で `connectingFromNodeId` が非null の場合はタイマーをセットしないガード処理を追加する（例: `if (connectingFromNodeId) return`）。
- **推定工数**: 小

---

### 【高-5】AIチャット履歴クリアが確認なし

- **対象ファイル**: `ideamap/src/components/panels/AIChatPanel.tsx`（L265-272）
- **現状**: 「クリア」ボタンが `clearChatHistory()` を即実行。復元不可。
- **UX上の問題**: 長い会話の途中で誤タップした場合に全履歴が失われる。スマホのタップ領域（小さいボタン）での誤操作リスクが高い。
- **推奨対応**: `openConfirmDialog({ title: '会話履歴をクリア', message: 'すべての会話履歴を削除します。この操作は取り消せません。', confirmLabel: 'クリア', danger: true, onConfirm: clearChatHistory })` に変更する。または最後の N 件メッセージがある場合のみ確認を出す。
- **推定工数**: 小

---

### 【高-6】WelcomeModal の接続説明がスマホユーザーに誤誘導

- **対象ファイル**: `ideamap/src/components/common/WelcomeModal.tsx`（L11-17 STEPS[1]）
- **現状**: 「ノードにカーソルを合わせるとハンドルが現れます。ドラッグして別のノードへ接続しましょう。」とのみ記述。
- **UX上の問題**: スマホにはホバー（カーソル）がなく、ハンドルドラッグでの接続も実質不可（Phase 26 で接続モード方式を追加した背景）。スマホで初回起動したユーザーがこのガイドを読んでも接続できない。
- **推奨対応**: 2ステップ目に「（スマホでは：ノードを選択→🔗接続ボタン→相手ノードをタップ）」を追記するか、`navigator.maxTouchPoints > 0` でモバイル判定して文言を切り替える。
- **推定工数**: 小

---

### 【高-7】削除後に selectedNodeId が残りパネルがゴースト状態になる可能性

- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（NodeActionBar L89-96）
- **現状**: NodeActionBar の削除ボタン内で `setSelectedNodeId(null)` を明示的に呼んでいる。しかしショートカットキー（Delete/Backspace）の `map.deleteSelected()` は ui.selectedNodeId のノードが `selected` フラグを持つ場合のみ選択解除している（L126-129 `useKeyboardShortcuts`）。
- **UX上の問題**: `selectedNodeId` と `node.selected` フラグの二重管理。ノードが `selected=false` のまま `selectedNodeId` が設定されている状態でDeleteキーを押すと、選択解除ロジック（L126-129）が走らず `selectedNodeId` が残る。NodePanel・NodeActionBar がゴーストノードを参照し続ける。
- **推奨対応**: `map.deleteSelected()` の後は常に `ui.setSelectedNodeId(null)` を呼ぶように統一する。
- **推定工数**: 小

---

### 【中-1】「子ノード / 兄弟ノード」トグルの意味が直感的でない

- **対象ファイル**: `ideamap/src/components/panels/AISuggestionPanel.tsx`（L311-337）
- **現状**: 「追加先」ラベルと「子ノード」「兄弟ノード」ボタンが並んでいるが、図示や説明が一切ない。
- **UX上の問題**: 「子ノードと兄弟ノードの違い」はマインドマップ用語に慣れていないユーザーには分かりにくい。「兄弟ノード」が disabled になる理由（親なし）も `title` 属性のみでスマホでは確認できない。
- **推奨対応**: ボタンに簡単な図示アイコン（ツリー分岐のミニ絵）を添えるか、選択中のモードを「このノードの子に追加」「このノードの親の下に追加」という口語表現に変える。disabled 時はインラインで小さいテキストヒントを表示する。
- **推定工数**: 小

---

### 【中-2】AI提案0件でも「選択した0個を追加」ボタンが現れ得る

- **対象ファイル**: `ideamap/src/components/panels/AISuggestionPanel.tsx`（L489-498）
- **現状**: `aiSuggestions.length > 0 && !isAILoading` のときのみ追加ボタンを表示しているが、提案が全て既存タイトルと重複してフィルタ（L119-124）された結果 `aiSuggestions.length === 0` になった場合、ユーザーには「ボタンを押してAIにアイデアを提案してもらいましょう」という初期状態メッセージが出て提案が除外された事実が分からない。
- **UX上の問題**: 提案が生成されたが全件重複フィルタで除外された場合にユーザーが何も起きなかったと思い混乱する。
- **推奨対応**: フィルタで除外した件数を保持して「X件の提案がありましたが、すでにマップに存在するため除外しました」と表示する。
- **推定工数**: 小

---

### 【中-3】グループ削除の ConfirmDialog の文言が選択操作と食い違う

- **対象ファイル**: `ideamap/src/components/canvas/ContextMenu.tsx`（L184-193）
- **現状**: グループ右クリック→「グループと子ノードを削除」をクリックすると `openConfirmDialog({ confirmLabel: 'グループと子を削除', ... })` が開く。しかし `ungroupNodes`（グループ枠のみ解除）はダイアログを経由せず右クリックメニューの「グループを解除（子ノードは残す）」で直接実行される。
- **UX上の問題**: 「グループと子を削除」のみ確認を求め「グループを解除」は確認なし、という非対称さ。「解除」は元に戻せる操作のため許容範囲だが、文言上の意図差が分かりにくい。
- **推奨対応**: 現状のロジックのまま、ConfirmDialog の message に「グループを解除（子ノードは残す）には右クリックメニューを使ってください」と補足するか、2択をダイアログの2ボタン（`secondaryAction`）で提供して一元化する。
- **推定工数**: 小

---

### 【中-4】モーダル・パネルのフォーカストラップが未実装

- **対象ファイル**: `ideamap/src/components/common/ConfirmDialog.tsx`、`AIChatPanel.tsx`、`NodeDetailPanel.tsx` など
- **現状**: `useEffect` で Esc / Enter のキーイベントは処理しているが、モーダル内での Tab キーによるフォーカス循環（フォーカストラップ）は実装されていない。
- **UX上の問題**: モーダルを開いた状態で Tab を連打するとモーダル背面のキャンバス要素にフォーカスが移る。スクリーンリーダーユーザーや、キーボードのみ操作ユーザーにとって混乱の原因になる。
- **推奨対応**: `focus-trap-react` ライブラリを導入するか、手動で `firstFocusable.focus()` / 末尾 Tab で先頭に戻す処理を各モーダルに追加する。最低限 ConfirmDialog と NodeDetailPanel から対応する。
- **推定工数**: 中

---

### 【中-5】aria 属性・role が全体的に未整備

- **対象ファイル**: 全 UI コンポーネント（横断的）
- **現状**: `ContextMenu.tsx` の各 `button` に `role="menuitem"` がない。`AIChatPanel.tsx` のメッセージリストに `role="log"` や `aria-live="polite"` がない。`ConfirmDialog.tsx` に `role="dialog"` / `aria-modal="true"` / `aria-labelledby` がない。チェックボックス（`AISuggestionPanel`）は `onChange={() => {}}` の空ハンドラでスクリーンリーダーに何も伝わらない。
- **UX上の問題**: スクリーンリーダーでの操作が実質不可能な状態。個人利用ツールとしては現実的な優先度は低いが、最低限の対応でユーザビリティが大幅に向上する。
- **推奨対応**: ConfirmDialog に `role="dialog" aria-modal="true" aria-labelledby="dialog-title"` を追加。AIチャットのメッセージリストに `aria-live="polite"` を追加。コンテキストメニューに `role="menu"` と各 button に `role="menuitem"` を追加。
- **推定工数**: 中

---

### 【中-6】BottomNav（スマホ）に削除手段がない

- **対象ファイル**: `ideamap/src/components/toolbar/BottomNav.tsx`
- **現状**: BottomNav の9ボタン（追加・元に戻す・やり直し・検索・拡大・全体・縮小・設定・ヘルプ）に削除は含まれていない。スマホでのノード削除はロングプレス→コンテキストメニュー「ノードを削除」か、NodeActionBar の削除ボタンから行う。
- **UX上の問題**: NodeActionBar は接続モード中に非表示（L34 `if (!selectedNodeId || connectingFromNodeId) return null`）になるため、接続モード中はキャンセルするまで削除できない。ロングプレスでコンテキストメニューから削除する手順が必要なことは操作ガイドに記載があるが、発見可能性が低い。
- **推奨対応**: NodeActionBar に削除ボタンが常時存在するため許容範囲だが、操作ガイドに「ノードを選択してNodeActionBarのゴミ箱から削除」と具体的に記載する。もしくは BottomNav の 10 番目ボタンとして「削除」を選択時のみ有効な形で追加する。
- **推定工数**: 小

---

### 【中-7】接続モードバナーが PC でも全幅表示される

- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（L317-331）
- **現状**: `connectingFromNodeId` が非null のとき `createPortal` で固定バナーを表示するが、PC/スマホ問わず全幅で表示される（`left: 0, right: 0`）。
- **UX上の問題**: PC ではハンドルドラッグで接続するため接続モードを使うケースは限定的だが、もし誰かが PC で「接続」ボタンをクリックした場合に全幅バナーが表示されヘッダーとの重複や見た目の混乱が生じる可能性がある。要実機確認。
- **推奨対応**: バナーを `sm:hidden` にするか、`sm:` 以上では `top-14 left-auto right-auto w-auto` のポップアップ形式にする。
- **推定工数**: 小

---

### 【中-8】PresentationMode にスワイプ操作がない（スマホ）

- **対象ファイル**: `ideamap/src/components/screens/PresentationMode.tsx`
- **現状**: 前へ/次へのタッチ操作は下部ナビバーのボタンのみ。スワイプ未実装（Phase 26 タスクに「スワイプ送りは任意」と記載あり）。
- **UX上の問題**: スマホでプレゼンを操作する場合、タップ領域の小さいボタンよりもスワイプの方が自然。特に横スワイプは「次へ / 前へ」の直感的なジェスチャとして定着している。
- **推奨対応**: スライドパネルに `onTouchStart/onTouchEnd` を追加し、dx の差分が 50px 以上なら `goToNextPresentation` / `goToPrevPresentation` を呼ぶ。実装コストが低い。
- **推定工数**: 小

---

### 【中-9】エッジラベル編集が `window.prompt` 依存

- **対象ファイル**: `ideamap/src/components/canvas/ContextMenu.tsx`（L167-173）、`GroupNode.tsx`（推測）
- **現状**: エッジ右クリック「ラベルを編集」で `window.prompt(...)` を使用。グループラベル編集も同様（L377）。
- **UX上の問題**: `window.prompt` はブラウザのネイティブダイアログでデザインを制御できず、モバイルでの挙動が端末依存。ダークモード対応もできない。iOS Safari では prompt がキャンバスのフォーカスを奪い、その後の操作に影響することがある（要実機確認）。
- **推奨対応**: インライン編集（IdeaNode と同パターン）またはトースト上部の小型 input でラベルを編集できる UI に変更する。
- **推定工数**: 中

---

### 【中-10】発表リストが空のときの Ctrl+P 無反応

- **対象ファイル**: `ideamap/src/hooks/useKeyboardShortcuts.ts`（L71-75）
- **現状**: `if (ui.presentationNodeIds.length > 0) ui.startPresentation()` — リストが空のとき `return` するだけでフィードバックなし。
- **UX上の問題**: ユーザーが Ctrl+P を押しても何も起きず、操作が届いたかどうかも分からない。
- **推奨対応**: `else { ui.addToast('発表ノードを右クリックメニューで追加してから開始してください', 'info') }` でヒントを表示する。
- **推定工数**: 小

---

### 【中-11】カテゴリラベル（NodeToolbar）がダークモード未対応

- **対象ファイル**: `ideamap/src/components/canvas/IdeaNode.tsx`（L149-154）
- **現状**: カテゴリラベルのバッジが `bg-white/95 text-gray-600 border-gray-200` 固定でダーク対応なし。
- **UX上の問題**: ダークテーマ時に白いバッジがキャンバス上に浮いて見た目が乱れる。
- **推奨対応**: `dark:bg-gray-800/95 dark:text-gray-300 dark:border-gray-600` を追加する。
- **推定工数**: 小

---

### 【低-1】チャット空状態の @ヒントが使い方案内より先に目立つ

- **対象ファイル**: `ideamap/src/components/panels/AIChatPanel.tsx`（L333-351）
- **現状**: 空メッセージ時に「マップについて何でも聞いてください」の次の行に「@ノード名 で特定ノードを参照できます」と表示。
- **UX上の問題**: 初回ユーザーに @ メンションの存在は有用だが、「まず何を聞けばいい？」という最初の疑問への答えがない。クイック質問チップ（ノード選択時のみ表示）があることも空状態では見えない。
- **推奨対応**: 空状態にクイック質問チップのサンプル例示か「ノードを選択するとクイック質問が使えます」のヒントを追加する。
- **推定工数**: 小

---

### 【低-2】@メンション挿入後 mentionedNodeIds が次回送信でリセットされない問題

- **対象ファイル**: `ideamap/src/components/panels/AIChatPanel.tsx`（L152-153）
- **現状**: `const currentMentionedIds = [...mentionedNodeIds]` で現在値をコピーし `setMentionedNodeIds([])` でリセットしているが、送信後に input を変更せず Enter を連打した場合のみ問題ないが、`handleStop` 後（L134-137）で abort した場合 `setMentionedNodeIds([])` が呼ばれない。
- **UX上の問題**: 停止後に次のメッセージを送ると前回のメンションIDが重複して付与される可能性がある。要コードの再確認が必要。
- **推奨対応**: `handleStop` 内でも `setMentionedNodeIds([])` を呼ぶか、送信開始前に必ずリセットする。
- **推定工数**: 小

---

### 【低-3】AI提案数スライダーに現在値の視覚的フィードバックが薄い

- **対象ファイル**: `ideamap/src/components/panels/AISuggestionPanel.tsx`（L340-354）
- **現状**: range input と数値ラベル（`w-5 text-right`）は表示されているが、3〜10 の範囲であることはスライダーの端から推測するしかない。
- **UX上の問題**: スライダーが何を意味するか（提案件数）は「提案数」ラベルで分かるが、「今何件に設定されているか」が数値の横に最小・最大ラベルがないため直感的でない。
- **推奨対応**: スライダーの左右に「3」「10」を表示するか、`3〜10件` のような range 表示を追加する。
- **推定工数**: 小

---

### 【低-4】エンプティ状態ガイドにスマホタッチ操作の案内がない

- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（L387-394）
- **現状**: 「ダブルクリックしてアイデアを追加」と表示。
- **UX上の問題**: スマホではダブルクリックができない（`onDoubleClick` はタッチでは `dblclick` イベントが発火しないか、端末依存）。スマホユーザーはこのガイド通りに操作しても何も起きない。要実機確認。
- **推奨対応**: `navigator.maxTouchPoints > 0` でスマホ判定し、「長押しまたはBottomNavの「+」でアイデアを追加」に差し替える。または「ダブルクリック（スマホでは左下「+」ボタン）」のように補足を追加する。
- **推定工数**: 小

---

### 【低-5】操作ガイドに Ctrl+Shift+C（AIチャット）が記載されていない

- **対象ファイル**: `ideamap/src/components/common/KeyboardShortcutsModal.tsx`
- **現状**: `Ctrl+S`、`Ctrl+Z`、`Ctrl+P` 等は記載があるが `Ctrl+Shift+C`（AIチャットパネルトグル）が記載されていない。`useKeyboardShortcuts.ts` L63 で実装済みだが見つけられない。
- **UX上の問題**: 実装されているショートカットが一覧に載っていないため、ヘビーユーザーが効率的に使えない。
- **推奨対応**: SHORTCUTS の「表示・検索」セクションに `{ keys: ['Ctrl', 'Shift', 'C'], description: 'AIチャットパネルをトグル' }` を追加する。
- **推定工数**: 小

---

### 【低-6】ドットインジケーターが発表ノード多数時に折り返す

- **対象ファイル**: `ideamap/src/components/screens/PresentationMode.tsx`（L90-100）
- **現状**: `presentationNodeIds.map` で全ノード分のドットを表示。スタイルは `flex items-center justify-center gap-1.5 px-8 py-4` で折り返し未制御。
- **UX上の問題**: 発表ノードが 20 件を超えると折り返してレイアウトが崩れる可能性がある。
- **推奨対応**: ドット数が 10 を超える場合はドットを非表示にして「N / 全M件」のテキスト表示に切り替える。または `overflow-hidden max-w-full` + 省略。
- **推定工数**: 小

---

### 【低-7】NodeActionBar の BAR_HALF_WIDTH がハードコード

- **対象ファイル**: `ideamap/src/components/canvas/IdeaCanvas.tsx`（NodeActionBar L53）
- **現状**: `const BAR_HALF_WIDTH = 120` で固定。実際のバー幅はボタン数・フォントサイズ・画面スケールによって異なる。
- **UX上の問題**: ボタンが増減した場合や大フォントサイズ設定のブラウザでは、クランプ計算がずれてバーが見切れる可能性がある（要実機確認）。
- **推奨対応**: `useRef` でバーの実 DOM を参照し `getBoundingClientRect().width / 2` を動的に取得するか、`offsetWidth` を使う。
- **推定工数**: 小

---

## Phase 14（AIチャット）動作確認チェックリスト

| # | 確認項目 | 期待値 | 備考 |
|---|----------|--------|------|
| 1 | APIキー未設定で AIChatPanel を開く | 🔑絵文字と「設定を開く」ボタンが表示、入力欄は非表示 | コード確認済み |
| 2 | 通常メッセージを送信する | ローディングドット → 逐次テキスト表示 → 完了 | ストリーミング実装確認済み |
| 3 | 生成中に■停止ボタンを押す | 途中まで表示されたテキストが残り、再送信可能 | AbortController 実装確認済み |
| 4 | @ノード名 を入力するとオートコンプリートが出る | ↑↓/Enter/Tab/Esc で操作できる | コード確認済み |
| 5 | @メンション後のクイック質問チップが消える | 要実機確認 | selectedNode 依存 |
| 6 | AI が `addNode` アクションを含む応答をする | アクションボタンが表示され、クリックでノード追加・トースト表示 | コード確認済み |
| 7 | 同一アクションを2回クリックする | 2つノードが作成される（ガードなし）| 要実機確認・重複防止なし |
| 8 | チャット履歴が40件を超える | 末尾40件が保持され先頭が削除される | `slice(-40)` 確認済み |
| 9 | 「クリア」ボタンを押す | 即座に全履歴クリア（確認ダイアログなし）| 【高-5】参照 |
| 10 | Ctrl+Shift+C でパネルトグル | 開閉できる | ショートカット実装確認済み |
| 11 | パネル外クリック（PC）で閉じないこと | キャンバス操作が継続できる | sm:hidden マスクで対応 |
| 12 | パネル外タップ（スマホ）で閉じる | bg-black/30 マスクのクリックで閉じる | 要実機確認 |
| 13 | ネットワーク切断時にメッセージ送信する | 「ネットワークエラーです。接続を確認してください」トースト | toFriendlyAIError 確認済み |
| 14 | 429（レート制限）エラーが出る | 「レート制限に達しました。1分ほど待ってから再試行してください」 | toFriendlyAIError 確認済み |
| 15 | マップが 50 件超えてチャットを開始する | 最初の 50 件が context に入る（`nodes.slice(0, 50)` — 要claudeService確認） | 要コード確認 |

---

## Phase 18（UX小改善）動作確認チェックリスト

| # | 確認項目 | 期待値 | 備考 |
|---|----------|--------|------|
| 1 | AI提案でタイトルが 20 文字以内に短縮されている | 長いタイトルがノードに入らない | プロンプト指示確認済み |
| 2 | AI提案カードに `body` プレビューが表示される | 2行 line-clamp で表示 | コード確認済み |
| 3 | ノード上に 📝 バッジが表示され、クリックで詳細パネルが開く | NodeDetailPanel が開く | コード確認済み |
| 4 | NodeDetailPanel で Markdown プレビューが有効 | `isPreview=true` のデフォルト確認 | コード確認済み（要実機確認） |
| 5 | プレゼン画面でノードの body が Markdown 整形表示される | renderMarkdownSimple の出力 | コード確認済み |
| 6 | ツールバー「発表」ボタンで PresentationOrderPanel が開く | setPresentationOrderOpen(true) | コード確認済み |
| 7 | PresentationOrderPanel でノードの順序を ↑↓ で変更できる | reorderPresentationNodes 動作 | 要実機確認 |
| 8 | PresentationOrderPanel から発表開始できる | startPresentation() が呼ばれる | 要実機確認 |
| 9 | ChatAction.body を持つアクションでノードが作成される | addNode にbodyが渡される | コード確認済み |

---

## Phase 25（スマホ表示）動作確認チェックリスト

| # | 確認項目 | 期待値 | 備考 |
|---|----------|--------|------|
| 1 | iPhone SE（375px）で AIChatPanel が全幅表示になる | `w-full` + 下端からスライドイン | 要実機確認 |
| 2 | iPhone SE でスマホマスクが表示され外タップで閉じる | sm:hidden マスクが機能 | 要実機確認 |
| 3 | PresentationMode がスマホで下部シートになる | `max-h-[55vh]` で下端に表示 | 要実機確認 |
| 4 | コンテキストメニューがスマホで下部シートになる | `fixed bottom-0 w-full rounded-t-2xl` | 要実機確認 |
| 5 | メニュー項目のタップ領域が `py-3` で十分に広い | 通常の倍の高さ | 要実機確認 |
| 6 | BottomNav の追加ボタンがキャンバス中央に非重複でノードを作成する | findFreePosition 動作 | 要実機確認 |
| 7 | BottomNav の全9ボタンが 375px で横スクロールで到達できる | overflow-x-auto で全ボタンにアクセス | 要実機確認 |
| 8 | iOS セーフエリア対応（ホームインジケーター被り）がない | pb-[env(safe-area-inset-bottom)] | 要実機確認 |
| 9 | Toast がスマホで BottomNav の上（bottom-20）に表示される | bottom-20 sm:bottom-6 | 要実機確認 |
| 10 | NodeActionBar が画面端でクランプされる | BAR_HALF_WIDTH でクランプ | 要実機確認 |
| 11 | ダブルクリックでのキャンバスノード作成がスマホで機能するか | dblclick イベントの端末依存 | 要実機確認（【低-4】参照） |

---

## Phase 26（スマホタッチ）動作確認チェックリスト

| # | 確認項目 | 期待値 | 備考 |
|---|----------|--------|------|
| 1 | ノードをロングプレス（500ms）でコンテキストメニューが開く | 振動フィードバック＋下部シートメニュー | 要実機確認 |
| 2 | キャンバス空白をロングプレスで pane メニューが開く | アイデアを作成・貼り付けメニュー | 要実機確認 |
| 3 | ロングプレス中にドラッグするとタイマーがキャンセルされる | onTouchMove でクリア | 要実機確認 |
| 4 | NodeActionBar「接続」ボタンでインジゴバナーが表示される | 全幅バナー + キャンセルボタン | 要実機確認（【中-7】参照） |
| 5 | 接続モード中に別ノードをタップしてエッジが作成される | 「接続しました」トースト | 要実機確認 |
| 6 | 接続モード中に同ノードをタップでキャンセルされる | connectingFromNodeId が null に | 要実機確認 |
| 7 | 接続モード中に空白タップでキャンセルされる | handlePaneClick でクリア | 要実機確認 |
| 8 | 接続モード中の接続元ノードにアウトラインが表示される | `outline: '2px solid #6366f1'` | 要実機確認 |
| 9 | 接続モード中ロングプレスでメニューが誤発火しないか | 【高-4】のリスク | 要実機確認（最優先） |
| 10 | ピンチ操作でズームできる | React Flow 標準 | 要実機確認 |
| 11 | 一本指ドラッグでキャンバスがパンできる | React Flow 標準 | 要実機確認 |
| 12 | ノードをドラッグで移動できる（パンと競合しないか） | 1本指ドラッグはパン優先なのでノード移動には 2 段階操作が必要か | 要実機確認 |

---

## まとめ：高の指摘上位3件

1. **【高-2】AISuggestionPanel ダークモード未対応**: ダークテーマを設定した状態で最も多用するパネルが白い。実装コストが最も低く（small）、視覚的インパクトが最も大きい。
2. **【高-1】NodeActionBar の削除確認なし**: スマホではノード削除の主要経路（NodeActionBar）でダイアログが出ず、誤タップによる意図しない削除リスクが高い。右クリックメニューとの一貫性も損なっている。
3. **【高-3】Esc が NodeDetailPanel でコミット扱い**: インライン編集とモーダル間で Esc の意味（破棄 vs 保存）が逆転しており、慣れたユーザーほど意図せぬ上書きをしやすい。
