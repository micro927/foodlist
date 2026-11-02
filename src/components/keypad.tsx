import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Delete } from 'lucide-react'
import { inputClass } from '@/components/ui'
import { useBackHandler } from '@/lib/back'
import { evaluate, isOperator, operators, press } from '@/lib/keypad'
import { cn } from '@/lib/utils'

/** Digits, "00" and + − × ÷. OK closes the keypad (the amount is already worked out as you type). */
export function Keypad({ onKey, onDone, canDone = true }: { onKey: (key: string) => void; onDone: () => void; canDone?: boolean }) {
  const key = 'h-11 rounded-2xl bg-line/60 text-xl font-semibold tabular-nums transition active:scale-95 active:bg-line'
  const op = 'h-11 rounded-2xl bg-primary-soft text-xl font-semibold text-primary transition active:scale-95'
  return (
    <div className="grid grid-cols-4 gap-1.5 motion-safe:animate-keypad-in">
      <button type="button" className={cn(key, 'col-span-3 text-base text-muted')} onClick={() => onKey('C')}>
        Clear
      </button>
      {[
        [operators[0]],
        ['7', '8', '9', '×'],
        ['4', '5', '6', '−'],
        ['1', '2', '3', '+'],
        ['00', '0'],
      ]
        .flat()
        .map((k) => (
          <button key={k} type="button" className={isOperator(k) ? op : key} onClick={() => onKey(k)}>
            {k}
          </button>
        ))}
      <button type="button" className={key} aria-label="Delete last digit" onClick={() => onKey('⌫')}>
        <Delete className="mx-auto size-5" />
      </button>
      <button
        type="button"
        disabled={!canDone}
        className="h-11 rounded-2xl bg-primary text-base font-semibold text-white shadow-sm shadow-primary/30 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        onClick={onDone}
      >
        OK
      </button>
    </div>
  )
}

/** A typed key as a keypad key: digits, + - * /, Backspace. */
const keyOf: Record<string, string> = { '-': '−', '*': '×', x: '×', '/': '÷', '+': '+', Backspace: '⌫' }

const grouped = (expression: string) => expression.replace(/\d+/g, (n) => Number(n).toLocaleString('en-US'))

const SlotContext = createContext<{ slot: HTMLElement | null; setSlot: (slot: HTMLElement | null) => void; setOpen: (open: boolean) => void } | null>(
  null,
)

/** Lets the AmountFields inside put their keypad in its KeypadSlot. While one is up, `in-data-keypad-open:` styles apply. */
export function KeypadSlots({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const context = useMemo(() => ({ slot, setSlot, setOpen }), [slot])
  return (
    <SlotContext.Provider value={context}>
      <div className="contents" data-keypad-open={open || undefined}>
        {children}
      </div>
    </SlotContext.Provider>
  )
}

/** Where the keypad opens: in the form's footer, near the thumb. */
export function KeypadSlot() {
  const context = useContext(SlotContext)
  return <div ref={context?.setSlot} className="contents" />
}

/**
 * An amount typed on the keypad (a small calculator) instead of the phone's keyboard. `onChange` gets the amount
 * worked out, never the sum. The first digit replaces what's there; an operator carries on from it. A tap anywhere
 * else, OK, Enter or back puts the keypad away; while `invalid` (e.g. Amounts over the price) OK and Enter don't.
 */
export function AmountField({
  value,
  onChange,
  label,
  prefix = '¥',
  placeholder = '0',
  invalid,
  className,
}: {
  value: number | null
  onChange: (value: number | null) => void
  label: string
  prefix?: ReactNode
  placeholder?: string
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [expression, setExpression] = useState('')
  // Kept in refs too, so keys typed faster than a render each still build on one another.
  const typed = useRef('')
  const fresh = useRef(false)

  function start() {
    if (open) return
    typed.current = value ? String(value) : ''
    setExpression(typed.current)
    fresh.current = true
    setOpen(true)
  }
  function type(key: string) {
    const from = fresh.current && !isOperator(key) && key !== '⌫' ? '' : typed.current
    fresh.current = false
    typed.current = press(from, key)
    const amount = evaluate(typed.current)
    setExpression(typed.current)
    onChange(amount === null ? null : Math.max(0, amount))
  }
  const done = () => setOpen(false)
  const typeRef = useRef(type)
  const invalidRef = useRef(invalid)
  useEffect(() => {
    typeRef.current = type
    invalidRef.current = invalid
  })
  useBackHandler(open, done)

  const context = useContext(SlotContext)
  const setSlotOpen = context?.setOpen
  const ref = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    setSlotOpen?.(true)
    // Its scroll margin keeps it clear of the keypad below.
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !padRef.current?.contains(target)) done()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        if (e.key === 'Escape' || !invalidRef.current) done()
        return
      }
      const key = /^\d$/.test(e.key) ? e.key : keyOf[e.key]
      if (!key) return
      e.preventDefault()
      typeRef.current(key)
    }
    document.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey, true)
    return () => {
      setSlotOpen?.(false)
      document.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, setSlotOpen])

  // Fields can be narrow, so the field shows the amount and the sum being typed sits on the keypad.
  const amount = open ? evaluate(expression) : value
  const shown = amount ? amount.toLocaleString('en-US') : ''
  return (
    <div ref={ref} className="scroll-mt-20 scroll-mb-80">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={start}
        className={cn(inputClass, 'flex items-center gap-1 px-3 text-left tabular-nums', open && 'border-primary ring-4 ring-primary/10', invalid && 'border-red-500 ring-red-500/15', className)}
      >
        {prefix && <span className="shrink-0 text-muted">{prefix}</span>}
        <span className={cn('min-w-0 flex-1 truncate', !shown && !open && 'text-muted/60')}>
          {shown || (!open && placeholder)}
          {open && <span className="ml-px inline-block h-5 w-0.5 animate-pulse bg-primary align-middle" />}
        </span>
      </button>
      {open &&
        context?.slot &&
        createPortal(
          <div ref={padRef} className="mb-2.5">
            <div className="mb-1.5 flex items-baseline gap-3 px-1">
              <span className="shrink-0 text-xs font-semibold text-muted">{label}</span>
              <span className="min-w-0 flex-1 truncate text-right text-lg font-semibold tabular-nums" dir="rtl">
                <bdi>{expression ? grouped(expression) : '0'}</bdi>
              </span>
            </div>
            <Keypad onKey={type} onDone={done} canDone={!invalid} />
          </div>,
          context.slot,
        )}
    </div>
  )
}
