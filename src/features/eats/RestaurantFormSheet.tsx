import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ClipboardPaste, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Autocomplete } from '@/components/Autocomplete'
import { CoupleToggle } from '@/components/CoupleToggle'
import { Button, Field, inputClass, Sheet, useSticky } from '@/components/ui'
import { api } from '@/lib/api'
import { useRestaurantMap, useRestaurants, useSaveRestaurant } from '@/lib/data'
import { useMe, useOrderedCouples } from '@/lib/device'
import { compressImage, imageFromClipboard, imageFromPaste } from '@/lib/image'
import type { Restaurant } from '@/lib/types'
import { trip, type CoupleId } from '@/trip.config'

type State = { id?: string; nonce: number }

export function RestaurantFormSheet({ state, onClose }: { state: State | null; onClose: () => void }) {
  const last = useSticky(state)
  const existing = useRestaurantMap().get(last?.id ?? '')
  return (
    <Sheet open={state !== null} onClose={onClose} title={existing ? 'Edit place' : 'Add a place'}>
      {last && <RestaurantForm key={last.nonce} existing={existing} active={state !== null} onDone={onClose} />}
    </Sheet>
  )
}

const withScheme = (url: string) => {
  const trimmed = url.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function RestaurantForm({ existing, active, onDone }: { existing?: Restaurant; active: boolean; onDone: () => void }) {
  const { data: all = [] } = useRestaurants()
  const save = useSaveRestaurant()
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
  const fileInput = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => unique(all.map((r) => r.category)), [all])
  const areas = useMemo(() => unique([...all.map((r) => r.area), ...trip.areas]), [all])

  const preview = useMemo(() => {
    if (cover) return URL.createObjectURL(cover)
    if (cover === undefined && existing?.cover_path) return api.coverUrl(existing.cover_path)
    return null
  }, [cover, existing?.cover_path])
  useEffect(() => () => void (preview?.startsWith('blob:') && URL.revokeObjectURL(preview)), [preview])

  async function takeImage(file: Blob | null) {
    if (!file) return
    setProcessing(true)
    try {
      setCover(await compressImage(file))
    } catch {
      toast.error("Couldn't read that image")
    } finally {
      setProcessing(false)
    }
  }

  // Pasting a screenshot anywhere while the form is open sets it as the cover.
  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const image = imageFromPaste(e)
      if (image) {
        e.preventDefault()
        void takeImage(image)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [active])

  async function pasteFromClipboard() {
    try {
      const image = await imageFromClipboard()
      if (image) await takeImage(image)
      else toast('No image on the clipboard')
    } catch {
      toast("Can't read the clipboard here — use Choose photo instead")
    }
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
      <div className="relative overflow-hidden rounded-3xl border border-dashed border-line">
        {preview ? (
          <>
            <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute right-3 bottom-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <ImagePlus className="size-4" /> Change
              </Button>
              <Button size="sm" variant="outline" aria-label="Remove photo" onClick={() => setCover(null)}>
                <X className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="aurora flex aspect-[5/3] flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <ImagePlus className="size-4" /> Choose photo
              </Button>
              <Button size="sm" variant="outline" onClick={pasteFromClipboard}>
                <ClipboardPaste className="size-4" /> Paste
              </Button>
            </div>
            <p className="text-xs text-ink/60">Tip: copy a screenshot, then tap Paste</p>
          </div>
        )}
        {processing && (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void takeImage(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </div>

      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sushi Zanmai" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Autocomplete value={category} onChange={setCategory} options={categories} placeholder="Sushi" />
        </Field>
        <Field label="Area">
          <Autocomplete value={area} onChange={setArea} options={areas} placeholder="Shinjuku" />
        </Field>
      </div>
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
          placeholder="All you can eat ¥5000, book 1 month ahead…"
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
        {existing ? 'Save changes' : 'Add place'}
      </Button>
    </form>
  )
}

function unique(values: string[]) {
  const seen = new Map<string, string>()
  for (const v of values) {
    const t = v.trim()
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
  }
  return [...seen.values()]
}
