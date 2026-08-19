/** マップ一覧・起動画面で使う日時表示のフォーマット（例: 2026年8月19日 12:34） */
export function formatMapDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
