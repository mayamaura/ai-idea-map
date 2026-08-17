import type { MapFile, SerializedNode, SerializedEdge } from '../types'

/**
 * 旧バージョンのマップファイルを読み込むための互換処理を集約する。
 * 新たな互換対応が必要になったらストア側ではなくこのファイルに追加すること。
 */

/** 初期バージョンはノード見出しを `text` フィールドに持っていた */
export function readNodeTitle(node: SerializedNode): string {
  return node.title ?? (node as { text?: string }).text ?? ''
}

/**
 * ハンドルIDを持たない古いエッジは左右ハンドルとして扱う。
 * FloatingEdge は描画時にハンドルIDを参照しないため、値は接続方向の記録用。
 */
export function readEdgeHandles(edge: SerializedEdge): { sourceHandle: string; targetHandle: string } {
  return {
    sourceHandle: edge.sourceHandle ?? 'right',
    targetHandle: edge.targetHandle ?? 'left',
  }
}

// ---- スキーマバージョニング（Phase 49） ----

/** `.ideamap` / JSON ファイルの現行フォーマットバージョン。保存時は必ずこれを書く */
export const CURRENT_MAP_FILE_VERSION = '1.0'

/** "1.2" のようなドット区切りのバージョン文字列を比較用の数値配列に変換する */
function parseVersion(version: string): number[] {
  return version.split('.').map((part) => Number(part) || 0)
}

/** a>b なら正、a<b なら負、同値なら0を返す */
function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * バージョンごとの段階的マイグレーションステップ。`from` のバージョンのファイルを
 * 1つ新しいバージョンへ変換する関数をここへ追加していく。現行バージョンは '1.0' のみで
 * それより古い実データは存在しないため、初回実装では空（migrateMapFile が version を
 * 揃えるだけの恒等変換になる）。
 */
const MIGRATION_STEPS: ReadonlyArray<{ from: string; migrate: (file: MapFile) => MapFile }> = []

/**
 * 読み込んだ `MapFile` を現行バージョンへ移行する。外部ファイル起源のデータ
 * （Drive・ローカルファイル・共有URL・JSONインポート）は、ストアに渡す前に必ずこれを経由させる。
 *
 * - `version` が現行と同じ、または欠落（初期のファイルより前の壊れたデータ等）: 現行値に揃えて返す
 * - 現行より古い: 該当するマイグレーションステップを順に適用し、最新バージョンへ書き換える
 * - 現行より新しい（未知の将来バージョン）: 読み込み自体は試みるが `warning` を添えて返す
 */
export function migrateMapFile(file: MapFile): { file: MapFile; warning?: string } {
  const version = file.version ?? CURRENT_MAP_FILE_VERSION

  if (compareVersions(version, CURRENT_MAP_FILE_VERSION) > 0) {
    return {
      file: { ...file, version },
      warning: 'このファイルは新しいバージョンで作成されています。一部のデータが読み込めない可能性があります',
    }
  }

  let migrated: MapFile = { ...file, version }
  for (const step of MIGRATION_STEPS) {
    if (compareVersions(migrated.version, step.from) === 0) {
      migrated = step.migrate(migrated)
    }
  }
  return { file: { ...migrated, version: CURRENT_MAP_FILE_VERSION } }
}
