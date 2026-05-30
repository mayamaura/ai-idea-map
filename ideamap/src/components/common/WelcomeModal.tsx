import { useState } from 'react'
import { createPortal } from 'react-dom'

const STEPS = [
  {
    icon: '💡',
    title: 'アイデアを追加',
    desc: 'キャンバスをダブルクリック、または左下の「+」ボタンでアイデアノードを追加できます。',
  },
  {
    icon: '🔗',
    title: 'アイデアをつなぐ',
    desc: 'ノードにカーソルを合わせるとハンドルが現れます。ドラッグして別のノードへ接続しましょう。',
  },
  {
    icon: '✦',
    title: 'AIでアイデアを広げる',
    desc: 'ノードを右クリックして「AIで拡張」を選択。Claude がアイデアの続きを提案します。',
  },
]

interface WelcomeModalProps {
  onClose: () => void
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-dialog">
        {/* ステップインジケーター */}
        <div className="flex gap-1.5 px-6 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* コンテンツ */}
        <div className="px-6 py-6 text-center">
          <div className="text-5xl mb-4">{STEPS[step].icon}</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{STEPS[step].title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{STEPS[step].desc}</p>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 pb-5 gap-3">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            className="flex-1 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            {isLast ? 'はじめる' : '次へ'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
