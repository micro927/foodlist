import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, fabClass, GridSkeleton, PageTitle } from '@/components/browse'
import { Button } from '@/components/ui'
import { useBills, useSetPaid } from '@/lib/data'
import type { Bill } from '@/lib/types'
import { cn, local } from '@/lib/utils'
import { personById, personIds, trip, type PersonId } from '@/trip.config'
import { useOpenSheet } from '../sheets'
import { dayLabel, Money, PersonDot } from './parts'
import { balances, isDraft, lineSum, owed, settleUp, shares, spent, yen, type Balance } from './split'

type View = 'meal' | 'person' | 'date'
const VIEW_KEY = 'foodlist:bills-view'
const PERSON_KEY = 'foodlist:bills-person'

export function BillsPage() {
  const { data: bills = [], isPending } = useBills()
  const openSheet = useOpenSheet()
  const [view, setViewState] = useState<View>(() => (local.get(VIEW_KEY) as View) || 'meal')
  const setView = (v: View) => (setViewState(v), local.set(VIEW_KEY, v))
  const addBill = () => openSheet({ kind: 'billForm' })

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pb-3">
          <PageTitle title="Bills" count={bills.length} />
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {isPending ? (
          <GridSkeleton />
        ) : bills.length === 0 ? (
          <EmptyState emoji="🧾" title="No bills yet" body="Scan the receipt after a shared meal and split who ate what." action="Add a bill" onAction={addBill} />
        ) : view === 'meal' ? (
          <>
            <BalancesCard bills={bills} />
            <div className="space-y-2">
              {bills.map((b) => (
                <BillCard key={b.id} bill={b} />
              ))}
            </div>
          </>
        ) : view === 'person' ? (
          <PersonView bills={bills} />
        ) : (
          <DateView bills={bills} />
        )}
      </main>

      <Button className={cn(fabClass, 'shadow-lg')} onClick={addBill}>
        <Plus className="size-5" /> New bill
      </Button>
    </div>
  )
}

/** Who pays whom, netted per pair, with a Mark paid button (Pay back) for each. */
function BalancesCard({ bills, person }: { bills: Bill[]; person?: PersonId }) {
  const setPaid = useSetPaid()
  const list = balances(bills).filter((b) => !person || b.from === person || b.to === person)

  const payBack = ({ from, to, amount }: Balance) =>
    setPaid.mutate(settleUp(bills, from, to), {
      onSuccess: () => toast.success(`${personById(from)?.name} paid ${personById(to)?.name} back ${yen(amount)}`),
    })

  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-bold">{person ? 'Balances' : 'Who owes whom'}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Nobody owes anything 🎉</p>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li key={`${b.from}-${b.to}`} className="flex items-center gap-2">
              <span className="flex shrink-0 -space-x-1.5">
                <PersonDot id={b.from} className="ring-2 ring-surface" />
                <PersonDot id={b.to} className="ring-2 ring-surface" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {personById(b.from)?.name} <ArrowRight className="inline size-3.5 text-muted" /> {personById(b.to)?.name}
              </span>
              <Money amount={b.amount} className="font-bold" />
              <Button size="sm" variant="soft" className="px-3" disabled={setPaid.isPending} onClick={() => payBack(b)}>
                Mark paid
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BillCard({ bill, person }: { bill: Bill; person?: PersonId }) {
  const openSheet = useOpenSheet()
  const draft = isDraft(bill)
  const unpaid = owed(bill).filter((s) => !s.paid)
  const myShare = person ? shares(bill).get(person) : undefined
  const myOwed = person ? owed(bill).find((s) => s.person === person) : undefined

  return (
    <button
      type="button"
      onClick={() => openSheet({ kind: 'bill', id: bill.id })}
      className="flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-3 text-left transition active:scale-[0.99]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-xl">🧾</span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-bold break-words">{bill.shop || 'Untitled bill'}</span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          {dayLabel(bill.day, false)} · {bill.time} · <PersonDot id={bill.payer} className="size-4 text-[9px]" /> paid
        </span>
        <span className="mt-1 block text-xs font-semibold">
          {draft ? (
            <span className="text-amber-600">Needs splitting</span>
          ) : person ? (
            bill.payer === person ? (
              <span className="text-muted">Paid the bill</span>
            ) : myOwed ? (
              myOwed.paid ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600">
                  <Check className="size-3" /> Paid back
                </span>
              ) : (
                <span className="text-primary">Owes {personById(bill.payer)?.name}</span>
              )
            ) : (
              <span className="text-muted">Not sharing</span>
            )
          ) : unpaid.length ? (
            <span className="text-primary">{unpaid.map((s) => personById(s.person)?.name).join(', ')} still owe</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <Check className="size-3" /> All paid
            </span>
          )}
        </span>
      </span>
      <span className="text-right">
        {person ? (
          <>
            <Money amount={myShare ?? 0} className="block font-bold" />
            <span className="text-xs text-muted">of {yen(lineSum(bill.lines))}</span>
          </>
        ) : (
          <Money amount={lineSum(bill.lines)} className="font-bold" />
        )}
      </span>
    </button>
  )
}

function PersonView({ bills }: { bills: Bill[] }) {
  const [person, setPersonState] = useState<PersonId>(() => {
    const saved = local.get(PERSON_KEY) as PersonId
    return personIds.includes(saved) ? saved : personIds[0]
  })
  const setPerson = (p: PersonId) => (setPersonState(p), local.set(PERSON_KEY, p))
  const theirs = useMemo(() => bills.filter((b) => b.payer === person || b.sharing.includes(person)), [bills, person])
  const total = spent(bills).get(person) ?? 0

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {trip.people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPerson(p.id)}
            style={p.id === person ? { backgroundColor: p.soft, borderColor: p.color, color: p.color } : undefined}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-full border text-sm font-bold transition',
              p.id === person ? 'border-2' : 'border-line bg-surface text-muted',
            )}
          >
            <PersonDot id={p.id} className={cn('size-5 text-[10px]', p.id !== person && 'opacity-40 grayscale')} />
            {p.name}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">{personById(person)?.name} has eaten</p>
        <Money amount={total} withBaht className="text-2xl font-extrabold" />
        <p className="mt-0.5 text-xs text-muted">Their share of every finished bill, whoever paid</p>
      </section>

      <BalancesCard bills={bills} person={person} />

      <div className="space-y-2">
        {theirs.map((b) => (
          <BillCard key={b.id} bill={b} person={person} />
        ))}
      </div>
    </>
  )
}

function DateView({ bills }: { bills: Bill[] }) {
  const days = useMemo(() => {
    const map = new Map<string, Bill[]>()
    for (const b of bills) map.set(b.day, [...(map.get(b.day) ?? []), b])
    return [...map].sort((a, b) => b[0].localeCompare(a[0]))
  }, [bills])

  return (
    <>
      {days.map(([day, list]) => {
        const perPerson = spent(list)
        const total = list.filter((b) => !isDraft(b)).reduce((s, b) => s + lineSum(b.lines), 0)
        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-lg font-extrabold">{dayLabel(day)}</h2>
              <Money amount={total} withBaht className="text-sm font-bold" />
            </div>
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {trip.people.map((p) => (
                <div key={p.id} className="rounded-2xl px-2 py-1.5 text-center" style={{ backgroundColor: p.soft }}>
                  <p className="text-[11px] font-bold" style={{ color: p.color }}>
                    {p.name}
                  </p>
                  <Money amount={perPerson.get(p.id) ?? 0} className="text-sm font-bold" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {list.map((b) => (
                <BillCard key={b.id} bill={b} />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

/** Meal | Person | Date switch in the Bills header. */
function ViewSwitch({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const options: { id: View; label: string }[] = [
    { id: 'meal', label: 'Meal' },
    { id: 'person', label: 'Person' },
    { id: 'date', label: 'Date' },
  ]
  return (
    <div className="flex rounded-full border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn('relative h-8 rounded-full px-3 text-sm font-bold transition', value === o.id ? 'text-primary' : 'text-muted')}
        >
          {value === o.id && (
            <motion.span
              layoutId="bills-view-pill"
              className="absolute inset-0 rounded-full bg-primary-soft"
              transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
