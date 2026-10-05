import { Link } from 'react-router-dom'

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M12 9.5v13l11-6.5z" fill="#fff" />
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 rounded-lg" aria-label="VUEBOX 홈">
      <LogoMark />
      {!compact && <span className="text-lg font-extrabold tracking-tight">VUEBOX</span>}
    </Link>
  )
}
