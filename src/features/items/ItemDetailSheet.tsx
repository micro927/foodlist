import { useState } from 'react'
import { CalendarPlus, ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react'
import { Button, Sheet, useSticky } from '@/components/ui'
import { Cover } from '@/components/Cover'
import { CoupleToggle } from '@/components/CoupleToggle'
import { PhotoViewer } from '@/components/PhotoViewer'
import { api } from '@/lib/api'
import { useItemMap, usePlan, useToggleInterest } from '@/lib/data'
import { useMe, useOrderedCouples } from '@/lib/device'
import { itemEmoji, sections } from '@/lib/sections'
import type { Section } from '@/lib/types'
import { formatDay, hostLabel } from '@/lib/utils'
import { goingLabel, slotById, trip } from '@/trip.config'
import { useOpenSheet } from '../sheets'

export function ItemDetailSheet({ state, onClose }: { state: { section: Section; id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const section = last?.section ?? 'eats'
  const item = useItemMap(section).get(last?.id ?? '')
  const { data: plan = [] } = usePlan(section)
  const openSheet = useOpenSheet()
  const toggle = useToggleInterest(section)
  const me = useMe()
  const couples = useOrderedCouples(trip.couples)
  const [viewing, setViewing] = useState(false)

  if (!item) return <Sheet open={false} onClose={onClose} title="" children={null} />

  const slotOrder = sections[section].slots.map((s) => s.id as string)
  const entries = plan
    .filter((e) => e.item_id === item.id)
    .sort((a, b) => a.day.localeCompare(b.day) || slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot))

  return (
    <Sheet
      open={state !== null}
      onClose={onClose}
      title={item.name}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => openSheet({ kind: 'entry', section, draft: { item_id: item.id } })}>
            <CalendarPlus className="size-5" /> Add to plan
          </Button>
          <Button variant="outline" size="icon" className="size-12" aria-label="Edit" onClick={() => openSheet({ kind: 'form', section, id: item.id })}>
            <Pencil className="size-5" />
          </Button>
          <Button variant="danger" size="icon" className="size-12" aria-label="Delete" onClick={() => openSheet({ kind: 'delete', section, id: item.id })}>
            <Trash2 className="size-5" />
          </Button>
        </div>
      }
    >
      <button
        type="button"
        className="block w-full overflow-hidden rounded-3xl"
        onClick={() => item.cover_path && setViewing(true)}
        aria-label="View photo full screen"
      >
        <Cover of={item} emoji={itemEmoji(section, item)} className="aspect-[4/3] w-full" emojiClass="text-6xl" />
      </button>

      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        {item.category && (
          <span>
            {itemEmoji(section, item)} {item.category}
          </span>
        )}
        {item.area && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {item.area}
          </span>
        )}
      </p>

      {item.notes && <p className="mt-3 rounded-2xl bg-canvas p-3.5 text-[15px] whitespace-pre-wrap">{item.notes}</p>}

      {(item.maps_url || item.inspo_url) && (
        <div className="mt-3 flex gap-2">
          {item.maps_url && (
            <a href={item.maps_url} target="_blank" rel="noreferrer" className="flex-1">
              <Button variant="soft" size="sm" className="pointer-events-none w-full">
                <MapPin className="size-4" /> Open in Maps
              </Button>
            </a>
          )}
          {item.inspo_url && (
            <a href={item.inspo_url} target="_blank" rel="noreferrer" className="flex-1">
              <Button variant="outline" size="sm" className="pointer-events-none w-full">
                <ExternalLink className="size-4" /> {hostLabel(item.inspo_url)}
              </Button>
            </a>
          )}
        </div>
      )}

      <h3 className="mt-5 mb-2 text-sm font-semibold">Who wants to go</h3>
      <div className="flex gap-2">
        {couples.map((c) => (
          <CoupleToggle
            key={c.id}
            couple={c}
            labeled
            isMe={c.id === me}
            active={item.interested.includes(c.id)}
            onToggle={() => toggle.mutate({ item, couple: c.id })}
          />
        ))}
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold">In the plan</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Not scheduled yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => openSheet({ kind: 'entry', section, draft: e })}
                className="flex w-full items-center gap-3 rounded-2xl border border-line px-3.5 py-2.5 text-left text-sm active:bg-canvas"
              >
                <span className="text-lg">{slotById(e.slot)?.emoji}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{formatDay(e.day)}</span>
                  <span className="text-muted">
                    {slotById(e.slot)?.label}
                    {e.time && ` · ${e.time}`} · {goingLabel(e.going)}
                  </span>
                </span>
                <Pencil className="size-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PhotoViewer
        src={viewing && item.cover_path ? api.coverUrl(item.cover_path) : null}
        alt={item.name}
        onClose={() => setViewing(false)}
      />
    </Sheet>
  )
}
