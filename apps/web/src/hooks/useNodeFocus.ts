import { createContext, useContext } from 'react'

/**
 * フォーカス表示（選択フォーカス・発表モード・接続モード）の状態。
 *
 * ノードごとに style を差し込んだ配列を React Flow に渡すと、選択が変わるたびに
 * 全ノードが新オブジェクトになり React Flow 側が全ノード変更とみなして再描画する。
 * そのため状態は Context で配り、各ノード／エッジが自分の dim だけを判定する。
 */
export interface FocusState {
  /** 選択中ノードID（エッジの dim 判定に使う） */
  selectedNodeId: string | null
  /** フォーカス表示中にハイライトを維持するノードID。null ならフォーカスなし */
  highlightNodeIds: Set<string> | null
  /** 発表モードで表示中のノードID */
  presentationNodeId: string | null
  /** 発表モード中か（エッジを一律で薄くする） */
  isPresentationMode: boolean
  /** 接続モードの接続元ノードID */
  connectingFromNodeId: string | null
}

export const EMPTY_FOCUS_STATE: FocusState = {
  selectedNodeId: null,
  highlightNodeIds: null,
  presentationNodeId: null,
  isPresentationMode: false,
  connectingFromNodeId: null,
}

const DIM_PRESENTATION = 0.1
const DIM_FOCUS = 0.15
const DIM_EDGE_PRESENTATION = 0.05
const DIM_EDGE_FOCUS = 0.1

export const FocusStateContext = createContext<FocusState>(EMPTY_FOCUS_STATE)

/** 自ノードのフォーカス表示状態。opacity は 1 なら dim なし */
export function useNodeFocus(id: string): { opacity: number; isConnectSource: boolean } {
  const { highlightNodeIds, presentationNodeId, isPresentationMode, connectingFromNodeId } =
    useContext(FocusStateContext)

  if (isPresentationMode) {
    // 発表リストが空のときは dim しない（発表対象が決まっていない状態）
    if (!presentationNodeId) return { opacity: 1, isConnectSource: false }
    return { opacity: id === presentationNodeId ? 1 : DIM_PRESENTATION, isConnectSource: false }
  }
  if (connectingFromNodeId) {
    return { opacity: 1, isConnectSource: id === connectingFromNodeId }
  }
  if (highlightNodeIds && !highlightNodeIds.has(id)) {
    return { opacity: DIM_FOCUS, isConnectSource: false }
  }
  return { opacity: 1, isConnectSource: false }
}

/** 自エッジのフォーカス表示状態。opacity は 1 なら dim なし */
export function useEdgeFocusOpacity(source: string, target: string): number {
  const { selectedNodeId, isPresentationMode } = useContext(FocusStateContext)

  if (isPresentationMode) return DIM_EDGE_PRESENTATION
  if (!selectedNodeId) return 1
  return source === selectedNodeId || target === selectedNodeId ? 1 : DIM_EDGE_FOCUS
}
