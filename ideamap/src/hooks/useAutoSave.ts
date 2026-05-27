import { useEffect, useRef, useCallback } from 'react'
import { useMapStore } from '../stores/mapStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { saveMap } from '../services/googleDriveService'
import { saveMapLocally, saveDriveFileId, loadDriveFileId } from '../services/storageService'
import type { MapFile } from '../types'

const DEBOUNCE_MS = 3000

export function useAutoSave(accessToken: string | null) {
  const { setSaveStatus } = useUIStore()
  const { autoSave } = useSettingsStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileIdRef = useRef<string | null>(loadDriveFileId())
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const setFileId = useCallback((id: string | null) => {
    fileIdRef.current = id
    saveDriveFileId(id)
  }, [])

  const performSave = useCallback(async () => {
    const { getSerializedNodes, getSerializedEdges } = useMapStore.getState()
    const { mapTitle } = useUIStore.getState()

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
        const newId = await saveMap(accessToken, mapTitle, mapFile, fileIdRef.current)
        if (isMountedRef.current) {
          setFileId(newId)
          setSaveStatus('saved')
        }
      } catch {
        if (isMountedRef.current) {
          setSaveStatus('error')
          useUIStore.getState().addToast('Googleドライブへの保存に失敗しました', 'error')
        }
      }
    } else {
      if (isMountedRef.current) setSaveStatus('saved')
    }
  }, [accessToken, setSaveStatus, setFileId])

  useEffect(() => {
    const unsubscribe = useMapStore.subscribe(() => {
      if (!autoSave) return
      setSaveStatus('unsaved')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setSaveStatus('saving')
        void performSave()
      }, DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [autoSave, performSave, setSaveStatus])

  return { fileIdRef, setFileId, performSave }
}
