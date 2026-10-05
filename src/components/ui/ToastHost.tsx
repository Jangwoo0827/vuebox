import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'

const ICONS = { info: Info, success: CheckCircle2, error: XCircle } as const
const COLORS = { info: 'text-accent', success: 'text-success', error: 'text-danger' } as const

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottomnav-h)+12px)] z-[200] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite" role="region" aria-label="알림">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div key={t.id} className="fade-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm shadow-[var(--shadow)]">
            <Icon className={`size-5 shrink-0 ${COLORS[t.kind]}`} aria-hidden />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 font-semibold text-accent"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="shrink-0 text-text-secondary hover:text-text" onClick={() => dismiss(t.id)} aria-label="닫기">
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
