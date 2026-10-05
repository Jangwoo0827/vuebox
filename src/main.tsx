import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { SetupScreen } from './app/SetupScreen'
import { isConfigured } from './lib/env'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigured ? (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    ) : (
      <SetupScreen />
    )}
  </StrictMode>,
)
