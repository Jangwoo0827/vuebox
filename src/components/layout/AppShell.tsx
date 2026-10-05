import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useAutoNotifications } from '@/hooks/useAutoNotifications'
import { useImmersiveLandscape } from '@/hooks/useImmersiveLandscape'
import { useRecommendationSync } from '@/hooks/useRecommendationSync'
import { useSidebarMode } from '@/hooks/useSidebarMode'
import { useUiStore } from '@/stores/uiStore'
import { MobileNavigation } from './MobileNavigation'
import { Drawer, Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  const location = useLocation()
  const drawerOpen = useUiStore((s) => s.drawerOpen)
  const setDrawer = useUiStore((s) => s.setDrawer)
  const rail = useSidebarMode().mode === 'rail'
  const immersive = useImmersiveLandscape()

  useRecommendationSync()
  useAutoNotifications()

  useEffect(() => {
    setDrawer(false)
    window.scrollTo(0, 0)
  }, [location.pathname, setDrawer])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen, setDrawer])

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-[300] rounded-lg bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        본문으로 건너뛰기
      </a>
      {!immersive && (
        <>
          <TopBar />
          <Sidebar />
          <Drawer open={drawerOpen} onClose={() => setDrawer(false)} />
        </>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={
          immersive
            ? 'outline-none'
            : `pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom))] pt-[var(--topbar-h)] outline-none md:pb-0 md:pl-[var(--rail-w)] ${rail ? '' : 'lg:pl-[var(--sidebar-w)]'}`
        }
      >
        <div className={immersive ? '' : 'mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 md:px-6 md:py-6'}>
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      {!immersive && <MobileNavigation />}
    </div>
  )
}
