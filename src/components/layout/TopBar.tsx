import { ArrowLeft, Menu, Search } from 'lucide-react'
import { useState } from 'react'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSidebarMode } from '@/hooks/useSidebarMode'
import { useUiStore } from '@/stores/uiStore'
import { NotificationPanel } from './NotificationPanel'
import { ProfileMenu } from './ProfileMenu'
import { SearchBar } from './SearchBar'

export function TopBar() {
  const { isSignedIn } = useAuth()
  const [mobileSearch, setMobileSearch] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { forced } = useSidebarMode()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setDrawer = useUiStore((s) => s.setDrawer)

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--topbar-h)] items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur sm:px-4">
      {mobileSearch ? (
        <>
          <button type="button" className="icon-btn" aria-label="검색 닫기" onClick={() => setMobileSearch(false)}>
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <SearchBar autoFocus onDone={() => setMobileSearch(false)} />
        </>
      ) : (
        <>
          <button type="button" className="icon-btn" aria-label="메뉴" onClick={() => (isDesktop && !forced ? toggleSidebar() : setDrawer(true))}>
            <Menu className="size-5" aria-hidden />
          </button>
          <Logo />
          <div className="mx-auto hidden min-w-0 flex-1 justify-center px-4 md:flex">
            <SearchBar />
          </div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button type="button" className="icon-btn md:hidden" aria-label="검색" onClick={() => setMobileSearch(true)}>
              <Search className="size-5" aria-hidden />
            </button>
            {isSignedIn && <NotificationPanel />}
            <ProfileMenu />
          </div>
        </>
      )}
    </header>
  )
}
