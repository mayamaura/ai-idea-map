import type { FileAdapter, FileRef } from '@ideamap/platform'
import {
  saveMap,
  loadMap,
  deleteMap,
  fetchMapAppProperties,
} from '../services/googleDriveService'
import { saveMapLocally, loadRecentMaps } from '../services/storageService'
import type { MapFile } from '../types'

/**
 * Web版のファイル入出力。マップの主保存先は Google Drive で、
 * 未サインイン時は localStorage のローカル控えのみになる。
 *
 * アクセストークンは Adapter インタフェースの引数に現れないため、
 * apps/web 側（useGoogleAuth の結果を持つ層）から setDriveAccessToken で流し込む。
 */

let accessToken: string | null = null

export function setDriveAccessToken(token: string | null): void {
  accessToken = token
}

function requireToken(): string {
  if (!accessToken) throw new Error('Googleドライブにサインインしていません')
  return accessToken
}

/** content 内の mapId（Drive の appProperties へ載せる衝突検出キー） */
function readMapId(content: unknown): string | null {
  return (content as { mapId?: string } | null)?.mapId ?? null
}

function toRef(id: string, name: string): FileRef {
  return { id, name, origin: 'cloud', updatedAt: new Date().toISOString() }
}

export const webFileAdapter: FileAdapter = {
  get isRemoteReady() {
    return accessToken !== null
  },

  async listRecent() {
    return loadRecentMaps().map((m) => ({
      ref: { id: m.fileId, name: m.title, origin: 'cloud' as const, updatedAt: m.updatedAt },
      title: m.title,
    }))
  },

  async openFile(ref) {
    if (!ref) throw new Error('Web版ではマップ一覧から選択してください')
    const content = await loadMap(requireToken(), ref.id)
    return { ref, content }
  },

  async saveFile(ref, content) {
    const id = await saveMap(requireToken(), ref.name, content, ref.id, readMapId(content))
    return toRef(id, ref.name)
  },

  async saveFileAs(content, suggestedName) {
    const id = await saveMap(requireToken(), suggestedName, content, null, readMapId(content))
    return toRef(id, suggestedName)
  },

  async deleteFile(ref) {
    await deleteMap(requireToken(), ref.id)
  },

  async getMetadata(ref) {
    const { mapId } = await fetchMapAppProperties(requireToken(), ref.id)
    // Drive は appProperties だけを取る軽量照合のため更新時刻は返さない。
    // 衝突検出は mapId の一致のみで行う（既存実装と同じ）
    return { mapId, updatedAt: '' }
  },

  async saveLocalMirror(content) {
    saveMapLocally(content as MapFile)
  },

  async exportBlob(suggestedName, blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = suggestedName
    link.href = url
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}
