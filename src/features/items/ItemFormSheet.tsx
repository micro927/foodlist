import { useMemo, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Autocomplete } from '@/components/Autocomplete'
import { CoupleToggle } from '@/components/CoupleToggle'
import { CoverPicker } from '@/components/CoverPicker'
import { Button, Chip, Field, inputClass, Sheet, useSticky } from '@/components/ui'
import { useItemMap, useItems, useSaveItem } from '@/lib/data'
import { useMe, useOrderedCouples } from '@/lib/device'
import { sections } from '@/lib/sections'
import type { Item, Section } from '@/lib/types'
import { unique, withScheme } from '@/lib/utils'
import { trip, type CoupleId } from '@/trip.config'

type State = { section: Section; id?: string; nonce: number }

export function ItemFormSheet({ state, onClose }: { state: State | null; onClose: () => void }) {
  const last = useSticky(state)
  const section = last?.section ?? 'eats'
  const existing = useItemMap(section).get(last?.id ?? '')
  const noun = sections[section].noun
  return (
    <Sheet open={state !== null} onClose={onClose} title={existing ? `Edit ${noun}` : `Add a ${noun}`}>
      {last && <ItemForm key={last.nonce} section={section} existing={existing} active={state !== null} onDone={onClose} />}
    </Sheet>
  )
}

function ItemForm({ section, existing, active, onDone }: { section: Section; existing?: Item; active: boolean; onDone: () => void }) {
  const meta = sections[section]
  const { data: all = [] } = useItems(section)
  const save = useSaveItem(section)
  const me = useMe()
  const couples = useOrderedCouples(trip.couples)

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [area, setArea] = useState(existing?.area ?? '')
  const [mapsUrl, setMapsUrl] = useState(existing?.maps_url ?? '')
  const [inspoUrl, setInspoUrl] = useState(existing?.inspo_url ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [interested, setInterested] = useState<CoupleId[]>(existing?.interested ?? (me ? [me] : []))
  // undefined = keep current cover, null = remove it, Blob = new photo
  const [cover, setCover] = useState<Blob | null | undefined>(undefined)
  const [processing, setProcessing] = useState(false)

  const categories = useMemo(() => unique(all.map((r) => r.category)), [all])
  const areas = useMemo(() => unique([...all.map((r) => r.area), ...trip.areas]), [all])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Give it a name')
    save.mutate(
      {
        existing,
        cover,
        fields: {
          name: name.trim(),
          category: category.trim(),
          area: area.trim(),
          maps_url: withScheme(mapsUrl),
          inspo_url: withScheme(inspoUrl),
          notes: notes.trim() || null,
          interested,
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
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={meta.placeholders.name} required />
      </Field>
      {meta.categories ? (
        <>
          <div>
            <span className="mb-1.5 block text-sm font-semibold">Category</span>
            <div className="flex flex-wrap gap-1.5">
              {meta.categories.map((c) => {
                const active = category.toLowerCase() === c.label.toLowerCase()
                return (
                  <Chip key={c.label} active={active} onClick={() => setCategory(active ? '' : c.label)}>
                    {c.emoji} {c.label}
                  </Chip>
                )
              })}
            </div>
          </div>
          <Field label="Area">
            <Autocomplete value={area} onChange={setArea} options={areas} placeholder="Shinjuku" />
          </Field>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Autocomplete value={category} onChange={setCategory} options={categories} placeholder={meta.placeholders.category} />
          </Field>
          <Field label="Area">
            <Autocomplete value={area} onChange={setArea} options={areas} placeholder="Shinjuku" />
          </Field>
        </div>
      )}
      <Field label="Google Maps link">
        <input className={inputClass} value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} inputMode="url" placeholder="https://maps.app.goo.gl/…" />
      </Field>
      <Field label="Inspiration link" hint="TikTok, YouTube, IG…">
        <input className={inputClass} value={inspoUrl} onChange={(e) => setInspoUrl(e.target.value)} inputMode="url" placeholder="https://www.tiktok.com/…" />
      </Field>
      <Field label="Notes">
        <textarea
          className={`${inputClass} h-24 resize-none py-3`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={meta.placeholders.notes}
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold">Who wants to go</span>
        <div className="flex gap-2">
          {couples.map((c) => (
            <CoupleToggle
              key={c.id}
              couple={c}
              labeled
              isMe={c.id === me}
              active={interested.includes(c.id)}
              onToggle={() => setInterested((list) => (list.includes(c.id) ? list.filter((x) => x !== c.id) : [...list, c.id]))}
            />
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={save.isPending || processing}>
        {save.isPending && <Loader2 className="size-5 animate-spin" />}
        {existing ? 'Save changes' : `Add ${meta.noun}`}
      </Button>
    </form>
  )
}
