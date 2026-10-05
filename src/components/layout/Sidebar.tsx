import { NavLink } from 'react-router-dom'
import { useSidebarMode } from '@/hooks/useSidebarMode'
import { LIBRARY_NAV, PRIMARY_NAV, type NavItem } from './nav'

function Item({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={expanded ? undefined : item.label}
      className={({ isActive }) =>
        `flex min-h-11 items-center rounded-lg text-sm transition-colors ${expanded ? 'gap-4 px-3' : 'flex-col justify-center gap-1 px-1 py-2 text-[10px]'} ${
          isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-text hover:bg-surface-hover'
        }`
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className={expanded ? 'truncate' : 'max-w-full truncate'}>{item.label}</span>
    </NavLink>
  )
}

/** Full nav (drawer / expanded desktop) or an icon rail (tablet / collapsed desktop). */
export function NavList({ expanded }: { expanded: boolean }) {
  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-0.5 p-2">
      {PRIMARY_NAV.map((i) => (
        <Item key={i.to} item={i} expanded={expanded} />
      ))}
      <hr className="my-2 border-border" />
      {LIBRARY_NAV.map((i) => (
        <Item key={i.to} item={i} expanded={expanded} />
      ))}
    </nav>
  )
}

export function Sidebar() {
  const rail = useSidebarMode().mode === 'rail'
  // Tablet (md) always shows the rail; desktop (lg) is expanded unless collapsed / on the Watch page.
  return (
    <aside className={`fixed bottom-0 left-0 top-[var(--topbar-h)] z-30 hidden overflow-y-auto border-r border-border bg-background md:block ${rail ? 'md:w-[var(--rail-w)]' : 'md:w-[var(--rail-w)] lg:w-[var(--sidebar-w)]'}`}>
      <div className="hidden lg:block">
        <NavList expanded={!rail} />
      </div>
      <div className="lg:hidden">
        <NavList expanded={false} />
      </div>
    </aside>
  )
}

/** Slide-over menu for phones and tablets. */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-[var(--overlay)] transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-background shadow-[var(--shadow)] transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`} role="dialog" aria-label="메뉴" inert={!open}>
        <NavList expanded />
      </aside>
    </div>
  )
}
