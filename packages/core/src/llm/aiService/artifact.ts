// Phase 45: マップ→成果物生成
import type { MapContext } from '../../types'
import type { LLMProvider } from '../types'

export type ArtifactFormat = 'document' | 'slides' | 'tasks'

export interface GenerateArtifactRequest {
  provider: LLMProvider
  mapContext: MapContext
  format: ArtifactFormat
  /** 指定時はこのノード群（選択サブツリー）だけを対象にする。絞り込みは呼び出し側（UI）の責務で、ここでは受け取った mapContext をそのまま使う */
  focusNodeIds?: string[]
}

// フォーマットごとの出力指示。階層構造そのものはコード側で組み立てず、ノード一覧＋接続関係（親→子）から
// LLM に構造を読み取らせる。chatWithMap と同じ「flat な一覧を渡して解釈は任せる」方式に揃えている
const ARTIFACT_FORMAT_INSTRUCTIONS: Record<ArtifactFormat, string> = {
  document: `構造化されたドキュメントとして構成してください。
- 冒頭にマップ全体の要約を1段落で書く
- マップの階層（接続関係の親→子）をそのまま見出しレベル（##, ###）に対応させる
- 各ノードの本文（body）があれば要約せず本文として活かす`,
  slides: `Marp互換のMarkdownスライドとして構成してください。
- 先頭に必ず次の3行を置く:
---
marp: true
---
- スライドの区切りは \`---\` の行のみ
- 1スライドにつき1トピック。見出し1つ＋箇条書き中心で簡潔にまとめる`,
  tasks: `実行計画として構成してください。
- \`- [ ] \` 形式のチェックボックス付きタスクリストにする
- マップの構造（親子関係）と内容から依存関係・優先度を推測し、フェーズ（##見出し）に分けて並べる
- 各タスクは1行で完結する具体的な行動として書く`,
}

export async function generateArtifactFromMap(
  req: GenerateArtifactRequest,
  onText?: (partial: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { provider } = req

  // focusNodeIds 指定時は選択サブツリーだけに絞る（未指定ならマップ全体）
  const focusIds = req.focusNodeIds ? new Set(req.focusNodeIds) : null
  const nodes = focusIds ? req.mapContext.nodes.filter((n) => focusIds.has(n.id)) : req.mapContext.nodes
  const edges = focusIds
    ? req.mapContext.edges.filter((e) => focusIds.has(e.source) && focusIds.has(e.target))
    : req.mapContext.edges

  const nodeList = nodes
    .map((n) => {
      const bodyBlock = n.body ? `\n  本文: ${n.body}` : ''
      return `- [${n.id}] ${n.title}${bodyBlock}`
    })
    .join('\n')

  const edgeList =
    edges
      .map((e) => `- ${e.source} → ${e.target}${e.label ? ` (${e.label})` : ''}`)
      .join('\n') || '（接続なし）'

  const prompt = `あなたはアイデアマップから成果物を作成する専門家です。以下のアイデアマップを元に成果物を作成してください。

【マップ: ${req.mapContext.mapTitle}】
ノード数: ${nodes.length}件

【ノード一覧】
${nodeList}

【接続関係（親→子）】
${edgeList}

${ARTIFACT_FORMAT_INSTRUCTIONS[req.format]}

出力はMarkdown本文のみとしてください。前置きの挨拶や「以下に生成しました」等の説明、後書きは一切含めないでください。`

  const accumulated = await provider.stream(
    { messages: [{ role: 'user', content: prompt }], maxTokens: 4096 },
    (partial) => onText?.(partial),
    signal,
  )

  return accumulated.trim()
}
