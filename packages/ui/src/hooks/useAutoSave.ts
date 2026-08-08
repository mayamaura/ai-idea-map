import { useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getPlatform, type FileRef } from '@ideamap/platform'
import { useMapStore, useUIStore, useSettingsStore, buildMapFile, type MapFile } from '@ideamap/core'

const DEBOUNCE_MS = 3000
/** バックグラウンドから戻った際に再チェックを走らせる閾値（ミリ秒） */
const FOCUS_RECHECK_MS = 60_000

export interface AutoSaveOptions {
  /**
   * 永続保存先（クラウド／ローカルファイル）が今すぐ使えるか。
   * false のときはローカル控えのみ書いて「保存済み」にする。
   */
  remoteReady: boolean
  /**
   * remoteReady を左右する資格情報の識別子（Web版は Google のアクセストークン）。
   * 値が変わると連続失敗カウンタをリセットし、保留していた保存を再実行する。
   */
  credentialKey?: string | null
  /**
   * 保存失敗時の扱い。'retry' を返すと credentialKey が変わったタイミングで再保存する。
   * 省略時は汎用トーストを出すだけ。attempt は credentialKey 更新後の連続失敗回数（1 始まり）。
   */
  onSaveError?: (err: unknown, attempt: number) => 'retry' | 'handled'
  /**
   * 保存先が未確定のとき、デバウンス保存で新規ファイルを作ってよいか。
   * Web版（Drive へ黙って新規作成する）は true、
   * デスクトップ版は false —「名前を付けて保存」ダイアログが3秒ごとに出てしまうため、
   * ユーザーが明示的に保存するまではローカル控え（autosave 領域）だけに書く。
   */
  createNewFileOnSave?: boolean
}

/**
 * マップの自動保存。デバウンス・衝突検出・保存状態表示のオーケストレーションを担う。
 * 保存先の実体は FileAdapter に委ねているため、Web版（Google Drive）でも
 * デスクトップ版（ローカルファイル）でも同じフックが使える。
 */
export function useAutoSave(options: AutoSaveOptions) {
  const { remoteReady, credentialKey = null, onSaveError, createNewFileOnSave = true } = options
  const { setSaveStatus } = useUIStore()
  const { autoSave } = useSettingsStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  // onSaveError は呼び出し元で毎レンダリング新しい関数が作られるため ref で追跡し、
  // performSave の useCallback 依存配列に含めずにデバウンスタイマーが壊れないようにする
  const onSaveErrorRef = useRef(onSaveError)
  onSaveErrorRef.current = onSaveError
  /** 自動保存を一時停止中（衝突ダイアログ表示中）フラグ */
  const isSuspendedRef = useRef(false)
  /** 今セッションで最初の上書き保存前チェックを済ませたか */
  const hasCheckedThisSessionRef = useRef(false)
  /** window がバックグラウンドになった時刻 */
  const hiddenAtRef = useRef<number | null>(null)
  /** credentialKey 更新後の連続保存失敗回数 */
  const failureCountRef = useRef(0)
  /** 資格情報の更新後に保存を再試行する必要があるか */
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

  /** @param isExplicit 手動保存（Ctrl+S・ヘッダークリック）か。true なら保存先の確定ダイアログを出してよい */
  const performSave = useCallback(async (isExplicit = false) => {
    if (isSuspendedRef.current) return
    // マップ未読込（起動直後・ダッシュボード表示中）は保存しない。
    // リロードで mapStore は初期マップにリセットされる一方 currentFileId は永続化領域から
    // 前回ファイルのまま復元されるため、ガードしないと初期マップで実ファイルを上書きしてしまう。
    if (!useUIStore.getState().hasActiveMap) return

    const file = getPlatform().file
    // fileId・mapId・mapTitle はクロージャに固定せず都度読む
    const { mapTitle, currentFileId, currentFileOrigin, currentMapId, setCurrentFileId, setCurrentMapId, openConfirmDialog, setSaveStatus: setSS } = useUIStore.getState()
    const { loadFromSerialized } = useMapStore.getState()

    // 新規保存の場合は mapId を確定する
    const effectiveMapId = currentFileId
      ? (currentMapId ?? null)
      : (currentMapId ?? uuidv4())

    const mapFile: MapFile = buildMapFile(effectiveMapId ?? uuidv4())

    await file.saveLocalMirror(mapFile)

    // 保存先の種別は開いたときに記録した値を優先する。デスクトップ版は Drive のマップと
    // ローカルファイルの両方を扱うため、Adapter の既定 origin だけでは判別できない
    const ref: FileRef | null = currentFileId
      ? { id: currentFileId, name: mapTitle, origin: currentFileOrigin ?? file.origin, updatedAt: '' }
      : null
    // 保存先未確定 + 新規作成が許されていないデバウンス保存は、ローカル控えだけで完了とする
    const canPersist = remoteReady && (ref !== null || isExplicit || createNewFileOnSave)

    if (canPersist) {
      try {
        // 上書き保存の場合：最初の保存 or バックグラウンド復帰後に衝突チェック
        if (ref && !hasCheckedThisSessionRef.current) {
          const remote = await file.getMetadata(ref)
          if (remote && remote.mapId !== null && remote.mapId !== effectiveMapId) {
            // 衝突検出：自動保存を一時停止してダイアログを表示
            isSuspendedRef.current = true
            if (isMountedRef.current) {
              setSS('conflict')
              openConfirmDialog({
                title: `「${mapTitle}」で競合が検出されました`,
                message:
                  'このファイルは別のデバイスまたは別のプロジェクトの内容で更新されています。' +
                  '自分の編集内容を上書き保存すると、保存先にある別の内容が失われます。',
                confirmLabel: '上書き保存',
                danger: true,
                secondaryAction: {
                  label: '最新版を読み込む',
                  onClick: async () => {
                    // 保存先から最新版を再ロード
                    const opened = await file.openFile(ref)
                    const data = opened?.content as (MapFile & { mapId?: string }) | undefined
                    if (!data) return
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

        const savedRef = ref
          ? await file.saveFile(ref, mapFile)
          : await file.saveFileAs(mapFile, mapTitle)

        // saveFileAs の null は保存ダイアログのキャンセル（デスクトップ版のみ起きる）。
        // 失敗ではないのでエラー表示はせず、未保存のまま次の操作を待つ
        if (!savedRef) {
          if (isMountedRef.current) setSaveStatus('unsaved')
          return
        }

        if (isMountedRef.current) {
          if (!ref) {
            // 新規保存で採番された id と mapId を確定
            setCurrentFileId(savedRef.id, savedRef.origin)
            setCurrentMapId(mapFile.mapId)
            hasCheckedThisSessionRef.current = true
          }
          failureCountRef.current = 0
          setSaveStatus('saved')
          useUIStore.getState().setLastSavedAt(new Date().toISOString())
        }
      } catch (err) {
        if (isMountedRef.current) {
          setSaveStatus('error')
          failureCountRef.current += 1
          const handler = onSaveErrorRef.current
          let decision: 'retry' | 'handled' = 'handled'
          if (handler) {
            decision = handler(err, failureCountRef.current)
          } else {
            useUIStore.getState().addToast('保存に失敗しました', 'error')
          }
          if (decision === 'retry') pendingRetryRef.current = true
        }
      }
    } else {
      if (isMountedRef.current) {
        setSaveStatus('saved')
        useUIStore.getState().setLastSavedAt(new Date().toISOString())
      }
    }
  }, [remoteReady, createNewFileOnSave, setSaveStatus])

  // データ変更・タイトル変更どちらでも同じデバウンスタイマーを共有する
  const scheduleSave = useCallback(() => {
    if (!autoSave) return
    // マップ未読込のうちは保存をスケジュールしない（performSave と同じ理由）
    if (!useUIStore.getState().hasActiveMap) return
    setSaveStatus('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSaveStatus('saving')
      void performSave()
    }, DEBOUNCE_MS)
  }, [autoSave, performSave, setSaveStatus])

  // credentialKey が更新されたら失敗カウンタをリセットし、必要なら保存をリトライ
  useEffect(() => {
    if (credentialKey !== null) {
      failureCountRef.current = 0
      if (pendingRetryRef.current) {
        pendingRetryRef.current = false
        scheduleSave()
      }
    }
  }, [credentialKey, scheduleSave])

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
        // 明示的な保存なので、保存先が未確定なら「名前を付けて保存」まで進めてよい
        void performSave(true)
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
