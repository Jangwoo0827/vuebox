import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  action?: { label: string; to: string }
  children: ReactNode
}

export function Section({ title, subtitle, action, children }: Props) {
  return (
    <section className="mb-10" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{title}</h2>
          {subtitle && <p className="truncate text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {action && (
          <Link to={action.to} className="shrink-0 text-sm font-medium text-accent hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
