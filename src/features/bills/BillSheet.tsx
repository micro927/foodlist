import { useState } from 'react'
import { Check, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PhotoViewer } from '@/components/PhotoViewer'
import { Button, Sheet, useSticky } from '@/components/ui'
import { api } from '@/lib/api'
import { useBills, useDeleteBill, useSetPaid } from '@/lib/data'
import type { Bill } from '@/lib/types'
import { cn } from '@/lib/utils'
import { personById, type PersonId } from '@/trip.config'
import { useOpenSheet } from '../sheets'
import { dayLabel, Money, PersonDot } from './parts'
import { isDraft, lineSum, owed, shares } from './split'

const useBill = (id: string | undefined) => useBills().data?.find((b) => b.id === id)

export function BillSheet({ state, onClose }: { state: { id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const bill = useBill(last?.id)
  return (
    <Sheet open={state !== null && !!bill} onClose={onClose} title={bill?.shop || 'Bill'}>
      {bill && <BillDetail bill={bill} />}
    </Sheet>
  )
}

function BillDetail({ bill }: { bill: Bill }) {
  const openSheet = useOpenSheet()
  const setPaid = useSetPaid()
  const [photo, setPhoto] = useState<string | null>(null)
  const draft = isDraft(bill)
  const all = shares(bill)
  const total = lineSum(bill.lines)

  const toggle = (person: PersonId, amount: number, paid: boolean) => {
    const next = { ...bill.paid }
    if (paid) delete next[person]
    else next[person] = amount
    setPaid.mutate([{ bill, paid: next }])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted">
          <p>
            {dayLabel(bill.day)} · {bill.time}
          </p>
          <p className="mt-0.5 flex items-center gap-1">
            <PersonDot id={bill.payer} className="size-5 text-[10px]" /> {personById(bill.payer)?.name} paid
          </p>
        </div>
        <Money amount={total} className="text-right text-2xl font-extrabold" />
      </div>

      {draft && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          <p className="flex-1">Not everything is given out yet, so this bill doesn't count toward balances.</p>
          <Button size="sm" variant="outline" onClick={() => openSheet({ kind: 'billForm', id: bill.id, step: 'split' })}>
            Split
          </Button>
        </div>
      )}

      {!draft && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Shares</h3>
          <ul className="space-y-1.5">
            {[...all].map(([person, amount]) => {
              const share = owed(bill).find((s) => s.person === person)
              return (
                <li key={person} className="flex items-center gap-2.5 rounded-2xl border border-line p-2 pl-3">
                  <PersonDot id={person} />
                  <span className="flex-1 font-medium">{personById(person)?.name}</span>
                  <Money amount={amount} className="font-semibold" />
                  {share ? (
                    <Button
                      size="sm"
                      variant={share.paid ? 'soft' : 'outline'}
                      className={cn('w-28', share.paid && 'bg-emerald-50 text-emerald-700')}
                      onClick={() => toggle(person, amount, share.paid)}
                    >
                      {share.paid ? (
                        <>
                          <Check className="size-4" /> Paid back
                        </>
                      ) : (
                        'Mark paid'
                      )}
                    </Button>
                  ) : (
                    <span className="w-28 text-center text-xs text-muted">{person === bill.payer ? 'Paid the bill' : '—'}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">What was on it</h3>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {bill.lines.map((l) => {
            const eaters = l.custom ? (Object.keys(l.custom) as PersonId[]) : [...new Set(l.units.flat())]
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium break-words">
                    {l.name_en || l.name_ja}
                    {l.qty > 1 && <span className="font-normal text-muted"> ×{l.qty}</span>}
                  </p>
                  {l.name_ja && l.name_en && <p className="text-xs break-words text-muted">{l.name_ja}</p>}
                </div>
                {l.extra ? (
                  <span className="text-xs text-muted">Spread by what each ate</span>
                ) : (
                  <span className="flex -space-x-1">
                    {eaters.map((p) => (
                      <PersonDot key={p} id={p} className="size-5 text-[10px] ring-2 ring-surface" />
                    ))}
                  </span>
                )}
                <Money amount={l.price} className="w-16 text-right text-sm font-semibold" />
              </li>
            )
          })}
        </ul>
        {bill.receipt_total !== null && bill.receipt_total !== total && (
          <p className="mt-2 text-xs text-amber-700">
            Receipt says <Money amount={bill.receipt_total} />, items add up to <Money amount={total} />.
          </p>
        )}
      </section>

      {bill.photo_paths.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Receipt</h3>
          <div className="flex gap-2">
            {bill.photo_paths.map((p) => (
              <button key={p} type="button" onClick={() => setPhoto(api.coverUrl(p))}>
                <img src={api.coverUrl(p)} alt="Receipt" className="h-24 w-20 rounded-xl border border-line object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <Button variant="danger" size="icon" className="size-12" aria-label="Delete bill" onClick={() => openSheet({ kind: 'billDelete', id: bill.id })}>
          <Trash2 className="size-5" />
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => openSheet({ kind: 'billForm', id: bill.id })}>
          <Pencil className="size-4" /> Edit bill
        </Button>
      </div>

      <PhotoViewer src={photo} alt="Receipt" onClose={() => setPhoto(null)} />
    </div>
  )
}

export function DeleteBillSheet({ state, onClose }: { state: { id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const bill = useBill(last?.id)
  const remove = useDeleteBill()
  const unpaid = bill ? owed(bill).filter((s) => !s.paid).length : 0

  return (
    <Sheet open={state !== null && !!bill} onClose={onClose} title={`Delete ${bill?.shop || 'this bill'}?`}>
      <p className="text-[15px] text-muted">
        {unpaid > 0 ? `${unpaid} ${unpaid === 1 ? 'share is' : 'shares are'} still unpaid — they'll disappear from the balances.` : 'This removes it for everyone.'}
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-red-600 shadow-red-600/30"
          disabled={remove.isPending}
          onClick={() =>
            bill &&
            remove.mutate(bill, {
              onSuccess: () => {
                toast.success('Bill deleted')
                onClose()
              },
            })
          }
        >
          {remove.isPending && <Loader2 className="size-5 animate-spin" />}
          Delete
        </Button>
      </div>
    </Sheet>
  )
}
