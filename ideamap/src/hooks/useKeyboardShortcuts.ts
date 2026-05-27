import { useEffect } from 'react'
import { useMapStore } from '../stores/mapStore'

export function useKeyboardShortcuts() {
  const { undo, redo } = useMapStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])
}
