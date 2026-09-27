import { useSyncExternalStore } from 'react'
import { coupleIds, type CoupleId } from '@/trip.config'
import { local } from './utils'

// "We are…" — which couple this phone belongs to. Only used to highlight your side.
const KEY = 'foodlist:me'
const listeners = new Set<() => void>()

function read(): CoupleId | null {
  const value = local.get(KEY)
  return coupleIds.includes(value as CoupleId) ? (value as CoupleId) : null
}

export function setMe(id: CoupleId | null) {
  local.set(KEY, id)
  listeners.forEach((l) => l())
}

export function useMe() {
  return useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => void listeners.delete(cb)
  }, read)
}

/** Couples with this phone's couple first. */
export function useOrderedCouples<T extends { id: string }>(couples: readonly T[]) {
  const me = useMe()
  return me ? [...couples].sort((a, b) => Number(b.id === me) - Number(a.id === me)) : [...couples]
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
  )
}
