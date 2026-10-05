import { QueryClient } from '@tanstack/react-query'
import { AppError } from './errors'

// Quota and auth errors won't fix themselves on retry, so never loop on them.
const NO_RETRY = new Set(['QUOTA_EXCEEDED', 'RATE_LIMITED', 'NOT_FOUND', 'UNAUTHENTICATED', 'BAD_REQUEST', 'CHART_UNAVAILABLE'])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => count < 1 && !(error instanceof AppError && NO_RETRY.has(error.code)),
    },
    mutations: { retry: false },
  },
})
