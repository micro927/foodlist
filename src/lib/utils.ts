import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { trip } from '@/trip.config'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** localStorage that never throws (private mode, blocked storage). */
export const local = {
  get(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {}
  },
}

// Dates are plain 'YYYY-MM-DD' strings, handled in UTC so no timezone can shift a day.
const DAY_MS = 86_400_000
const parse = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export type TripDay = { date: string; number: number; weekday: string; dayMonth: string }

export const tripDays: TripDay[] = (() => {
  const days: TripDay[] = []
  for (let ms = parse(trip.startDate), n = 1; ms <= parse(trip.endDate); ms += DAY_MS, n++) {
    const d = new Date(ms)
    days.push({
      date: toIso(ms),
      number: n,
      weekday: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      dayMonth: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    })
  }
  return days
})()

export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDay(iso: string) {
  const day = tripDays.find((d) => d.date === iso)
  return day ? `${day.weekday} ${day.dayMonth} · Day ${day.number}` : iso
}

export function hostLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('tiktok')) return 'TikTok'
    if (host.includes('youtu')) return 'YouTube'
    if (host.includes('instagram')) return 'Instagram'
    if (host.includes('facebook') || host === 'fb.com') return 'Facebook'
    if (host.includes('tabelog')) return 'Tabelog'
    if (host.includes('google') || host.includes('goo.gl')) return 'Google'
    return host
  } catch {
    return 'Link'
  }
}
