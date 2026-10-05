import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/app/AuthProvider'
import { RequireAuth } from '@/app/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LoadingState } from '@/components/ui/StateViews'
import { ToastHost } from '@/components/ui/ToastHost'
import { useTheme } from '@/hooks/useTheme'

const HomePage = lazy(() => import('@/pages/HomePage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const WatchPage = lazy(() => import('@/pages/WatchPage'))
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'))
const TrendingPage = lazy(() => import('@/pages/TrendingPage'))
const ChannelPage = lazy(() => import('@/pages/ChannelPage'))
const SubscriptionsPage = lazy(() => import('@/pages/SubscriptionsPage'))
const ShortsPage = lazy(() => import('@/pages/ShortsPage'))
const LibraryPage = lazy(() => import('@/pages/LibraryPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const PlaylistsPage = lazy(() => import('@/pages/PlaylistsPage'))
const PlaylistDetailPage = lazy(() => import('@/pages/PlaylistDetailPage'))
const YoutubePlaylistPage = lazy(() => import('@/pages/YoutubePlaylistPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const StatsPage = lazy(() => import('@/pages/StatsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/PasswordPages').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/PasswordPages').then((m) => ({ default: m.ResetPasswordPage })))
const PrivacyPage = lazy(() => import('@/pages/LegalPages').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('@/pages/LegalPages').then((m) => ({ default: m.TermsPage })))
const WatchLaterPage = lazy(() => import('@/pages/SavedLists').then((m) => ({ default: m.WatchLaterPage })))
const FavoritesPage = lazy(() => import('@/pages/SavedLists').then((m) => ({ default: m.FavoritesPage })))
const LikedPage = lazy(() => import('@/pages/SavedLists').then((m) => ({ default: m.LikedPage })))

/** Keeps <html data-theme> in sync with the user's preference. */
function ThemeSync() {
  useTheme()
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeSync />
        <BrowserRouter>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="discover" element={<DiscoverPage />} />
                <Route path="trending" element={<TrendingPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="watch/:id" element={<WatchPage />} />
                <Route path="channel/:id" element={<ChannelPage />} />
                <Route path="shorts" element={<ShortsPage />} />
                <Route path="youtube-playlist/:id" element={<YoutubePlaylistPage />} />
                <Route path="playlist/:id" element={<PlaylistDetailPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="terms" element={<TermsPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="subscriptions" element={<SubscriptionsPage />} />
                  <Route path="library" element={<LibraryPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="watch-later" element={<WatchLaterPage />} />
                  <Route path="favorites" element={<FavoritesPage />} />
                  <Route path="liked" element={<LikedPage />} />
                  <Route path="playlists" element={<PlaylistsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
          <ToastHost />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
