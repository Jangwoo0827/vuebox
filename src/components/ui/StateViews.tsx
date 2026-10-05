import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { userMessage } from '@/lib/errors'

export function LoadingState({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-text-secondary">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-text-secondary">{icon ?? <Inbox className="size-6" aria-hidden />}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-md text-sm text-text-secondary">{description}</p>}
      {action}
    </div>
  )
}

interface ErrorStateProps {
  error?: unknown
  title?: string
  message?: string
  onRetry?: () => void
  compact?: boolean
}

/** Friendly error with an optional retry. Retrying is always user-initiated: no automatic loops. */
export function ErrorState({ error, title = '문제가 발생했습니다', message, onRetry, compact }: ErrorStateProps) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 text-center ${compact ? 'py-8' : 'py-16'}`}>
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/15 text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-text-secondary">{message ?? userMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> 다시 시도
        </button>
      )}
    </div>
  )
}
