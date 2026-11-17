import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronDown, LayoutGrid, List, Map as MapIcon, Plus, Search, X } from 'lucide-react'
import { Button, Chip, inputClass } from '@/components/ui'
import { cn } from '@/lib/utils'
import { trip } from '@/trip.config'

// Building blocks shared by the Eats, Places, Areas and Bills pages.

export type Option = { value: string; label: string; count?: number; icon?: ReactNode }

export function PageTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex-1">
      <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">{trip.name}</p>
      <h1 className="text-2xl leading-tight font-extrabold">
        {title} <span className="text-base font-medium text-muted">{count}</span>
      </h1>
    </div>
  )
}

/** How Eats, Places and Areas can be shown (only Eats has a map). */
export type View = 'list' | 'grid' | 'map'

const viewIcons = { list: List, grid: LayoutGrid, map: MapIcon } satisfies Record<View, unknown>

/** The choices for ViewButton's picker; the map only where a section has one. */
export function viewOptions(withMap: boolean): Option[] {
  const views: View[] = withMap ? ['list', 'grid', 'map'] : ['list', 'grid']
  return views.map((v) => {
    const Icon = viewIcons[v]
    return { value: v, label: { list: 'List', grid: 'Grid', map: 'Map' }[v], icon: <Icon className="size-5" /> }
  })
}

/** Shows the current view; tapping it opens a picker to choose list, grid or map. */
export function ViewButton({ view, onClick }: { view: View; onClick: () => void }) {
  const Icon = viewIcons[view]
  return (
    <Button variant="outline" size="icon" aria-label={`Show as… (now ${view})`} onClick={onClick}>
      <Icon className="size-5" />
    </Button>
  )
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mt-3">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        className={cn(inputClass, 'h-11 pr-10 pl-10')}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

export function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Chip active={active} onClick={onClick}>
      {label} <ChevronDown className="size-3.5 opacity-70" />
    </Chip>
  )
}

export function OptionRow({
  label,
  count,
  icon,
  selected,
  onClick,
}: {
  label: string
  count?: number
  icon?: ReactNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] transition',
          selected ? 'bg-primary-soft font-semibold text-primary' : 'active:bg-canvas',
        )}
      >
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && <span className="text-sm text-muted">{count}</span>}
        {selected && <Check className="size-4" />}
      </button>
    </li>
  )
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
  onAction,
}: {
  emoji: string
  title: string
  body: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="aurora mb-4 grid size-20 place-items-center rounded-full text-4xl">{emoji}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <Button variant="soft" className="mt-5" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-line/60" />
      ))}
    </div>
  )
}

/** Distinct non-empty values (case-insensitive) with how many use each, most-used first. */
export function countOptions(values: string[], format: (v: string) => string = (v) => v): Option[] {
  const counts = new Map<string, Option>()
  for (const raw of values) {
    const v = raw.trim()
    if (!v) continue
    const key = v.toLowerCase()
    const existing = counts.get(key)
    if (existing) existing.count!++
    else counts.set(key, { value: v, label: format(v), count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count! - a.count! || a.label.localeCompare(b.label))
}

/** The floating "+ Add …" button above the tab bar; slides up on mount. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20"
    >
      <Button className="h-14 px-6 text-base shadow-lg" onClick={onClick}>
        <Plus className="size-5" strokeWidth={2.5} /> {label}
      </Button>
    </motion.div>
  )
}
