import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, Loader2, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Cover } from '@/components/Cover'
import { CoupleToggle } from '@/components/CoupleToggle'
import { Button, Chip, inputClass, Sheet, useSticky } from '@/components/ui'
import { useDeleteEntry, usePlanCounts, useRestaurantMap, useRestaurants, useSaveEntry } from '@/lib/data'
import { useMe, useOrderedCouples } from '@/lib/device'
import type { PlanEntry, Restaurant } from '@/lib/types'
import { cn, todayIso, tripDays } from '@/lib/utils'
import { coupleIds, trip, type CoupleId, type SlotId } from '@/trip.config'

/** A plan entry being created (no id) or edited. Anything missing gets a sensible default. */
export type EntryDraft = Partial<Pick<PlanEntry, 'id' | 'restaurant_id' | 'day' | 'slot' | 'time' | 'going'>>

type State = { draft: EntryDraft; nonce: number }

export function EntrySheet({ state, onClose }: { state: State | null; onClose: () => void }) {
  const last = useSticky(state)
  // Starts in picker mode when no restaurant was given; "Change" switches back to it.
  const [pickOverride, setPickOverride] = useState<{ nonce: number; value: boolean } | null>(null)
  const picking = pickOverride && pickOverride.nonce === last?.nonce ? pickOverride.value : !last?.draft.restaurant_id
  const setPicking = (value: boolean) => last && setPickOverride({ nonce: last.nonce, value })

  return (
    <Sheet open={state !== null} onClose={onClose} title={picking ? 'Pick a place' : last?.draft.id ? 'Edit plan' : 'Add to plan'}>
      {last && <EntryForm key={last.nonce} draft={last.draft} picking={picking} setPicking={setPicking} onDone={onClose} />}
    </Sheet>
  )
}

const defaultDay = () => {
  const today = todayIso()
  return tripDays.some((d) => d.date === today) ? today : tripDays[0].date
}

/** New entries start with whoever is interested; if nobody is, everyone. */
const defaultGoing = (r: Restaurant | undefined): CoupleId[] => (r?.interested.length ? [...r.interested] : [...coupleIds])

function EntryForm({
  draft,
  picking,
  setPicking,
  onDone,
}: {
  draft: EntryDraft
  picking: boolean
  setPicking: (v: boolean) => void
  onDone: () => void
}) {
  const restaurants = useRestaurantMap()
  const save = useSaveEntry()
  const remove = useDeleteEntry()
  const me = useMe()
  const couples = useOrderedCouples(trip.couples)

  const [restaurantId, setRestaurantId] = useState(draft.restaurant_id)
  const [day, setDay] = useState(draft.day ?? defaultDay())
  const [slot, setSlot] = useState<SlotId>(draft.slot ?? 'dinner')
  const [time, setTime] = useState(draft.time ?? '')
  const [going, setGoing] = useState<CoupleId[]>(draft.going ?? defaultGoing(restaurants.get(draft.restaurant_id ?? '')))
  const restaurant = restaurants.get(restaurantId ?? '')

  const dayStrip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dayStrip.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [picking])

  if (picking || !restaurant) {
    return (
      <RestaurantPicker
        onPick={(r) => {
          setRestaurantId(r.id)
          if (!draft.going) setGoing(defaultGoing(r))
          setPicking(false)
        }}
      />
    )
  }

  const submit = () =>
    save.mutate(
      { id: draft.id, fields: { restaurant_id: restaurant.id, day, slot, time: time || null, going } },
      {
        onSuccess: () => {
          toast.success(draft.id ? 'Plan updated' : `${restaurant.name} added to the plan`)
          onDone()
        },
      },
    )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-line p-2 pr-3">
        <Cover restaurant={restaurant} className="size-14 shrink-0 rounded-xl" emojiClass="text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{restaurant.name}</p>
          <p className="truncate text-sm text-muted">{[restaurant.category, restaurant.area].filter(Boolean).join(' · ')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
          Change
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Day</h3>
        <div ref={dayStrip} className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {tripDays.map((d) => (
            <button
              key={d.date}
              type="button"
              data-selected={d.date === day}
              onClick={() => setDay(d.date)}
              className={cn(
                'flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-xs transition',
                d.date === day ? 'border-primary bg-primary text-white' : 'border-line bg-surface',
              )}
            >
              <span className={cn(d.date === day ? 'text-white/80' : 'text-muted')}>{d.weekday}</span>
              <span className="text-sm font-bold">{d.dayMonth.split(' ')[0]}</span>
              <span className={cn(d.date === day ? 'text-white/80' : 'text-muted')}>{d.dayMonth.split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Meal</h3>
        <div className="flex flex-wrap gap-1.5">
          {trip.slots.map((s) => (
            <Chip key={s.id} active={s.id === slot} onClick={() => setSlot(s.id)}>
              {s.emoji} {s.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Time <span className="font-normal text-muted">(optional)</span>
        </h3>
        <div className="flex gap-2">
          <input type="time" className={cn(inputClass, 'flex-1')} value={time} onChange={(e) => setTime(e.target.value)} />
          {time && (
            <Button variant="outline" size="icon" className="size-12" aria-label="Clear time" onClick={() => setTime('')}>
              <X className="size-5" />
            </Button>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Who's going</h3>
        <div className="flex gap-2">
          {couples.map((c) => (
            <CoupleToggle
              key={c.id}
              couple={c}
              labeled
              isMe={c.id === me}
              active={going.includes(c.id)}
              onToggle={() =>
                setGoing((list) => {
                  if (!list.includes(c.id)) return [...list, c.id]
                  return list.length > 1 ? list.filter((x) => x !== c.id) : list
                })
              }
            />
          ))}
        </div>
      </section>

      <div className="flex gap-2 pt-1">
        {draft.id && (
          <Button
            variant="danger"
            size="icon"
            className="size-12"
            aria-label="Remove from plan"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(draft.id!, {
                onSuccess: () => {
                  toast.success('Removed from the plan')
                  onDone()
                },
              })
            }
          >
            <Trash2 className="size-5" />
          </Button>
        )}
        <Button className="flex-1" onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="size-5 animate-spin" />}
          {draft.id ? 'Save' : 'Add to plan'}
        </Button>
      </div>
    </div>
  )
}

/** Restaurants to choose from: places both couples want first, then the least-planned. */
function RestaurantPicker({ onPick }: { onPick: (r: Restaurant) => void }) {
  const { data: all = [] } = useRestaurants()
  const counts = usePlanCounts()
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all
      .filter((r) => !q || [r.name, r.category, r.area].some((v) => v.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          b.interested.length - a.interested.length ||
          (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
          a.name.localeCompare(b.name),
      )
  }, [all, counts, query])

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input className={cn(inputClass, 'pl-10')} placeholder="Search places" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted">No places yet — add some in Eats first.</p>}
      <ul className="space-y-1">
        {list.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-canvas">
              <Cover restaurant={r} className="size-12 shrink-0 rounded-xl" emojiClass="text-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate text-sm text-muted">{[r.category, r.area].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <span className="flex gap-0.5 text-sm">
                {trip.couples.map((c) => (
                  <span key={c.id} className={cn(!r.interested.includes(c.id) && 'opacity-20 grayscale')}>
                    {c.emoji}
                  </span>
                ))}
              </span>
              {(counts.get(r.id) ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted">
                  <CalendarCheck className="size-3.5" />
                  {counts.get(r.id)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
