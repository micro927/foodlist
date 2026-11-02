import type { Bill, BillLine } from '@/lib/types'
import { personIds, type PersonId } from '@/trip.config'

// Everything money-related in Bills is worked out here from the saved Bill, never stored.

export const lineSum = (lines: BillLine[]) => lines.reduce((sum, l) => sum + l.price, 0)

const customSum = (line: BillLine) => Object.values(line.custom ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0)

/** Yen of a Line's typed Amounts still to give out; negative when they add up to more than its price. */
export const customLeft = (line: BillLine) => (line.custom && !line.extra ? line.price - customSum(line) : 0)

/** Why a Line can't be split yet, or null when it's fine. */
export function lineProblem(line: BillLine): string | null {
  if (line.extra) return null
  if (line.custom) return customSum(line) === line.price ? null : 'Amounts must add up to the price'
  if (line.units.length !== line.qty || line.units.some((u) => u.length === 0)) return 'Not everything is given out'
  return null
}

/** A Draft is a Bill with nothing to split yet or something not given out. It doesn't count toward Balances or spend. */
export const isDraft = (bill: Pick<Bill, 'lines'>) =>
  bill.lines.length === 0 || !bill.lines.some((l) => !l.extra) || bill.lines.some((l) => lineProblem(l) !== null)

/**
 * Each person's Share of a Bill in whole yen. Units are split equally between who ate them, Extras are
 * spread by what each person ate, and the yen lost to rounding go to the Payer (or the biggest Share
 * when the Payer isn't Sharing), so Shares always add up to the Bill's total.
 */
export function shares(bill: Pick<Bill, 'lines' | 'sharing' | 'payer'>): Map<PersonId, number> {
  const eaten = new Map<PersonId, number>()
  const add = (p: PersonId, yen: number) => eaten.set(p, (eaten.get(p) ?? 0) + yen)

  for (const line of bill.lines) {
    if (line.extra) continue
    if (line.custom) {
      for (const [p, yen] of Object.entries(line.custom)) add(p as PersonId, yen ?? 0)
      continue
    }
    const perUnit = line.price / Math.max(line.qty, 1)
    for (const unit of line.units) for (const p of unit) add(p, perUnit / unit.length)
  }

  const extras = bill.lines.filter((l) => l.extra).reduce((s, l) => s + l.price, 0)
  const eatenTotal = [...eaten.values()].reduce((s, v) => s + v, 0)
  if (extras) {
    if (eatenTotal > 0) for (const [p, yen] of eaten) eaten.set(p, yen + (extras * yen) / eatenTotal)
    else for (const p of bill.sharing) add(p, extras / bill.sharing.length)
  }

  const result = new Map<PersonId, number>()
  for (const p of personIds) if (eaten.has(p)) result.set(p, Math.round(eaten.get(p)!))
  const leftover = lineSum(bill.lines) - [...result.values()].reduce((s, v) => s + v, 0)
  if (leftover && result.size) {
    const takes = result.has(bill.payer) ? bill.payer : [...result].sort((a, b) => b[1] - a[1])[0][0]
    result.set(takes, result.get(takes)! + leftover)
  }
  return result
}

/** Shares someone still owes the Payer (never the Payer's own). Drafts owe nothing yet. */
export function owed(bill: Bill): { person: PersonId; amount: number; paid: boolean }[] {
  if (isDraft(bill)) return []
  return [...shares(bill)]
    .filter(([p, amount]) => p !== bill.payer && amount !== 0)
    .map(([person, amount]) => ({ person, amount, paid: bill.paid[person] === amount }))
}

/** What each person ate across these Bills (their Shares, whoever paid). */
export function spent(bills: Bill[]) {
  const total = new Map<PersonId, number>()
  for (const b of bills) if (!isDraft(b)) for (const [p, yen] of shares(b)) total.set(p, (total.get(p) ?? 0) + yen)
  return total
}

export type Balance = { from: PersonId; to: PersonId; amount: number }

/** Unpaid Shares netted per pair of people: "from pays to". Pairs that are even are left out. */
export function balances(bills: Bill[]): Balance[] {
  const net = new Map<string, number>() // "a|b" with a before b in personIds order; positive = a owes b
  const order = (p: PersonId) => personIds.indexOf(p)
  for (const bill of bills) {
    for (const s of owed(bill)) {
      if (s.paid) continue
      const [a, b] = order(s.person) < order(bill.payer) ? [s.person, bill.payer] : [bill.payer, s.person]
      const key = `${a}|${b}`
      net.set(key, (net.get(key) ?? 0) + (a === s.person ? s.amount : -s.amount))
    }
  }
  return [...net]
    .filter(([, v]) => v !== 0)
    .map(([key, v]) => {
      const [a, b] = key.split('|') as [PersonId, PersonId]
      return v > 0 ? { from: a, to: b, amount: v } : { from: b, to: a, amount: -v }
    })
    .sort((x, y) => y.amount - x.amount)
}

/** The `paid` each Bill needs so every Share between two people counts as paid. Only Bills that change. */
export function settleUp(bills: Bill[], a: PersonId, b: PersonId) {
  const changes: { bill: Bill; paid: Bill['paid'] }[] = []
  for (const bill of bills) {
    if (bill.payer !== a && bill.payer !== b) continue
    const other = bill.payer === a ? b : a
    const share = owed(bill).find((s) => s.person === other && !s.paid)
    if (share) changes.push({ bill, paid: { ...bill.paid, [other]: share.amount } })
  }
  return changes
}

/** People whose Share was paid but goes back to unpaid after this edit (its amount or the Payer changed). */
export function paidSharesChanged(before: Bill, after: Pick<Bill, 'lines' | 'sharing' | 'payer'>) {
  const next = isDraft(after) || after.payer !== before.payer ? new Map<PersonId, number>() : shares(after)
  return owed(before)
    .filter((s) => s.paid && next.get(s.person) !== s.amount)
    .map((s) => s.person)
}

export const yen = (amount: number) => `¥${amount.toLocaleString('en-US')}`
