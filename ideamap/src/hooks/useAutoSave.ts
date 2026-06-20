import { useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useMapStore } from '../stores/mapStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { saveMap, fetchMapAppProperties, loadMap } from '../services/googleDriveService'
import { saveMapLocally } from '../services/storageService'
import type { MapFile } from '../types'

const DEBOUNCE_MS = 3000
/** バックグラウンドから戻った際に再チェックを走らせる閾値（ミリ秒） */
const FOCUS_RECHECK_MS = 60_000

export function useAutoSave(
  accessToken: string | null,
  auth: { silentReauth: () => void; signIn: () => void }
) {
  const { setSaveStatus } = useUIStore()
  const { autoSave } = useSettingsStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  // auth は呼び出し元で毎レンダリング新しいオブジェクトが作られるため ref で追跡し、
  // performSave の useCallback 依存配列に含めずにデバウンスタイマーが壊れないようにする
  const authRef = useRef(auth)
  authRef.current = auth
  /** 自動保存を一時停止中（衝突ダイアログ表示中）フラグ */
  const isSuspendedRef = useRef(false)
  /** 今セッションで最初の PATCH 前チェックを済ませたか */
  const hasCheckedThisSessionRef = useRef(false)
  /** window がバックグラウンドになった時刻 */
  const hiddenAtRef = useRef<number | null>(null)
  /** 401 後にサイレント再認証を既に試みたか（二重リトライを防ぐ） */
  const reauthAttemptedRef = useRef(false)
  /** サイレント再認証後に保存を再試行する必要があるか */
  const pendingRetryRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // currentFileId が変わったら（別ファイルをロードした）チェック済みフラグをリセット
  useEffect(() => {
    const unsub = useUIStore.subscribe((state, prev) => {
      if (state.currentFileId !== prev.currentFileId) {
        hasCheckedThisSessionRef.current = false
        isSuspendedRef.current = false
      }
    })
    return () => unsub()
  }, [])

  // タブが長時間バックグラウンドになった後に戻ったら再チェックを促す
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else {
        if (hiddenAtRef.current !== null && Date.now() - hiddenAtRef.current >= FOCUS_RECHECK_MS) {
          hasCheckedThisSessionRef.current = false
        }
        hiddenAtRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const performSave = useCallback(async () => {
    if (isSuspendedRef.current) return

    const { getSerializedNodes, getSerializedEdges } = useMapStore.getState()
    // fileId・mapId・mapTitle はクロージャに固定せず都度読む
    const { mapTitle, currentFileId, currentMapId, setCurrentFileId, setCurrentMapId, openConfirmDialog, setSaveStatus: setSS, presentationNodeIds } = useUIStore.getState()
    const { loadFromSerialized } = useMapStore.getState()

    // POST 新規作成の場合は mapId を確定する
    const effectiveMapId = currentFileId
      ? (currentMapId ?? null)
      : (currentMapId ?? uuidv4())

    const mapFile: MapFile = {
      version: '1.0',
      mapId: effectiveMapId ?? uuidv4(),
      title: mapTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: getSerializedNodes(),
      edges: getSerializedEdges(),
      presentationNodeIds: presentationNodeIds.length > 0 ? presentationNodeIds : undefined,
    }

    saveMapLocally(mapFile)

    if (accessToken) {
      try {
        // PATCH の場合：最初の保存 or バックグラウンド復帰後に衝突チェック
        if (currentFileId && !hasCheckedThisSessionRef.current) {
          const remote = await fetchMapAppProperties(accessToken, currentFileId)
          if (remote.mapId !== null && remote.mapId !== effectiveMapId) {
            // 衝突検出：自動保存を一時停止してダイアログを表示
            isSuspendedRef.current = true
            if (isMountedRef.current) {
              setSS('conflict')
              openConfirmDialog({
                title: `「${mapTitle}」で競合が検出されました`,
                message:
                  'このファイルは別のデバイスまたは別のプロジェクトの内容で更新されています。' +
                  '自分の編集内容を上書き保存すると、Drive 上の別の内容が失われます。',
                confirmLabel: '上書き保存',
                danger: true,
                secondaryAction: {
                  label: '最新版を読み込む',
                  onClick: async () => {
                    // Drive から最新版を再ロード
                    const data = (await loadMap(accessToken, currentFileId)) as MapFile & { mapId?: string }
                    loadFromSerialized(data.nodes, data.edges)
                    useUIStore.getState().setPresentationNodeIds(data.presentationNodeIds ?? [])
                    useUIStore.getState().setMapTitle(data.title || mapTitle)
                    setCurrentMapId(data.mapId ?? null)
                    hasCheckedThisSessionRef.current = true
                    isSuspendedRef.current = false
                    setSS('saved')
                  },
                },
                onConfirm: () => {
                  // 強制上書き：チェック済みにしてすぐ保存を再開
                  hasCheckedThisSessionRef.current = true
                  isSuspendedRef.current = false
                  void performSave()
                },
                onCancel: () => {
                  // 自動保存は停止したまま（saveStatus='conflict'）
                },
              })
            }
            return
          }
          hasCheckedThisSessionRef.current = true
        }

        const newId = await saveMap(accessToken, mapTitle, mapFile, currentFileId, mapFile.mapId)
        if (isMountedRef.current) {
          if (!currentFileId) {
            // POST で採番された id と mapId を確定
            setCurrentFileId(newId)
            setCurrentMapId(mapFile.mapId)
            hasCheckedThisSessionRef.current = true
          }
          setSaveStatus('saved')
          useUIStore.getState().setLastSavedAt(new Date().toISOString())
        }
      } catch (err) {
        if (isMountedRef.current) {
          const isAuthError = err instanceof Error && err.message.includes('401')
          if (isAuthError) {
            if (!reauthAttemptedRef.current) {
              // 初回401: サイレント再認証を試みる。トーストは表示しない
              reauthAttemptedRef.current = true
              pendingRetryRef.current = true
              authRef.current.silentReauth()
              setSaveStatus('error')
            } else {
              // 再認証後も401: ユーザーに手動再接続を促すトーストを表示
              setSaveStatus('error')
              useUIStore.getState().addToast(
                'Googleドライブの認証が切れました',
                'error',
                { label: '再接続', onClick: authRef.current.signIn }
              )
            }
          } else {
            setSaveStatus('error')
            useUIStore.getState().addToast('Googleドライブへの保存に失敗しました', 'error')
          }
        }
      }
    } else {
      if (isMountedRef.current) {
        setSaveStatus('saved')
        useUIStore.getState().setLastSavedAt(new Date().toISOString())
      }
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

  // accessToken が non-null になったとき再認証フラグをリセットし、必要なら保存をリトライ
  useEffect(() => {
    if (accessToken !== null) {
      reauthAttemptedRef.current = false
      if (pendingRetryRef.current) {
        pendingRetryRef.current = false
        scheduleSave()
      }
    }
  }, [accessToken, scheduleSave])

  // ノード・エッジの変更で保存
  useEffect(() => {
    const unsubscribe = useMapStore.subscribe(() => scheduleSave())
    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [scheduleSave])

  // 手動保存（Ctrl+S / ヘッダークリック）。デバウンスをスキップして即保存する。
  // autoSave 設定が off でも手動保存は常に実行する
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe((state, prev) => {
      if (state.saveRequestId !== prev.saveRequestId) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setSaveStatus('saving')
        void performSave()
      }
    })
    return () => unsubscribe()
  }, [performSave, setSaveStatus])

  // mapTitle / presentationNodeIds の変更でも保存する。
  // uiStore は subscribeWithSelector 未使用のため (state, prev) を受け取り、
  // 差分のみ拾ってパネル開閉等の他UI状態変更で無駄保存しない。
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe((state, prev) => {
      if (
        state.mapTitle !== prev.mapTitle ||
        state.presentationNodeIds !== prev.presentationNodeIds
      ) {
        scheduleSave()
      }
    })
    return () => unsubscribe()
  }, [scheduleSave])
}
