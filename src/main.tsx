import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { toast } from 'sonner'
import { trip } from './trip.config'
import { App } from './App'
import './index.css'

document.documentElement.style.setProperty('--color-primary', trip.primaryColor)

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 1000 * 60 * 60 * 24 * 30, staleTime: 1000 * 30 } },
  queryCache: new QueryCache({ onError: (err) => toast.error(`Couldn't load: ${errorMessage(err)}`) }),
  mutationCache: new MutationCache({ onError: (err) => toast.error(`Couldn't save: ${errorMessage(err)}`) }),
})

// Keeps the last loaded list and plan on the phone so they're readable offline.
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'foodlist:cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 30 }}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
