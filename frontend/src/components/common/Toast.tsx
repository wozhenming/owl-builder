import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

const KIND_STYLE = {
  success: { bg: 'bg-emerald-50 border-emerald-300 text-emerald-800', icon: <CheckCircle2 size={16} /> },
  error: { bg: 'bg-red-50 border-red-300 text-red-800', icon: <AlertCircle size={16} /> },
  info: { bg: 'bg-sky-50 border-sky-300 text-sky-800', icon: <Info size={16} /> },
} as const

/** 轻量提示条（右下角，3 秒自动消失） */
export default function Toast() {
  const toast = useUiStore((s) => s.toast)
  const hideToast = useUiStore((s) => s.hideToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(hideToast, 3000)
    return () => clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null
  const style = KIND_STYLE[toast.kind]

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60]">
      <div className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${style.bg}`}>
        {style.icon}
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
