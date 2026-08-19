import { useSettingsStore } from '@ideamap/core'

/** AI提案数のスライダー。Claude / Ollama どちらのセクションからも使う */
export function SuggestionCountField() {
  const { suggestionCount, setSuggestionCount } = useSettingsStore()
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        AI提案数: <span className="font-medium text-gray-700 dark:text-gray-200">{suggestionCount}個</span>
      </label>
      <input
        type="range"
        min={3}
        max={7}
        value={suggestionCount}
        onChange={(e) => setSuggestionCount(Number(e.target.value))}
        className="w-full accent-primary-600"
      />
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-0.5">
        <span>3</span><span>7</span>
      </div>
    </div>
  )
}
