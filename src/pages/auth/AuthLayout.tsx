import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 shadow-[var(--shadow)] sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-text-secondary">{footer}</div>}
        <p className="mt-6 text-center text-xs text-text-secondary">
          <Link to="/terms" className="hover:underline">이용약관</Link> · <Link to="/privacy" className="hover:underline">개인정보 처리방침</Link>
        </p>
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error ? (
        <span role="alert" className="text-xs font-normal text-danger">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs font-normal text-text-secondary">{hint}</span>
      )}
    </label>
  )
}
