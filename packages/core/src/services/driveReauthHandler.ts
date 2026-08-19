import { useUIStore } from '../stores/uiStore'

export interface DriveReauthDeps {
  /**
   * 今回の保存が Drive 宛て（401 を認証切れとして扱ってよい）かどうか。
   * Web版は常に Drive 保存なので `() => true` でよい。デスクトップ版はローカル保存もあるため
   * `currentFileOrigin === 'cloud'` を渡す。
   */
  isCloudSave: () => boolean
  /**
   * オフラインなら 401 判定より前に 'retry' を返す（Web版のみ渡す）。
   * オフライン中の fetch 失敗をトースト付きの認証エラーとして誤扱いしないためのガード。
   * オンライン復帰後は useAutoSave 側の online イベントで自動リトライされる。
   */
  isOnline?: () => boolean
  /** 初回401で試すサイレント再認証（保存元のリフレッシュトークン等を使う） */
  silentReauth: () => void
  /** 2回目以降の401でトーストの「再接続」ボタンから呼ぶ */
  signIn: () => void
  /** 401 以外の保存失敗メッセージ。省略時は Drive 向けの文言を使う */
  nonAuthErrorMessage?: (isCloudSave: boolean) => string
}

/**
 * Web版・デスクトップ版で重複していた「保存失敗ハンドラ」を共通化するファクトリ。
 * 401なら初回はサイレント再認証してリトライ、2回目以降は再接続ボタン付きトーストを出す。
 * 401以外は保存失敗トーストのみ。両アプリの違い（デスクトップの isCloud 判定・Webの
 * navigator.onLine 判定）は deps 経由で注入する。addToast は uiStore（core内）を直接参照する。
 */
export function createDriveReauthHandler(
  deps: DriveReauthDeps,
): (err: unknown, attempt: number) => 'retry' | 'handled' {
  return (err, attempt) => {
    if (deps.isOnline && !deps.isOnline()) return 'retry'

    const isCloud = deps.isCloudSave()
    const isAuthError = isCloud && err instanceof Error && err.message.includes('401')

    if (!isAuthError) {
      const message = deps.nonAuthErrorMessage?.(isCloud) ?? 'Googleドライブへの保存に失敗しました'
      useUIStore.getState().addToast(message, 'error')
      return 'handled'
    }

    if (attempt === 1) {
      deps.silentReauth()
      return 'retry'
    }

    useUIStore.getState().addToast('Googleドライブの認証が切れました', 'error', {
      label: '再接続',
      onClick: deps.signIn,
    })
    return 'handled'
  }
}
