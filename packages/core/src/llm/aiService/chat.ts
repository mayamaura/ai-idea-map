import type { ChatAction, ChatWithMapRequest } from '../../types'
import { buildWebContext } from './shared'

export async function chatWithMap(
  req: ChatWithMapRequest,
  onText?: (partialText: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; actions: ChatAction[] }> {
  const { provider } = req

  const prioritizedNodeIds = new Set(req.mentionedNodeIds ?? [])
  const orderedNodes = [
    ...req.mapContext.nodes.filter((n) => prioritizedNodeIds.has(n.id)),
    ...req.mapContext.nodes.filter((n) => !prioritizedNodeIds.has(n.id)),
  ].slice(0, 50)

  const nodeList = orderedNodes
    .map((n) => {
      const bodyPreview = n.body ? `\n  本文: ${n.body.slice(0, 100)}` : ''
      return `- [${n.id}] ${n.title}${bodyPreview}`
    })
    .join('\n')

  const edgeList =
    req.mapContext.edges
      .map((e) => `- ${e.source} → ${e.target}${e.label ? ` (${e.label})` : ''}`)
      .join('\n') || '（接続なし）'

  const mentionedBlock =
    prioritizedNodeIds.size > 0
      ? `\n【@メンションされたノード】\n${[...prioritizedNodeIds]
          .map((id) => {
            const node = req.mapContext.nodes.find((n) => n.id === id)
            return node ? `- [${id}] ${node.title}` : ''
          })
          .filter(Boolean)
          .join('\n')}`
      : ''

  // 検索クエリは直近のユーザー発言。会話の話題がそのまま検索したい内容になる
  const lastUserMessage = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const webContext = await buildWebContext(req, lastUserMessage, signal)

  const systemContext = `あなたは「IdeaMap」のAIアシスタントです。ユーザーのアイデアマップを文脈として理解した上で自由に会話してください。

【現在のマップ: ${req.mapContext.mapTitle}】
ノード数: ${req.mapContext.nodes.length}件

【ノード一覧】
${nodeList}

【接続関係】
${edgeList}${mentionedBlock}${webContext}

マップ操作を提案したい場合のみ、回答の末尾に以下のJSONブロックを含めてください（アクションがなければ省略）:
\`\`\`actions
{"actions": [{"type": "addNode", "label": "ノードタイトル", "sourceNodeId": "parent-id", "categoryId": "cat-main", "reason": "理由"}]}
\`\`\``

  const apiMessages = req.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const accumulated = await provider.stream(
    { system: systemContext, messages: apiMessages, maxTokens: 2048 },
    (partial) => {
      // actions ブロックの途中露出を防ぐため除去してから渡す
      if (onText) onText(partial.replace(/```actions[\s\S]*$/, ''))
    },
    signal,
  )

  // Abort 時はそれまでの累積テキストを返す（エラーとして扱わない）
  if (signal?.aborted) {
    return { content: accumulated.replace(/```actions[\s\S]*$/, '').trim(), actions: [] }
  }

  const actionsMatch = accumulated.match(/```actions\n([\s\S]*?)\n```/)
  let actions: ChatAction[] = []
  if (actionsMatch) {
    try {
      const parsed = JSON.parse(actionsMatch[1]) as { actions: ChatAction[] }
      actions = Array.isArray(parsed.actions) ? parsed.actions : []
    } catch {
      // graceful degradation: パース失敗時はアクションなし
    }
  }

  const content = accumulated.replace(/```actions\n[\s\S]*?\n```/, '').trim()
  return { content, actions }
}
