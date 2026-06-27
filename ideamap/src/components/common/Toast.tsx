import { useUIStore } from '../../stores/uiStore'

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-[80] flex flex-col gap-2 pointer-events-none pb-[env(safe-area-inset-bottom)]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
            pointer-events-auto animate-slide-in
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'info' ? 'bg-gray-800 text-white' : ''}
          `}
        >
          {toast.type === 'error' && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {toast.type === 'success' && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div className="flex flex-col gap-1 flex-1">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick()
                  removeToast(toast.id)
                }}
                className="self-start text-xs font-semibold underline text-primary-200 hover:text-white transition-colors"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
