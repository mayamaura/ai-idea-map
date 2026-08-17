/**
 * ノード画像添付（Phase 49 D）用のクライアントサイド画像リサイズ。
 * exportService.ts の FileReader、ExportImportPanel.tsx の <input type="file"> と同じく、
 * Platform Adapter を介さないブラウザ標準API（FileReader/Image/canvas）を直接使う前例に倣う。
 */

const DEFAULT_MAX_DIMENSION = 640
const DEFAULT_MAX_BYTES = 200_000

/**
 * 画像ファイルを長辺 maxDimension 以下にリサイズし、JPEG品質を段階的に下げながら
 * data URL の文字列長が maxBytes 以下に収まるよう圧縮する（base64 は概算でバイト数と比例するため目安）。
 */
export function resizeImageToDataUrl(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  maxBytes = DEFAULT_MAX_BYTES
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('画像の処理に失敗しました'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        let quality = 0.9
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        while (dataUrl.length > maxBytes && quality > 0.1) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}
