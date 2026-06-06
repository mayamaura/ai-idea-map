import { useEffect, useRef, useCallback } from 'react'
import { useMapStore } from '../stores/mapStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { saveMap } from '../services/googleDriveService'
import { saveMapLocally } from '../services/storageService'
import type { MapFile } from '../types'

const DEBOUNCE_MS = 3000

export function useAutoSave(accessToken: string | null) {
  const { setSaveStatus } = useUIStore()
  const { autoSave } = useSettingsStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const performSave = useCallback(async () => {
    const { getSerializedNodes, getSerializedEdges } = useMapStore.getState()
    // fileId は uiStore を単一の真実源として都度読む（クロージャに古い値を固定しない）
    const { mapTitle, currentFileId, setCurrentFileId } = useUIStore.getState()

    const mapFile: MapFile = {
      version: '1.0',
      title: mapTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: getSerializedNodes(),
      edges: getSerializedEdges(),
    }

    saveMapLocally(mapFile)

    if (accessToken) {
      try {
        const newId = await saveMap(accessToken, mapTitle, mapFile, currentFileId)
        if (isMountedRef.current) {
          // POST で採番された id を反映し、次回以降は同じファイルへ PATCH する
          setCurrentFileId(newId)
          setSaveStatus('saved')
        }
      } catch (err) {
        if (isMountedRef.current) {
          const isAuthError = err instanceof Error && err.message.includes('401')
          setSaveStatus('error')
          useUIStore.getState().addToast(
            isAuthError
              ? 'Googleドライブの認証が切れました。再度サインインしてください。'
              : 'Googleドライブへの保存に失敗しました',
            'error'
          )
        }
      }
    } else {
      if (isMountedRef.current) setSaveStatus('saved')
    }
  }, [accessToken, setSaveStatus])

  // データ変更・タイトル変更どちらでも同じデバウンスタイマーを共有する
  const scheduleSave = useCallback(() => {
    if (!autoSave) return
    setSaveStatus('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSaveStatus('saving')
      void performSave()
    }, DEBOUNCE_MS)
  }, [autoSave, performSave, setSaveStatus])

  // ノード・エッジの変更で保存
  useEffect(() => {
    const unsubscribe = useMapStore.subscribe(() => scheduleSave())
    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [scheduleSave])

  // マップ名（mapTitle）の変更でも保存する。
  // uiStore は subscribeWithSelector 未使用のため (state, prev) を受け取り、
  // mapTitle 差分のみ拾ってパネル開閉等の他UI状態変更で無駄保存しない。
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe((state, prev) => {
      if (state.mapTitle !== prev.mapTitle) scheduleSave()
    })
    return () => unsubscribe()
  }, [scheduleSave])
}
