import { useMemo, useState, type FormEvent } from 'react'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Cover } from '@/components/Cover'
import { CoverPicker } from '@/components/CoverPicker'
import { Button, Chip, Field, inputClass, Sheet, useSticky } from '@/components/ui'
import { useAreaMap, useItemMap, useItems, useSaveArea } from '@/lib/data'
import { useBackHandler } from '@/lib/back'
import { itemEmoji, sections } from '@/lib/sections'
import type { Area, Section } from '@/lib/types'
import { cn, withScheme } from '@/lib/utils'
import { trip, type GoodForId } from '@/trip.config'

type State = { id?: string; nonce: number }

export function AreaFormSheet({ state, onClose }: { state: State | null; onClose: () => void }) {
  const last = useSticky(state)
  const existing = useAreaMap().get(last?.id ?? '')
  // Which list is being picked from, for this opening of the sheet only.
  const [pick, setPick] = useState<{ nonce: number; section: Section } | null>(null)
  const picking = pick && pick.nonce === last?.nonce ? pick.section : null
  const setPicking = (section: Section | null) => last && setPick(section ? { nonce: last.nonce, section } : null)
  // Back from the picker returns to the form instead of closing it.
  useBackHandler(state !== null && picking !== null, () => setPicking(null))

  return (
    <Sheet
      open={state !== null}
      onClose={onClose}
      title={picking ? `Add ${sections[picking].nouns}` : existing ? 'Edit area' : 'Add an area'}
    >
      {last && (
        <AreaForm key={last.nonce} existing={existing} active={state !== null} picking={picking} setPicking={setPicking} onDone={onClose} />
      )}
    </Sheet>
  )
}

function AreaForm({
  existing,
  active,
  picking,
  setPicking,
  onDone,
}: {
  existing?: Area
  active: boolean
  picking: Section | null
  setPicking: (s: Section | null) => void
  onDone: () => void
}) {
  const save = useSaveArea()
  const restaurants = useItems('eats')
  const places = useItems('places')

  const [name, setName] = useState(existing?.name ?? '')
  const [mapsUrl, setMapsUrl] = useState(existing?.maps_url ?? '')
  const [goodFor, setGoodFor] = useState<GoodForId[]>(existing?.good_for ?? [])
  const [inspoUrls, setInspoUrls] = useState<string[]>(existing?.inspo_urls.length ? existing.inspo_urls : [''])
  const [picked, setPicked] = useState<Record<Section, string[]>>({
    eats: existing?.restaurant_ids ?? [],
    places: existing?.place_ids ?? [],
  })
  const [notes, setNotes] = useState(existing?.notes ?? '')
  // undefined = keep current cover, null = remove it, Blob = new photo
  const [cover, setCover] = useState<Blob | null | undefined>(undefined)
  const [processing, setProcessing] = useState(false)

  const toggleGoodFor = (id: GoodForId) => setGoodFor((list) => (list.includes(id) ? list.filter((g) => g !== id) : [...list, id]))
  const togglePicked = (section: Section, id: string) =>
    setPicked((p) => ({ ...p, [section]: p[section].includes(id) ? p[section].filter((x) => x !== id) : [...p[section], id] }))

  // Ids of deleted restaurants or places are dropped on save — but only once their list has loaded.
  const existingIds = (section: Section) => {
    const list = (section === 'eats' ? restaurants : places).data
    return list ? picked[section].filter((id) => list.some((r) => r.id === id)) : picked[section]
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Give it a name')
    save.mutate(
      {
        existing,
        cover,
        fields: {
          name: name.trim(),
          maps_url: withScheme(mapsUrl),
          good_for: trip.goodFor.map((g) => g.id).filter((id) => goodFor.includes(id)),
          inspo_urls: inspoUrls.flatMap((u) => withScheme(u) ?? []),
          restaurant_ids: existingIds('eats'),
          place_ids: existingIds('places'),
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(existing ? 'Saved' : `${name.trim()} added`)
          onDone()
        },
      },
    )
  }

  if (picking) {
    return (
      <MultiPicker
        section={picking}
        areaName={name}
        selected={picked[picking]}
        onToggle={(id) => togglePicked(picking, id)}
        onDone={() => setPicking(null)}
      />
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CoverPicker
        cover={cover}
        existingPath={existing?.cover_path}
        onChange={setCover}
        processing={processing}
        setProcessing={setProcessing}
        active={active}
      />

      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shibuya" required />
      </Field>
      <Field label="Google Maps link">
        <input className={inputClass} value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} inputMode="url" placeholder="https://maps.app.goo.gl/…" />
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">Good for</span>
        <div className="flex flex-wrap gap-1.5">
          {trip.goodFor.map((g) => (
            <Chip key={g.id} active={goodFor.includes(g.id)} onClick={() => toggleGoodFor(g.id)}>
              {g.emoji} {g.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
          Inspiration links
          <span className="text-xs font-normal text-muted">TikTok, YouTube, IG…</span>
        </span>
        <div className="space-y-2">
          {inspoUrls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={cn(inputClass, 'flex-1')}
                value={url}
                onChange={(e) => setInspoUrls((list) => list.map((u, j) => (j === i ? e.target.value : u)))}
                inputMode="url"
                placeholder="https://www.tiktok.com/…"
              />
              {(inspoUrls.length > 1 || url) && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-12"
                  aria-label="Remove link"
                  onClick={() => setInspoUrls((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : ['']))}
                >
                  <X className="size-5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-1.5 -ml-2" onClick={() => setInspoUrls((list) => [...list, ''])}>
          <Plus className="size-4" /> Add link
        </Button>
      </div>

      <PickedList section="eats" ids={picked.eats} onRemove={(id) => togglePicked('eats', id)} onAdd={() => setPicking('eats')} />
      <PickedList section="places" ids={picked.places} onRemove={(id) => togglePicked('places', id)} onAdd={() => setPicking('places')} />

      <Field label="Notes">
        <textarea
          className={`${inputClass} h-24 resize-none py-3`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Best at night, lots of vintage shops…"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={save.isPending || processing}>
        {save.isPending && <Loader2 className="size-5 animate-spin" />}
        {existing ? 'Save changes' : 'Add area'}
      </Button>
    </form>
  )
}

/** The restaurants or places picked so far, as removable chips. */
function PickedList({ section, ids, onRemove, onAdd }: { section: Section; ids: string[]; onRemove: (id: string) => void; onAdd: () => void }) {
  const meta = sections[section]
  const map = useItemMap(section)
  const items = ids.flatMap((id) => map.get(id) ?? [])
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold">{meta.title}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((r) => (
          <span key={r.id} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface pr-1 pl-1">
            <Cover of={r} emoji={itemEmoji(section, r)} className="size-7 shrink-0 rounded-full" emojiClass="text-sm" />
            <span className="truncate text-sm font-medium">{r.name}</span>
            <button type="button" aria-label={`Remove ${r.name}`} onClick={() => onRemove(r.id)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted active:bg-canvas">
              <X className="size-4" />
            </button>
          </span>
        ))}
        <Chip onClick={onAdd} className="border-dashed text-muted">
          <Plus className="size-4" /> Add {meta.nouns}
        </Chip>
      </div>
    </div>
  )
}

/** Tick any number of restaurants or places. Ones whose area text matches this area's name come first. */
function MultiPicker({
  section,
  areaName,
  selected,
  onToggle,
  onDone,
}: {
  section: Section
  areaName: string
  selected: string[]
  onToggle: (id: string) => void
  onDone: () => void
}) {
  const meta = sections[section]
  const { data: all = [] } = useItems(section)
  const [query, setQuery] = useState('')
  const here = areaName.trim().toLowerCase()

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inArea = (area: string) => !!here && area.trim().toLowerCase() === here
    return all
      .filter((r) => !q || [r.name, r.category, r.area].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => Number(inArea(b.area)) - Number(inArea(a.area)) || a.name.localeCompare(b.name))
  }, [all, query, here])

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input className={cn(inputClass, 'pl-10')} placeholder={`Search ${meta.nouns}`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          No {meta.nouns} yet — add some in {meta.title} first.
        </p>
      )}
      <ul className="space-y-1 pb-3">
        {list.map((r) => {
          const on = selected.includes(r.id)
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(r.id)}
                className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition', on ? 'bg-primary-soft' : 'active:bg-canvas')}
              >
                <Cover of={r} emoji={itemEmoji(section, r)} className="size-12 shrink-0 rounded-xl" emojiClass="text-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-sm text-muted">{[r.category, r.area].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full border-2',
                    on ? 'border-primary bg-primary text-white' : 'border-line',
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pt-3">
        <Button className="w-full" onClick={onDone}>
          Done{selected.length > 0 && ` · ${selected.length} picked`}
        </Button>
      </div>
    </div>
  )
}
