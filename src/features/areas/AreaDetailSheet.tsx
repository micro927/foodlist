import { useState } from 'react'
import { ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react'
import { Button, Sheet, useSticky } from '@/components/ui'
import { Cover } from '@/components/Cover'
import { PhotoViewer } from '@/components/PhotoViewer'
import { api } from '@/lib/api'
import { useAreaMap } from '@/lib/data'
import { itemEmoji, sections } from '@/lib/sections'
import type { Item, Section } from '@/lib/types'
import { cn, hostLabel } from '@/lib/utils'
import { goodForById, trip } from '@/trip.config'
import { useOpenSheet } from '../sheets'
import { areaEmoji, useAreaItems } from './areaItems'

export function AreaDetailSheet({ state, onClose }: { state: { id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const area = useAreaMap().get(last?.id ?? '')
  const items = useAreaItems(area)
  const openSheet = useOpenSheet()
  const [viewing, setViewing] = useState(false)

  if (!area) return <Sheet open={false} onClose={onClose} title="" children={null} />

  return (
    <Sheet
      open={state !== null}
      onClose={onClose}
      title={area.name}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => openSheet({ kind: 'areaForm', id: area.id })}>
            <Pencil className="size-5" /> Edit area
          </Button>
          <Button variant="danger" size="icon" className="size-12" aria-label="Delete" onClick={() => openSheet({ kind: 'areaDelete', id: area.id })}>
            <Trash2 className="size-5" />
          </Button>
        </div>
      }
    >
      <button
        type="button"
        className="block w-full overflow-hidden rounded-3xl"
        onClick={() => area.cover_path && setViewing(true)}
        aria-label="View photo full screen"
      >
        <Cover of={area} emoji={areaEmoji} className="aspect-[4/3] w-full" emojiClass="text-6xl" />
      </button>

      {area.good_for.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {area.good_for.map((id) => {
            const g = goodForById(id)
            return (
              g && (
                <span key={id} className="inline-flex h-8 items-center gap-1 rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary">
                  {g.emoji} {g.label}
                </span>
              )
            )
          })}
        </div>
      )}

      {area.notes && <p className="mt-3 rounded-2xl bg-canvas p-3.5 text-[15px] whitespace-pre-wrap">{area.notes}</p>}

      {(area.maps_url || area.inspo_urls.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {area.maps_url && (
            <a href={area.maps_url} target="_blank" rel="noreferrer" className={cn(area.inspo_urls.length % 2 === 0 && 'col-span-2')}>
              <Button variant="soft" size="sm" className="pointer-events-none w-full">
                <MapPin className="size-4" /> Open in Maps
              </Button>
            </a>
          )}
          {area.inspo_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="pointer-events-none w-full">
                <ExternalLink className="size-4" /> {hostLabel(url)}
              </Button>
            </a>
          ))}
        </div>
      )}

      <ItemStrip section="eats" items={items.eats} />
      <ItemStrip section="places" items={items.places} />

      <PhotoViewer
        src={viewing && area.cover_path ? api.coverUrl(area.cover_path) : null}
        alt={area.name}
        onClose={() => setViewing(false)}
      />
    </Sheet>
  )
}

/** The area's restaurants or places; tapping one opens its own sheet. */
function ItemStrip({ section, items }: { section: Section; items: Item[] }) {
  const openSheet = useOpenSheet()
  const meta = sections[section]
  return (
    <>
      <h3 className="mt-5 mb-2 text-sm font-semibold">
        {meta.title} {items.length > 0 && <span className="font-normal text-muted">{items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No {meta.nouns} added yet.</p>
      ) : (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {items.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openSheet({ kind: 'detail', section, id: r.id })}
              className="flex w-28 shrink-0 flex-col text-left active:scale-[0.97]"
            >
              <Cover of={r} emoji={itemEmoji(section, r)} className="aspect-square w-full rounded-2xl" emojiClass="text-3xl" />
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
    </>
  )
}
