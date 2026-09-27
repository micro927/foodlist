import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock, Plus } from 'lucide-react'
import { Cover } from '@/components/Cover'
import { usePlan, usePlanCounts, useRestaurantMap, useRestaurants } from '@/lib/data'
import { useMe } from '@/lib/device'
import type { PlanEntry } from '@/lib/types'
import { cn, local, todayIso, tripDays } from '@/lib/utils'
import { coupleById, trip, type SlotId } from '@/trip.config'
import { useOpenSheet } from '../sheets'

const isShared = (e: PlanEntry) => trip.couples.every((c) => e.going.includes(c.id))
const byTime = (a: PlanEntry, b: PlanEntry) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.position - b.position

export function PlanPage() {
  const { data: plan = [] } = usePlan()
  const me = useMe()
  const today = todayIso()
  const [activeDay, setActiveDay] = useState(tripDays[0].date)
  const chipStrip = useRef<HTMLDivElement>(null)

  // day → slot → entries
  const grouped = useMemo(() => {
    const map = new Map<string, Map<SlotId, PlanEntry[]>>()
    for (const e of plan) {
      const day = map.get(e.day) ?? new Map<SlotId, PlanEntry[]>()
      day.set(e.slot, [...(day.get(e.slot) ?? []), e])
      map.set(e.day, day)
    }
    for (const day of map.values()) for (const list of day.values()) list.sort(byTime)
    return map
  }, [plan])

  // Highlight the day chip for whichever day is at the top of the screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (items) => {
        const top = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActiveDay((top.target as HTMLElement).dataset.day!)
      },
      { rootMargin: '-190px 0px -55% 0px' },
    )
    document.querySelectorAll('[data-day]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    chipStrip.current?.querySelector(`[data-chip="${activeDay}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeDay])

  // During the trip, open on today.
  useEffect(() => {
    if (tripDays.some((d) => d.date === today)) document.getElementById(`day-${today}`)?.scrollIntoView({ block: 'start' })
  }, [today])

  const jumpTo = (date: string) => document.getElementById(`day-${date}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">{trip.name}</p>
          <h1 className="text-2xl leading-tight font-extrabold">Plan</h1>

          <div ref={chipStrip} className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-2.5">
            {tripDays.map((d) => {
              const active = d.date === activeDay
              const filled = grouped.has(d.date)
              return (
                <button
                  key={d.date}
                  type="button"
                  data-chip={d.date}
                  onClick={() => jumpTo(d.date)}
                  className={cn(
                    'relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-[11px] leading-tight transition',
                    active ? 'border-primary bg-primary text-white' : 'border-line bg-surface',
                    d.date === today && !active && 'border-primary text-primary',
                  )}
                >
                  <span className={cn(active ? 'text-white/80' : 'text-muted')}>{d.weekday}</span>
                  <span className="text-sm font-bold">{d.dayMonth.split(' ')[0]}</span>
                  {filled && <span className={cn('absolute bottom-1 size-1 rounded-full', active ? 'bg-white' : 'bg-primary')} />}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pb-2 text-center text-xs font-bold">
            {trip.couples.map((c) => (
              <div key={c.id} className="rounded-full py-1.5" style={{ backgroundColor: c.soft, color: c.color }}>
                {c.emoji} {c.name}
                {c.id === me && <span className="font-medium opacity-70"> (you)</span>}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-4">
        <NotScheduled />
        {tripDays.map((d) => (
          <section key={d.date} id={`day-${d.date}`} data-day={d.date} className="scroll-mt-48">
            <h2 className="mb-2 flex items-baseline gap-2 px-1">
              <span className="text-lg font-extrabold">
                {d.weekday} {d.dayMonth}
              </span>
              <span className="text-sm font-semibold text-muted">Day {d.number}</span>
              {d.date === today && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">Today</span>}
            </h2>
            <div className="space-y-1 rounded-3xl border border-line bg-surface p-2">
              {trip.slots.map((s) => (
                <SlotRow key={s.id} day={d.date} slot={s} entries={grouped.get(d.date)?.get(s.id) ?? []} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

function SlotRow({ day, slot, entries }: { day: string; slot: (typeof trip.slots)[number]; entries: PlanEntry[] }) {
  const openSheet = useOpenSheet()
  const add = () => openSheet({ kind: 'entry', draft: { day, slot: slot.id } })

  if (entries.length === 0) {
    return (
      <button
        type="button"
        onClick={add}
        className="flex h-10 w-full items-center gap-2 rounded-2xl border border-dashed border-line px-3 text-sm text-muted transition active:bg-canvas"
      >
        <span className="opacity-70">{slot.emoji}</span>
        <span className="flex-1 text-left">{slot.label}</span>
        <Plus className="size-4" />
      </button>
    )
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <span className="text-xs font-bold text-muted">
          {slot.emoji} {slot.label}
        </span>
        <button type="button" aria-label={`Add to ${slot.label}`} onClick={add} className="grid size-7 place-items-center rounded-full text-muted active:bg-canvas">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="grid grid-flow-row-dense grid-cols-2 gap-1.5">
        {entries.map((e) => (
          <EntryBlock key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}

function EntryBlock({ entry }: { entry: PlanEntry }) {
  const openSheet = useOpenSheet()
  const restaurant = useRestaurantMap().get(entry.restaurant_id)
  if (!restaurant) return null

  const shared = isShared(entry)
  const couple = shared ? undefined : coupleById(entry.going[0])
  const column = shared ? undefined : trip.couples.findIndex((c) => c.id === entry.going[0]) + 1
  const [a, b] = trip.couples

  return (
    <button
      type="button"
      onClick={() => openSheet({ kind: 'entry', draft: entry })}
      style={{
        gridColumn: shared ? '1 / -1' : `${column}`,
        background: shared ? `linear-gradient(90deg, ${a.soft}, ${b.soft})` : couple?.soft,
        borderLeftColor: couple?.color,
      }}
      className={cn('flex min-w-0 items-center gap-2.5 rounded-2xl p-2 text-left transition active:scale-[0.98]', !shared && 'border-l-4')}
    >
      <Cover restaurant={restaurant} className="size-11 shrink-0 rounded-xl" emojiClass="text-xl" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug font-bold">{restaurant.name}</span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink/60">
          {entry.time ? (
            <>
              <Clock className="size-3" /> {entry.time}
            </>
          ) : (
            restaurant.category || restaurant.area
          )}
          {shared && <span className="ml-1">· {trip.couples.map((c) => c.emoji).join('')} Together</span>}
        </span>
      </span>
    </button>
  )
}

/** Places someone wants that aren't in the plan yet. */
function NotScheduled() {
  const { data: restaurants = [] } = useRestaurants()
  const counts = usePlanCounts()
  const openSheet = useOpenSheet()
  const [open, setOpen] = useState(() => local.get('foodlist:unscheduled') !== 'closed')

  const list = restaurants
    .filter((r) => r.interested.length > 0 && !counts.get(r.id))
    .sort((a, b) => b.interested.length - a.interested.length || a.name.localeCompare(b.name))
  if (list.length === 0) return null

  const toggle = () => {
    local.set('foodlist:unscheduled', open ? 'closed' : 'open')
    setOpen(!open)
  }

  return (
    <section className="rounded-3xl border border-line bg-surface">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className="flex-1 font-bold">
          Not scheduled yet <span className="font-semibold text-muted">{list.length}</span>
        </span>
        <ChevronDown className={cn('size-5 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openSheet({ kind: 'entry', draft: { restaurant_id: r.id } })}
              className="flex w-28 shrink-0 flex-col text-left active:scale-[0.97]"
            >
              <Cover restaurant={r} className="aspect-square w-full rounded-2xl" emojiClass="text-3xl" />
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-bold">{r.name}</p>
              <p className="mt-auto pt-0.5 text-xs">
                {trip.couples.map((c) => (
                  <span key={c.id} className={cn(!r.interested.includes(c.id) && 'opacity-20 grayscale')}>
                    {c.emoji}
                  </span>
                ))}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
