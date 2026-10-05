import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Per-device UI preferences only. Account data never lives here. */
interface UiState {
  theater: boolean
  sidebarCollapsed: boolean
  /** Mobile/tablet drawer. */
  drawerOpen: boolean
  /** Region for signed-out visitors (signed-in users use their saved setting). */
  guestRegion: string
  /** Use the youtube-nocookie.com embed host (official privacy-enhanced mode). */
  privacyPlayer: boolean
  setPrivacyPlayer: (v: boolean) => void
  setTheater: (v: boolean) => void
  toggleTheater: () => void
  toggleSidebar: () => void
  setDrawer: (v: boolean) => void
  setGuestRegion: (r: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theater: false,
      sidebarCollapsed: false,
      drawerOpen: false,
      guestRegion: 'KR',
      privacyPlayer: true,
      setPrivacyPlayer: (privacyPlayer) => set({ privacyPlayer }),
      setTheater: (theater) => set({ theater }),
      toggleTheater: () => set((s) => ({ theater: !s.theater })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDrawer: (drawerOpen) => set({ drawerOpen }),
      setGuestRegion: (guestRegion) => set({ guestRegion }),
    }),
    {
      name: 'vuebox-ui',
      partialize: (s) => ({ theater: s.theater, sidebarCollapsed: s.sidebarCollapsed, guestRegion: s.guestRegion, privacyPlayer: s.privacyPlayer }),
    },
  ),
)
