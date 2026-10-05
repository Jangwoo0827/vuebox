import { NavLink } from 'react-router-dom'
import { MOBILE_NAV } from './nav'

/** Bottom tab bar for phones: large touch targets, safe-area aware. */
export function MobileNavigation() {
  return (
    <nav aria-label="하단 메뉴" className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--bottomnav-h)] items-stretch border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? 'font-semibold text-accent' : 'text-text-secondary'}`}>
          <Icon className="size-6" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
