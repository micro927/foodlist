import { CalendarCheck, CalendarPlus, MapPin } from 'lucide-react'
import { Cover } from '@/components/Cover'
import { CoupleToggle } from '@/components/CoupleToggle'
import { useToggleInterest } from '@/lib/data'
import { useMe, useOrderedCouples } from '@/lib/device'
import type { Restaurant } from '@/lib/types'
import { categoryEmoji, trip } from '@/trip.config'
import { useOpenSheet } from '../sheets'

type Props = { restaurant: Restaurant; planned: number }

function Toggles({ restaurant }: { restaurant: Restaurant }) {
  const toggle = useToggleInterest()
  const me = useMe()
  const couples = useOrderedCouples(trip.couples)
  return (
    <div className="flex gap-1.5">
      {couples.map((c) => (
        <CoupleToggle
          key={c.id}
          couple={c}
          isMe={c.id === me}
          active={restaurant.interested.includes(c.id)}
          onToggle={() => toggle.mutate({ restaurant, couple: c.id })}
        />
      ))}
    </div>
  )
}

function PlannedBadge({ planned }: { planned: number }) {
  if (!planned) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
      <CalendarCheck className="size-3" />
      {planned > 1 ? `×${planned}` : 'Planned'}
    </span>
  )
}

const subtitle = (r: Restaurant) =>
  [r.category && `${categoryEmoji(r.category)} ${r.category}`, r.area].filter(Boolean).join(' · ')

export function RestaurantCard({ restaurant, planned }: Props) {
  const openSheet = useOpenSheet()
  return (
    <article
      onClick={() => openSheet({ kind: 'detail', id: restaurant.id })}
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition active:scale-[0.98]"
    >
      <div className="relative">
        <Cover restaurant={restaurant} className="aspect-[4/3] w-full" />
        <div className="absolute top-2 left-2">
          <PlannedBadge planned={planned} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 pt-2.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold">{restaurant.name}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">{subtitle(restaurant) || ' '}</p>
        <div className="mt-auto flex items-center justify-between pt-2.5">
          <Toggles restaurant={restaurant} />
          <button
            type="button"
            aria-label="Add to plan"
            onClick={(e) => {
              e.stopPropagation()
              openSheet({ kind: 'entry', draft: { restaurant_id: restaurant.id } })
            }}
            className="grid size-9 place-items-center rounded-full text-primary active:bg-primary-soft"
          >
            <CalendarPlus className="size-5" />
          </button>
        </div>
      </div>
    </article>
  )
}

export function RestaurantRow({ restaurant, planned }: Props) {
  const openSheet = useOpenSheet()
  return (
    <article
      onClick={() => openSheet({ kind: 'detail', id: restaurant.id })}
      className="flex cursor-pointer items-center gap-3 p-2.5 pr-3 transition active:bg-canvas"
    >
      <Cover restaurant={restaurant} className="size-16 shrink-0 rounded-2xl" emojiClass="text-2xl" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold">{restaurant.name}</h3>
        <p className="truncate text-xs text-muted">{subtitle(restaurant) || '—'}</p>
        <div className="mt-1 flex items-center gap-2">
          {restaurant.maps_url && (
            <a
              href={restaurant.maps_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary"
            >
              <MapPin className="size-3" /> Map
            </a>
          )}
          {planned > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted">
              <CalendarCheck className="size-3" /> {planned > 1 ? `×${planned}` : 'Planned'}
            </span>
          )}
        </div>
      </div>
      <Toggles restaurant={restaurant} />
    </article>
  )
}
