import { CalendarCheck, CalendarPlus, MapPin } from 'lucide-react'
import { Cover } from '@/components/Cover'
import { CoupleToggle } from '@/components/CoupleToggle'
import { useToggleInterest } from '@/lib/data'
import { useMe, useOrderedCouples } from '@/lib/device'
import { itemEmoji } from '@/lib/sections'
import type { Item, Section } from '@/lib/types'
import { trip } from '@/trip.config'
import { useOpenSheet } from '../sheets'

type Props = { section: Section; item: Item; planned: number }

function Toggles({ section, item }: { section: Section; item: Item }) {
  const toggle = useToggleInterest(section)
  const me = useMe()
  const couples = useOrderedCouples(trip.couples)
  return (
    <div className="flex gap-1.5">
      {couples.map((c) => (
        <CoupleToggle
          key={c.id}
          couple={c}
          isMe={c.id === me}
          active={item.interested.includes(c.id)}
          onToggle={() => toggle.mutate({ item, couple: c.id })}
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

export const itemSubtitle = (section: Section, r: Item) =>
  [r.category && `${itemEmoji(section, r)} ${r.category}`, r.area].filter(Boolean).join(' · ')

export function ItemCard({ section, item, planned }: Props) {
  const openSheet = useOpenSheet()
  return (
    <article
      onClick={() => openSheet({ kind: 'detail', section, id: item.id })}
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition active:scale-[0.98]"
    >
      <div className="relative">
        <Cover of={item} emoji={itemEmoji(section, item)} className="aspect-[4/3] w-full" />
        <div className="absolute top-2 left-2">
          <PlannedBadge planned={planned} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 pt-2.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold">{item.name}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">{itemSubtitle(section, item) || ' '}</p>
        <div className="mt-auto flex items-center justify-between pt-2.5">
          <Toggles section={section} item={item} />
          <button
            type="button"
            aria-label="Add to plan"
            onClick={(e) => {
              e.stopPropagation()
              openSheet({ kind: 'entry', section, draft: { item_id: item.id } })
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

export function ItemRow({ section, item, planned }: Props) {
  const openSheet = useOpenSheet()
  return (
    <article
      onClick={() => openSheet({ kind: 'detail', section, id: item.id })}
      className="flex cursor-pointer items-center gap-3 p-2.5 pr-3 transition active:bg-canvas"
    >
      <Cover of={item} emoji={itemEmoji(section, item)} className="size-16 shrink-0 rounded-2xl" emojiClass="text-2xl" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold">{item.name}</h3>
        <p className="truncate text-xs text-muted">{itemSubtitle(section, item) || '—'}</p>
        <div className="mt-1 flex items-center gap-2">
          {item.maps_url && (
            <a
              href={item.maps_url}
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
      <Toggles section={section} item={item} />
    </article>
  )
}
