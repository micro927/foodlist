import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CalendarDays, Camera, Check, Loader2, Plus, ScanText, SlidersHorizontal, Split, Trash2, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, ConfirmDialog, Field, inputClass, Screen, TimePicker, useSticky } from '@/components/ui'
import { api } from '@/lib/api'
import { useBills, useSaveBill } from '@/lib/data'
import { compressImage } from '@/lib/image'
import type { Bill, BillLine } from '@/lib/types'
import { cn, todayIso, tripDays } from '@/lib/utils'
import { personById, personIds, trip, type PersonId } from '@/trip.config'
import { AmountField, KeypadSlot, KeypadSlots } from '@/components/keypad'
import { Money, PersonChip, PersonDot } from './parts'
import { scanReceipt } from './scan'
import { customLeft, isDraft, lineProblem, lineSum, paidSharesChanged, shares, yen } from './split'

export type BillStep = 'details' | 'lines' | 'split'
type State = { id?: string; step?: BillStep; nonce: number }

const MAX_PHOTOS = 3
const steps: { id: BillStep; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'lines', label: 'Items' },
  { id: 'split', label: 'Who ate what' },
]

export function BillFormSheet({ state, onClose }: { state: State | null; onClose: () => void }) {
  const last = useSticky(state)
  const existing = useBills().data?.find((b) => b.id === last?.id)
  const ready = last && (!last.id || existing)
  // A full Screen, not a Sheet: a bill takes a while to fill in and a stray swipe mustn't lose it.
  const dirty = useRef(false)
  const onDirty = useCallback((d: boolean) => {
    dirty.current = d
  }, [])
  const [asking, setAsking] = useState(false)
  const close = () => (dirty.current ? setAsking(true) : onClose())
  return (
    <>
      <Screen open={state !== null} onClose={close} title={last?.id ? 'Edit bill' : 'New bill'}>
        {ready && <BillForm key={last.nonce} existing={existing} initialStep={last.step} onDirty={onDirty} onDone={onClose} />}
      </Screen>
      <ConfirmDialog
        open={asking}
        title={last?.id ? 'Discard your changes?' : 'Discard this bill?'}
        message={last?.id ? "Your edits to this bill won't be saved." : 'Everything you added will be lost.'}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false)
          onClose()
        }}
      />
    </>
  )
}

const nowTime = () => new Date().toTimeString().slice(0, 5)

const resize = (units: PersonId[][], qty: number) =>
  Array.from({ length: Math.max(qty, 1) }, (_, i) => units[i] ?? [])

const newLine = (fields: Partial<BillLine> = {}): BillLine => {
  const qty = Math.max(1, fields.qty ?? 1)
  return { id: crypto.randomUUID(), name_en: '', name_ja: '', price: 0, extra: false, custom: null, ...fields, qty, units: resize(fields.units ?? [], qty) }
}

/** Splits `price` evenly in whole yen; the first people take the leftover yen. */
const evenly = (price: number, people: PersonId[]) =>
  Object.fromEntries(people.map((p, i) => [p, Math.floor(price / people.length) + (i < price % people.length ? 1 : 0)]))

function BillForm({
  existing,
  initialStep,
  onDirty,
  onDone,
}: {
  existing?: Bill
  initialStep?: BillStep
  onDirty: (dirty: boolean) => void
  onDone: () => void
}) {
  const save = useSaveBill()
  const [id] = useState(() => existing?.id ?? crypto.randomUUID())
  const [step, setStep] = useState<BillStep>(initialStep ?? 'details')
  const [shop, setShop] = useState(existing?.shop ?? '')
  const [day, setDay] = useState(existing?.day ?? todayIso())
  const [time, setTime] = useState(existing?.time ?? nowTime())
  const [payer, setPayer] = useState<PersonId>(existing?.payer ?? personIds[0])
  const [sharing, setSharing] = useState<PersonId[]>(existing?.sharing ?? [...personIds])
  const [lines, setLines] = useState<BillLine[]>(existing?.lines ?? [])
  const [receiptTotal, setReceiptTotal] = useState<number | null>(existing?.receipt_total ?? null)
  const [keep, setKeep] = useState<string[]>(existing?.photo_paths ?? [])
  const [added, setAdded] = useState<Blob[]>([])
  const [processing, setProcessing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const top = useRef<HTMLDivElement>(null)

  const snapshot = JSON.stringify({ shop, day, time, payer, sharing, lines, receiptTotal, keep, added: added.length })
  const [initialSnapshot] = useState(snapshot)
  const dirty = snapshot !== initialSnapshot
  useEffect(() => onDirty(dirty), [dirty, onDirty])

  const draftBill = { lines, sharing, payer }
  const draft = isDraft(draftBill)
  const unpaidAgain = existing ? paidSharesChanged(existing, draftBill) : []

  // Amounts giving out more than an item costs can't be saved, not even as a Draft.
  const total = lineSum(lines)
  const over = lines.find((l) => customLeft(l) < 0)
  const left = lines.reduce((sum, l) => sum + Math.max(0, customLeft(l)), 0)
  const status = over
    ? { text: `${over.name_en || over.name_ja || 'Item'} ${yen(-customLeft(over))} too much`, bad: true }
    : receiptTotal !== null && receiptTotal !== total
      ? { text: `Off by ${yen(Math.abs(receiptTotal - total))} vs receipt`, bad: false }
      : step === 'split' && left > 0
        ? { text: `${yen(left)} left to give out`, bad: false }
        : null

  const updateLine = (lineId: string, patch: Partial<BillLine>) =>
    setLines((ls) => ls.map((l) => (l.id === lineId ? { ...l, ...patch, units: resize(patch.units ?? l.units, patch.qty ?? l.qty) } : l)))

  const toggleSharing = (p: PersonId) => {
    const next = sharing.includes(p) ? sharing.filter((x) => x !== p) : personIds.filter((x) => x === p || sharing.includes(x))
    if (next.length === 0) return
    setSharing(next)
    // Someone who isn't Sharing can't have eaten anything.
    setLines((ls) =>
      ls.map((l) => ({
        ...l,
        units: l.units.map((u) => u.filter((x) => next.includes(x))),
        custom: l.custom ? Object.fromEntries(Object.entries(l.custom).filter(([x]) => next.includes(x as PersonId))) : null,
      })),
    )
  }

  const goTo = (s: BillStep) => {
    setStep(s)
    top.current?.scrollIntoView({ block: 'start' })
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return
    setProcessing(true)
    try {
      // Bigger than covers so small receipt print stays readable.
      const blob = await compressImage(file, 2000, 0.85)
      setAdded((list) => [...list, blob])
    } catch {
      toast.error("Couldn't read that image")
    } finally {
      setProcessing(false)
    }
  }

  async function scan() {
    setScanning(true)
    try {
      const result = await scanReceipt(added)
      setShop((s) => s || result.shop)
      setLines(result.lines.map((l) => newLine(l)))
      setReceiptTotal(result.total)
      toast.success(`Read ${result.lines.length} items — check them against the receipt`)
      goTo('lines')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't scan")
    } finally {
      setScanning(false)
    }
  }

  function submit() {
    if (!shop.trim()) {
      goTo('details')
      return toast.error('Give the bill a shop name')
    }
    save.mutate(
      {
        id,
        existing,
        photos: { keep, add: added },
        fields: {
          shop: shop.trim(),
          day,
          time,
          payer,
          sharing,
          lines: lines.map((l) => (l.extra ? { ...l, units: resize([], l.qty), custom: null } : l)),
          receipt_total: receiptTotal,
          // Paid marks belong to the old Payer, so a new Payer starts from nothing paid.
          paid: existing && existing.payer === payer ? existing.paid : {},
        },
      },
      {
        onSuccess: () => {
          toast.success(isDraft(draftBill) ? 'Saved — finish splitting later' : existing ? 'Bill saved' : 'Bill added')
          onDone()
        },
      },
    )
  }

  const index = steps.findIndex((s) => s.id === step)

  return (
    // Fills the Screen so the footer sits at the bottom even when a step is short.
    <div ref={top} className="flex min-h-full scroll-mt-20 flex-col">
      <KeypadSlots>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              className={cn(
                'h-9 rounded-full text-xs font-semibold transition',
                s.id === step ? 'bg-primary text-white' : i < index ? 'bg-primary-soft text-primary' : 'bg-canvas text-muted',
              )}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {step === 'details' && (
          <div className="space-y-4">
            <Photos keep={keep} added={added} processing={processing} onAdd={addPhoto} onRemoveKept={(p) => setKeep((k) => k.filter((x) => x !== p))} onRemoveAdded={(i) => setAdded((a) => a.filter((_, j) => j !== i))} />
            <div>
              <Button variant="soft" className="w-full" disabled={added.length === 0 || scanning || processing} onClick={scan}>
                {scanning ? <Loader2 className="size-5 animate-spin" /> : <ScanText className="size-5" />}
                {scanning ? 'Reading the receipt…' : lines.length ? 'Scan again (replaces items)' : 'Scan receipt'}
              </Button>
              <p className="mt-1.5 text-center text-xs text-muted">Reads the photo into items and translates them — or skip and add items by hand.</p>
            </div>

            <Field label="Shop">
              <input className={inputClass} value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. Torikizoku" />
            </Field>
            <DayPicker value={day} onChange={setDay} />
            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Time</h3>
              <TimePicker value={time} onChange={setTime} />
            </section>
            <div>
              <span className="mb-1.5 block text-sm font-semibold">Paid by</span>
              <div className="grid grid-cols-4 gap-1.5">
                {trip.people.map((p) => (
                  <PersonChip key={p.id} id={p.id} active={payer === p.id} onClick={() => setPayer(p.id)} />
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-semibold">Sharing</span>
              <div className="grid grid-cols-4 gap-1.5">
                {trip.people.map((p) => (
                  <PersonChip key={p.id} id={p.id} active={sharing.includes(p.id)} onClick={() => toggleSharing(p.id)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'lines' && (
          <div className="space-y-2">
            {lines.length === 0 && (
              <p className="px-1 pb-1 text-sm text-muted">
                Everything on the receipt, one row each — e.g. <span className="font-semibold text-ink">Draft beer ×6 ¥3,300</span>. Scan a photo on step 1 to fill this in, or add them by hand.
              </p>
            )}
            {lines
              .filter((l) => !l.extra)
              .map((l) => (
                <LineEditor key={l.id} line={l} onChange={(patch) => updateLine(l.id, patch)} onDelete={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} />
              ))}
            <AddLine onClick={() => setLines((ls) => [...ls, newLine()])}>Add item</AddLine>

            {/* Extras live apart from what was eaten: nobody picks who had them, they're spread by what each ate. */}
            <div className="pt-3">
              {lines.some((l) => l.extra) && (
                <div className="mb-2 px-1">
                  <h3 className="text-sm font-semibold">Tax, service & discounts</h3>
                  <p className="text-xs text-muted">Spread over people by what each ate.</p>
                </div>
              )}
              <div className="space-y-2">
                {lines
                  .filter((l) => l.extra)
                  .map((l) => (
                    <ExtraEditor key={l.id} line={l} onChange={(patch) => updateLine(l.id, patch)} onDelete={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} />
                  ))}
                <AddLine onClick={() => setLines((ls) => [...ls, newLine({ extra: true })])}>Add tax, service or discount</AddLine>
              </div>
            </div>
            <Totals lines={lines} receiptTotal={receiptTotal} onReceiptTotal={setReceiptTotal} />
          </div>
        )}

        {step === 'split' && (
          <div className="space-y-3">
            {lines.some((l) => !l.extra) ? (
              <p className="px-1 text-sm text-muted">Tap who had each one. Tap more than one person to share it.</p>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Add some items first.</p>
            )}
            {lines
              .filter((l) => !l.extra)
              .map((l) => (
                <SplitLine key={l.id} line={l} sharing={sharing} onChange={(patch) => updateLine(l.id, patch)} />
              ))}
            {lines.some((l) => l.extra) && (
              <div className="rounded-2xl bg-canvas p-3.5 text-sm">
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Added on top</p>
                {lines
                  .filter((l) => l.extra)
                  .map((l) => (
                    <p key={l.id} className="flex justify-between">
                      <span>{l.name_en || l.name_ja || 'Extra'}</span> <Money amount={l.price} />
                    </p>
                  ))}
                <p className="mt-1 text-xs text-muted">Spread over people by what each ate.</p>
              </div>
            )}
            <SharesPreview lines={lines} sharing={sharing} payer={payer} draft={draft} />
          </div>
        )}

        <div className="flex-1" />
        <div className="sticky -bottom-5 -mx-5 mt-5 -mb-5 border-t border-line bg-surface px-5 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          {unpaidAgain.length > 0 && (
            <p className="mb-2 text-xs text-amber-700 in-data-keypad-open:hidden">
              {unpaidAgain.map((p) => personById(p)?.name).join(', ')} had paid back — {unpaidAgain.length === 1 ? 'their share changes and goes' : 'their shares change and go'} back to unpaid.
            </p>
          )}
          {/* The total stays in sight on every step, with whatever doesn't add up beside it. */}
          {lines.length > 0 && (
            <div className="mb-2 flex items-baseline gap-2 text-sm">
              <span className="text-muted">Total</span>
              <Money amount={total} className="font-semibold" />
              {status && (
                <span className={cn('min-w-0 flex-1 truncate text-right text-xs font-medium', status.bad ? 'text-red-600' : 'text-amber-700')}>{status.text}</span>
              )}
            </div>
          )}
          {/* While an amount is being typed, its keypad takes the buttons' place. */}
          <KeypadSlot />
          <div className="flex gap-2 in-data-keypad-open:hidden">
            {index > 0 && (
              <Button variant="outline" className="h-11" onClick={() => goTo(steps[index - 1].id)}>
                Back
              </Button>
            )}
            {step !== 'split' && (
              <Button variant="outline" className="h-11" disabled={save.isPending || processing || !!over} onClick={submit}>
                {draft ? 'Save draft' : 'Save'}
              </Button>
            )}
            <Button
              className="h-11 flex-1"
              disabled={save.isPending || processing || scanning || (step === 'split' && !!over)}
              onClick={step === 'split' ? submit : () => goTo(steps[index + 1].id)}
            >
              {save.isPending && <Loader2 className="size-5 animate-spin" />}
              {step === 'split' ? (draft ? 'Save draft' : 'Save bill') : 'Next'}
            </Button>
          </div>
        </div>
      </KeypadSlots>
    </div>
  )
}

const chipParts = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' })
  return { weekday: part({ weekday: 'short' }), day: part({ day: 'numeric' }), month: part({ month: 'short' }) }
}

/** The trip's days as chips (like the Plan), plus the chosen day if it's outside the trip, and "Other" for any date. */
function DayPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const strip = useRef<HTMLDivElement>(null)
  const days = [...new Set([...tripDays.map((d) => d.date), value])].sort()
  useEffect(() => {
    strip.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [value])

  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold">Date</h3>
      <div ref={strip} className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
        {days.map((iso) => {
          const { weekday, day, month } = chipParts(iso)
          const selected = iso === value
          return (
            <button
              key={iso}
              type="button"
              data-selected={selected}
              onClick={() => onChange(iso)}
              className={cn(
                'flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-xs transition',
                selected ? 'border-primary bg-primary text-white' : 'border-line bg-surface',
                iso === todayIso() && !selected && 'border-primary text-primary',
              )}
            >
              <span className={cn(selected ? 'text-white/80' : 'text-muted')}>{weekday}</span>
              <span className="text-sm font-bold">{day}</span>
              <span className={cn(selected ? 'text-white/80' : 'text-muted')}>{month}</span>
            </button>
          )
        })}
        {/* A transparent native date input over the chip, so tapping it opens the phone's own calendar. */}
        <label className="relative flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-line text-xs text-muted">
          <CalendarDays className="size-5" />
          Other
          <input
            type="date"
            aria-label="Pick another date"
            className="absolute inset-0 opacity-0"
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
        </label>
      </div>
    </section>
  )
}

function Photos({
  keep,
  added,
  processing,
  onAdd,
  onRemoveKept,
  onRemoveAdded,
}: {
  keep: string[]
  added: Blob[]
  processing: boolean
  onAdd: (file: File | undefined) => void
  onRemoveKept: (path: string) => void
  onRemoveAdded: (index: number) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const urls = useMemo(() => added.map((b) => URL.createObjectURL(b)), [added])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  const tiles = [
    ...keep.map((p) => ({ key: p, src: api.coverUrl(p), remove: () => onRemoveKept(p) })),
    ...urls.map((u, i) => ({ key: u, src: u, remove: () => onRemoveAdded(i) })),
  ]

  return (
    <div className="flex gap-2">
      {tiles.map((t) => (
        <div key={t.key} className="relative">
          <img src={t.src} alt="Receipt" className="h-28 w-22 rounded-2xl border border-line object-cover" />
          <button type="button" aria-label="Remove photo" onClick={t.remove} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {tiles.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="aurora flex h-28 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-sm font-semibold"
        >
          {processing ? <Loader2 className="size-6 animate-spin text-primary" /> : <Camera className="size-6" />}
          {tiles.length ? 'Another photo' : 'Photo of the receipt'}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onAdd(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

function LineEditor({ line, onChange, onDelete }: { line: BillLine; onChange: (patch: Partial<BillLine>) => void; onDelete: () => void }) {
  return (
    <div className="space-y-2 rounded-2xl border border-line p-3">
      <div className="flex gap-2">
        <input className={cn(inputClass, 'h-11 flex-1')} value={line.name_en} onChange={(e) => onChange({ name_en: e.target.value })} placeholder="Item" />
        <Button variant="ghost" size="icon" className="size-11" aria-label="Delete item" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {line.name_ja && <p className="px-1 text-xs text-muted">{line.name_ja}</p>}
      <div className="flex items-center gap-2">
        <div className="w-16 shrink-0">
          <AmountField
            label="Quantity"
            prefix="×"
            placeholder="1"
            className="h-11"
            value={line.qty}
            onChange={(n) => onChange({ qty: Math.min(99, Math.max(1, n ?? 1)) })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <AmountField label="Price for all of them" className="h-11" value={line.price || null} onChange={(n) => onChange({ price: n ?? 0 })} />
        </div>
      </div>
      {line.qty > 1 && line.price !== 0 && <p className="px-1 text-xs text-muted">{yen(Math.round(line.price / line.qty))} each</p>}
    </div>
  )
}

/** Tax, a service charge or a discount: a name, which way it goes and how much. */
function ExtraEditor({ line, onChange, onDelete }: { line: BillLine; onChange: (patch: Partial<BillLine>) => void; onDelete: () => void }) {
  // Kept apart from the price, which can't say "discount" while it's still 0.
  const [discount, setDiscount] = useState(line.price < 0)
  const flip = (to: boolean) => {
    setDiscount(to)
    onChange({ price: Math.abs(line.price) * (to ? -1 : 1) })
  }
  return (
    <div className="space-y-2 rounded-2xl border border-line p-3">
      <div className="flex gap-2">
        <input className={cn(inputClass, 'h-11 flex-1')} value={line.name_en} onChange={(e) => onChange({ name_en: e.target.value })} placeholder="e.g. Service charge" />
        <Button variant="ghost" size="icon" className="size-11" aria-label="Delete" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {line.name_ja && <p className="px-1 text-xs text-muted">{line.name_ja}</p>}
      <div className="flex items-center gap-2">
        <div className="flex h-11 shrink-0 rounded-2xl bg-canvas p-1 ring-1 ring-line">
          {[false, true].map((d) => (
            <button
              key={String(d)}
              type="button"
              aria-pressed={discount === d}
              onClick={() => flip(d)}
              className={cn('rounded-xl px-3 text-sm font-semibold transition', discount === d ? 'bg-surface text-ink shadow-sm' : 'text-muted')}
            >
              {d ? 'Discount' : 'Charge'}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <AmountField
            label={discount ? 'Discount' : 'Charge'}
            prefix={discount ? '−¥' : '+¥'}
            className="h-11"
            value={Math.abs(line.price) || null}
            onChange={(n) => onChange({ price: (n ?? 0) * (discount ? -1 : 1) })}
          />
        </div>
      </div>
    </div>
  )
}

function AddLine({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-muted active:bg-canvas"
    >
      <Plus className="size-4" /> {children}
    </button>
  )
}

function Totals({ lines, receiptTotal, onReceiptTotal }: { lines: BillLine[]; receiptTotal: number | null; onReceiptTotal: (v: number | null) => void }) {
  const total = lineSum(lines)
  const off = receiptTotal !== null && receiptTotal !== total
  return (
    <div className="space-y-2 rounded-2xl bg-canvas p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Items add up to</span>
        <Money amount={total} className="font-semibold" />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Receipt total</span>
        <div className="w-36">
          <AmountField label="Receipt total" className="h-10 text-right" placeholder="optional" value={receiptTotal} onChange={onReceiptTotal} />
        </div>
      </div>
      {off && <p className="text-xs text-amber-700">Off by {yen(Math.abs(receiptTotal - total))} — check for a missing item, tax or discount.</p>}
    </div>
  )
}

function SplitLine({ line, sharing, onChange }: { line: BillLine; sharing: PersonId[]; onChange: (patch: Partial<BillLine>) => void }) {
  const problem = lineProblem(line)
  const eaters = line.custom ? (Object.keys(line.custom) as PersonId[]) : []
  const amountsLeft = customLeft(line)
  const notGiven = line.units.filter((u) => u.length === 0).length

  // When every Unit went to the same People, one row stands for all of them (Skewers ×4, everyone).
  const [perUnit, setPerUnit] = useState(false)
  const first = line.units[0] ?? []
  const allSame = first.length > 0 && line.units.every((u) => u.length === first.length && u.every((p) => first.includes(p)))
  const together = line.qty > 1 && allSame && !perUnit

  const withToggled = (people: PersonId[], p: PersonId) =>
    people.includes(p) ? people.filter((x) => x !== p) : personIds.filter((x) => x === p || people.includes(x))
  const toggleUnit = (i: number, p: PersonId) => onChange({ units: line.units.map((u, j) => (j === i ? withToggled(u, p) : u)) })
  const toggleAll = (p: PersonId) => onChange({ units: line.units.map(() => withToggled(first, p)) })
  const everyone = () => {
    setPerUnit(false)
    onChange({ units: line.units.map(() => [...sharing]) })
  }

  const startCustom = () => {
    const ate = personIds.filter((p) => line.units.some((u) => u.includes(p)))
    onChange({ custom: evenly(line.price, ate.length ? ate : sharing) })
  }
  // Picking who ate re-spreads the price evenly; amounts can then be typed per person.
  const toggleEater = (p: PersonId) => onChange({ custom: evenly(line.price, withToggled(eaters, p)) })

  const status = !problem
    ? null
    : line.custom
      ? amountsLeft > 0
        ? `${yen(amountsLeft)} left to give out`
        : `${yen(-amountsLeft)} too much`
      : line.qty === 1
        ? 'Who had it?'
        : notGiven === line.qty
          ? 'Nobody picked yet'
          : `${notGiven} of ${line.qty} not given out`

  // Same columns on every row, so each person's chips line up down the card.
  const grid = (label: boolean) => ({ gridTemplateColumns: `${label ? '1.5rem ' : ''}repeat(${sharing.length}, minmax(0, 1fr))` })
  const chip = 'w-full min-w-0 px-1 border-transparent bg-canvas'

  return (
    <div className={cn('rounded-2xl border bg-surface p-3.5', problem ? 'border-amber-300' : 'border-line')}>
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 leading-snug font-semibold break-words">
          {line.name_en || line.name_ja || 'Item'}
          {line.qty > 1 && <span className="font-normal text-muted"> ×{line.qty}</span>}
        </p>
        <Money amount={line.price} className="shrink-0 font-semibold" />
      </div>

      <div className="mt-2 mb-3 flex flex-wrap items-center gap-1.5">
        {status ? (
          <span className={cn('mr-auto text-xs font-medium', amountsLeft < 0 ? 'text-red-600' : 'text-amber-700')}>{status}</span>
        ) : (
          <span className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check className="size-3.5" /> Done
          </span>
        )}
        {!line.custom && (
          <SplitAction onClick={everyone}>
            <Users className="size-3.5" /> Everyone
          </SplitAction>
        )}
        <SplitAction active={!!line.custom} onClick={() => (line.custom ? onChange({ custom: null }) : startCustom())}>
          <SlidersHorizontal className="size-3.5" /> Amounts
        </SplitAction>
      </div>

      {line.custom ? (
        <div className="space-y-2">
          <div className="grid gap-1.5" style={grid(false)}>
            {sharing.map((p) => (
              <PersonChip key={p} id={p} compact active={eaters.includes(p)} className={chip} onClick={() => toggleEater(p)} />
            ))}
          </div>
          {eaters.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <PersonDot id={p} />
              <span className="flex-1 text-sm font-medium">{personById(p)?.name}</span>
              <div className="w-32">
                <AmountField
                  label={`${personById(p)?.name}'s amount`}
                  className="h-10 text-right"
                  invalid={amountsLeft < 0}
                  value={line.custom?.[p] ?? null}
                  onChange={(n) => onChange({ custom: { ...line.custom, [p]: n ?? 0 } })}
                />
              </div>
            </div>
          ))}
        </div>
      ) : together ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs text-muted">All {line.qty}, shared by</p>
            <button type="button" onClick={() => setPerUnit(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <Split className="size-3.5" /> One by one
            </button>
          </div>
          <div className="grid gap-1.5" style={grid(false)}>
            {sharing.map((p) => (
              <PersonChip key={p} id={p} compact active={first.includes(p)} className={chip} onClick={() => toggleAll(p)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {line.units.map((u, i) => (
            <div key={i} className="grid items-center gap-1.5" style={grid(line.qty > 1)}>
              {line.qty > 1 && <span className="text-center text-xs font-medium text-muted tabular-nums">{i + 1}</span>}
              {sharing.map((p) => (
                <PersonChip key={p} id={p} compact active={u.includes(p)} className={chip} onClick={() => toggleUnit(i, p)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SplitAction({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition active:scale-95',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink active:bg-canvas',
        className,
      )}
      {...props}
    />
  )
}

function SharesPreview({ lines, sharing, payer, draft }: { lines: BillLine[]; sharing: PersonId[]; payer: PersonId; draft: boolean }) {
  if (draft) {
    const left = lines.filter((l) => lineProblem(l) !== null).length
    return (
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
        {left ? `${left} ${left === 1 ? 'item still needs' : 'items still need'} people.` : 'Add something to split.'} You can save now and finish later.
      </p>
    )
  }
  const all = shares({ lines, sharing, payer })
  return (
    <div className="rounded-2xl bg-primary-soft p-3">
      <p className="mb-1.5 text-sm font-bold">Shares</p>
      {[...all].map(([p, amount]) => (
        <p key={p} className="flex items-center gap-2 py-0.5 text-sm">
          <PersonDot id={p} className="size-5 text-[10px]" />
          <span className="flex-1 font-medium">
            {personById(p)?.name}
            {p === payer && <span className="font-normal text-muted"> · paid the bill</span>}
          </span>
          <Money amount={amount} className="font-semibold" />
        </p>
      ))}
    </div>
  )
}
