import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CalendarDays, Lock, UtensilsCrossed, WifiOff } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button, inputClass } from '@/components/ui'
import { isDemo } from '@/lib/api'
import { useLiveUpdates } from '@/lib/data'
import { useOnline } from '@/lib/device'
import { cn, local } from '@/lib/utils'
import { trip } from '@/trip.config'
import { EatsPage } from '@/features/eats/EatsPage'
import { PlanPage } from '@/features/plan/PlanPage'
import { SheetsProvider } from '@/features/sheets'

// Client-side gate only (the password ships in the bundle) — keeps casual visitors out.
const PASSWORD = (import.meta.env.VITE_APP_PASSWORD as string | undefined) ?? ''
const UNLOCK_KEY = 'foodlist:unlocked'

export function App() {
  // Stays unlocked on this phone until the password in .env changes.
  const [unlocked, setUnlocked] = useState(() => !PASSWORD || local.get(UNLOCK_KEY) === PASSWORD)
  return (
    <>
      {unlocked ? (
        <Shell />
      ) : (
        <PasswordGate
          onUnlock={() => {
            local.set(UNLOCK_KEY, PASSWORD)
            setUnlocked(true)
          }}
        />
      )}
      <Toaster position="top-center" richColors closeButton={false} toastOptions={{ className: 'font-sans' }} />
    </>
  )
}

type Tab = 'eats' | 'plan'
const readTab = (): Tab => (location.hash === '#plan' ? 'plan' : 'eats')

function Shell() {
  useLiveUpdates()
  const online = useOnline()
  const [tab, setTab] = useState<Tab>(readTab)

  useEffect(() => {
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: Tab) => {
    if (next === tab) return window.scrollTo({ top: 0, behavior: 'smooth' })
    history.replaceState(null, '', next === 'plan' ? '#plan' : location.pathname)
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <SheetsProvider>
      {(!online || isDemo) && (
        <div className="bg-ink px-4 py-1.5 pt-[max(6px,env(safe-area-inset-top))] text-center text-xs font-medium text-white">
          {!online ? (
            <span className="inline-flex items-center gap-1.5">
              <WifiOff className="size-3.5" /> Offline — showing saved data, editing paused
            </span>
          ) : (
            'Demo mode — data is saved in this browser only'
          )}
        </div>
      )}

      {tab === 'eats' ? <EatsPage /> : <PlanPage />}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-md grid-cols-2">
          <TabButton active={tab === 'eats'} onClick={() => go('eats')} icon={<UtensilsCrossed className="size-6" />} label="Eats" />
          {/* The Plan icon always wears the primary colour — it's the trip planner call to action. */}
          <TabButton active={tab === 'plan'} onClick={() => go('plan')} icon={<CalendarDays className="size-6 text-primary" />} label="Plan" />
        </div>
      </nav>
    </SheetsProvider>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold', active ? 'text-ink' : 'text-muted')}>
      {active && <motion.span layoutId="tab-pill" className="absolute top-1.5 h-8 w-16 rounded-full bg-primary-soft" transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }} />}
      <span className="relative">{icon}</span>
      <span className="relative">{label}</span>
    </button>
  )
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (value === PASSWORD) onUnlock()
    else {
      setWrong(true)
      setValue('')
    }
  }

  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={wrong ? { x: [0, -10, 10, -6, 6, 0], opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        onAnimationComplete={() => setWrong(false)}
        className="w-full max-w-sm rounded-[32px] bg-white/80 p-7 text-center shadow-xl shadow-black/5 backdrop-blur-xl"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30">
          <Lock className="size-6" />
        </div>
        <p className="mt-5 text-[11px] font-bold tracking-[0.14em] text-primary uppercase">{trip.name}</p>
        <h1 className="mt-1 text-2xl font-extrabold">Where are we eating?</h1>
        <p className="mt-1.5 text-sm text-muted">Enter the trip password to continue.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className={cn(inputClass, 'mt-6 text-center', wrong && 'border-red-400')}
          placeholder="Password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" className="mt-3 w-full" disabled={!value}>
          Let's eat
        </Button>
      </motion.form>
    </div>
  )
}
