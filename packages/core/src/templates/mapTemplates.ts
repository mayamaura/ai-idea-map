/**
 * 思考フレームワークのテンプレートマップ（Phase 46）。
 *
 * 各ノードの body に「その欄に何を書くか」の説明を持たせる。AI提案（generateSuggestions）は
 * ノードの body を文脈として読むため、テンプレート専用のプロンプトを用意しなくても
 * フレームワークの観点に沿った提案が出る、という設計。
 */
import type { SerializedEdge, SerializedNode } from '../types'

export interface MapTemplate {
  id: string
  /** テンプレート一覧に表示する名前 */
  name: string
  /** 一覧に表示する1行説明 */
  description: string
  /** 新規マップのタイトル初期値 */
  mapTitle: string
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

const C = {
  center: '#e0e7ff', // indigo-100（既定ルートと同じ）
  green: '#dcfce7',
  red: '#fee2e2',
  blue: '#dbeafe',
  amber: '#fef3c7',
  purple: '#f3e8ff',
} as const

function node(
  id: string,
  title: string,
  x: number,
  y: number,
  color: string,
  body?: string
): SerializedNode {
  return { id, title, body, x, y, color, createdBy: 'user' }
}

function edge(id: string, source: string, target: string): SerializedEdge {
  return { id, source, target, label: '' }
}

/** 中心ノードから各子へエッジを張る */
function spokes(prefix: string, centerId: string, childIds: string[]): SerializedEdge[] {
  return childIds.map((c, i) => edge(`${prefix}-e${i}`, centerId, c))
}

const swot: MapTemplate = {
  id: 'swot',
  name: 'SWOT分析',
  description: '強み・弱み・機会・脅威の4象限で戦略を整理する',
  mapTitle: 'SWOT分析',
  nodes: [
    node('swot-root', '分析対象', 0, 0, C.center, 'ここに分析したい事業・製品・計画の名前を書く'),
    node('swot-s', '強み (Strengths)', -380, -180, C.green, '内部要因のプラス面。競合より優れている点・独自の資源や能力'),
    node('swot-w', '弱み (Weaknesses)', 380, -180, C.red, '内部要因のマイナス面。不足している資源・苦手なこと'),
    node('swot-o', '機会 (Opportunities)', -380, 180, C.blue, '外部要因のプラス面。追い風になる市場・技術・社会の変化'),
    node('swot-t', '脅威 (Threats)', 380, 180, C.amber, '外部要因のマイナス面。競合の動き・規制・環境の変化'),
  ],
  edges: spokes('swot', 'swot-root', ['swot-s', 'swot-w', 'swot-o', 'swot-t']),
}

const kpt: MapTemplate = {
  id: 'kpt',
  name: 'KPT ふりかえり',
  description: 'Keep / Problem / Try でふりかえりを整理する',
  mapTitle: 'KPT ふりかえり',
  nodes: [
    node('kpt-root', 'ふりかえりのテーマ', 0, 0, C.center, 'ここに対象（スプリント名・イベント名など）を書く'),
    node('kpt-k', 'Keep', -380, -160, C.green, 'うまくいったこと・続けたいこと'),
    node('kpt-p', 'Problem', 380, -160, C.red, 'うまくいかなかったこと・困っていること'),
    node('kpt-t', 'Try', 0, 260, C.blue, '次に試すこと。Problem の対策や Keep を伸ばす工夫'),
  ],
  edges: spokes('kpt', 'kpt-root', ['kpt-k', 'kpt-p', 'kpt-t']),
}

const fiveWhys: MapTemplate = {
  id: 'five-whys',
  name: 'なぜなぜ分析（5 Whys）',
  description: '「なぜ」を5回繰り返して問題の根本原因を掘り下げる',
  mapTitle: 'なぜなぜ分析',
  nodes: [
    node('why-problem', '問題', 0, 0, C.red, 'ここに起きている問題・事象を具体的に書く'),
    node('why-1', 'なぜ1', 0, 160, C.amber, '問題が起きたのはなぜか？'),
    node('why-2', 'なぜ2', 0, 320, C.amber, 'なぜ1の答えが起きたのはなぜか？'),
    node('why-3', 'なぜ3', 0, 480, C.amber, 'さらに掘り下げる'),
    node('why-4', 'なぜ4', 0, 640, C.amber, 'さらに掘り下げる'),
    node('why-5', 'なぜ5（根本原因）', 0, 800, C.green, 'ここまで掘れたら対策を考える。人ではなく仕組みに原因を求める'),
  ],
  edges: [
    edge('why-e0', 'why-problem', 'why-1'),
    edge('why-e1', 'why-1', 'why-2'),
    edge('why-e2', 'why-2', 'why-3'),
    edge('why-e3', 'why-3', 'why-4'),
    edge('why-e4', 'why-4', 'why-5'),
  ],
}

const osborn: MapTemplate = {
  id: 'osborn',
  name: 'オズボーンのチェックリスト',
  description: '9つの視点で既存アイデアを強制的に発想転換する',
  mapTitle: 'オズボーンのチェックリスト',
  nodes: [
    node('osb-root', 'アイデアの種', 0, 0, C.center, 'ここに発想を広げたい既存のアイデア・製品を書く'),
    node('osb-1', '転用', 0, -320, C.blue, '他の使い道はないか？そのままで新しい用途は？'),
    node('osb-2', '応用', 206, -245, C.blue, '似たものからアイデアを借りられないか？'),
    node('osb-3', '変更', 315, -56, C.blue, '意味・色・動き・音・形を変えたらどうなる？'),
    node('osb-4', '拡大', 277, 160, C.blue, '大きく・長く・頻度を高く・価値を足したら？'),
    node('osb-5', '縮小', 109, 301, C.blue, '小さく・軽く・省略・分割したら？'),
    node('osb-6', '代用', -109, 301, C.blue, '他の素材・人・場所・方法で代用できないか？'),
    node('osb-7', '再配置', -277, 160, C.blue, '順序・レイアウト・因果を入れ替えたら？'),
    node('osb-8', '逆転', -315, -56, C.blue, '逆にしたら？上下・役割・視点の反転'),
    node('osb-9', '結合', -206, -245, C.blue, '組み合わせたら？目的や単位の合体'),
  ],
  edges: spokes('osb', 'osb-root', [
    'osb-1', 'osb-2', 'osb-3', 'osb-4', 'osb-5', 'osb-6', 'osb-7', 'osb-8', 'osb-9',
  ]),
}

const mandalart: MapTemplate = {
  id: 'mandalart',
  name: 'マンダラート',
  description: '中心テーマから8方向に連想を広げる 3×3 マス発想法',
  mapTitle: 'マンダラート',
  nodes: [
    node('man-root', '中心テーマ', 0, 0, C.center, 'ここに達成したい目標・考えたいテーマを書く'),
    node('man-1', '要素1', -280, -160, C.purple, '中心テーマから連想する要素。埋まったらこのノードを中心に再展開する'),
    node('man-2', '要素2', 0, -160, C.purple, '中心テーマから連想する要素'),
    node('man-3', '要素3', 280, -160, C.purple, '中心テーマから連想する要素'),
    node('man-4', '要素4', -280, 0, C.purple, '中心テーマから連想する要素'),
    node('man-5', '要素5', 280, 0, C.purple, '中心テーマから連想する要素'),
    node('man-6', '要素6', -280, 160, C.purple, '中心テーマから連想する要素'),
    node('man-7', '要素7', 0, 160, C.purple, '中心テーマから連想する要素'),
    node('man-8', '要素8', 280, 160, C.purple, '中心テーマから連想する要素'),
  ],
  edges: spokes('man', 'man-root', [
    'man-1', 'man-2', 'man-3', 'man-4', 'man-5', 'man-6', 'man-7', 'man-8',
  ]),
}

export const MAP_TEMPLATES: readonly MapTemplate[] = [swot, kpt, fiveWhys, osborn, mandalart]

export function getMapTemplate(id: string): MapTemplate | undefined {
  return MAP_TEMPLATES.find((t) => t.id === id)
}
