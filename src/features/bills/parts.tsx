import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { personById, trip, type PersonId } from '@/trip.config'
import { yen } from './split'

/** A person's initial in their colour. */
export function PersonDot({ id, className }: { id: PersonId; className?: string }) {
  const p = personById(id)
  return (
    <span
      title={p?.name}
      style={{ backgroundColor: p?.color }}
      className={cn('inline-grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white', className)}
    >
      {p?.name[0]}
    </span>
  )
}

/** Tappable person (Payer, Sharing, who ate a Unit). */
export function PersonChip({
  id,
  active,
  compact,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { id: PersonId; active: boolean; compact?: boolean }) {
  const p = personById(id)!
  return (
    <button
      type="button"
      aria-pressed={active}
      style={active ? { backgroundColor: p.soft, borderColor: p.color, color: p.color } : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border font-semibold transition active:scale-95',
        compact ? 'h-9 px-2.5 text-[13px]' : 'h-11 min-w-0 px-1 text-sm',
        active ? 'border-2' : 'border-line bg-surface text-muted',
        className,
      )}
      {...props}
    >
      {p.name}
    </button>
  )
}

export function Money({ amount, className }: { amount: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{yen(amount)}</span>
}

/** "Wed 23 Dec · Day 1" during the trip, otherwise just the date. */
export function dayLabel(iso: string, withDayNumber = true) {
  const day = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  const n = (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${trip.startDate}T00:00:00Z`)) / 86_400_000 + 1
  return withDayNumber && iso >= trip.startDate && iso <= trip.endDate ? `${day} · Day ${n}` : day
}
