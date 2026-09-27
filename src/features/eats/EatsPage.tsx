import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Button, Chip, inputClass, Sheet, useSticky } from "@/components/ui";
import { usePlanCounts, useRestaurants } from "@/lib/data";
import { setMe, useMe } from "@/lib/device";
import type { Restaurant } from "@/lib/types";
import { cn, local } from "@/lib/utils";
import { categoryEmoji, coupleById, trip, type CoupleId } from "@/trip.config";
import { useOpenSheet } from "../sheets";
import { RestaurantCard, RestaurantRow } from "./RestaurantCard";

type Interest = "both" | CoupleId | "none";
type Filters = {
  category: string | null;
  area: string | null;
  interest: Interest | null;
  planned: "planned" | "unplanned" | null;
};
type SortKey = "best" | "newest" | "name" | "category";
type Option = { value: string; label: string; count?: number };

const noFilters: Filters = {
  category: null,
  area: null,
  interest: null,
  planned: null,
};

const sortOptions: Option[] = [
  { value: "best", label: "Both want first" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A–Z" },
  { value: "category", label: "Category" },
];

const interestOptions: Option[] = [
  { value: "both", label: "💞 Both want" },
  ...trip.couples.map((c) => ({
    value: c.id,
    label: `${c.emoji} ${c.name} wants`,
  })),
  { value: "none", label: "🤷 No one yet" },
];

const plannedOptions: Option[] = [
  { value: "planned", label: "📅 In the plan" },
  { value: "unplanned", label: "🗒️ Not planned yet" },
];

const allCouples = (r: Restaurant) =>
  trip.couples.every((c) => r.interested.includes(c.id));

export function EatsPage() {
  const { data: restaurants = [], isPending } = useRestaurants();
  const counts = usePlanCounts();
  const openSheet = useOpenSheet();
  const me = useMe();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [sort, setSortState] = useState<SortKey>(
    () => (local.get("foodlist:sort") as SortKey) || "best"
  );
  const [view, setViewState] = useState<"grid" | "list">(() =>
    local.get("foodlist:view") === "grid" ? "grid" : "list"
  );
  const [picker, setPicker] = useState<keyof Filters | "sort" | "me" | null>(
    null
  );

  const setSort = (s: SortKey) => (
    setSortState(s),
    local.set("foodlist:sort", s)
  );
  const setView = (v: "grid" | "list") => (
    setViewState(v),
    local.set("foodlist:view", v)
  );

  const categoryOptions = useMemo(
    () =>
      countOptions(
        restaurants.map((r) => r.category),
        (c) => `${categoryEmoji(c)} ${c}`
      ),
    [restaurants]
  );
  const areaOptions = useMemo(
    () => countOptions(restaurants.map((r) => r.area)),
    [restaurants]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = restaurants.filter((r) => {
      if (
        q &&
        ![r.name, r.category, r.area, r.notes ?? ""].some((v) =>
          v.toLowerCase().includes(q)
        )
      )
        return false;
      if (
        filters.category &&
        r.category.toLowerCase() !== filters.category.toLowerCase()
      )
        return false;
      if (filters.area && r.area.toLowerCase() !== filters.area.toLowerCase())
        return false;
      if (filters.interest === "both" && !allCouples(r)) return false;
      if (filters.interest === "none" && r.interested.length > 0) return false;
      if (
        filters.interest &&
        filters.interest !== "both" &&
        filters.interest !== "none" &&
        !r.interested.includes(filters.interest)
      )
        return false;
      if (filters.planned === "planned" && !counts.get(r.id)) return false;
      if (filters.planned === "unplanned" && counts.get(r.id)) return false;
      return true;
    });
    const newest = (a: Restaurant, b: Restaurant) =>
      b.created_at.localeCompare(a.created_at);
    const compare: Record<SortKey, (a: Restaurant, b: Restaurant) => number> = {
      best: (a, b) => b.interested.length - a.interested.length || newest(a, b),
      newest,
      name: (a, b) => a.name.localeCompare(b.name),
      category: (a, b) =>
        (a.category || "~").localeCompare(b.category || "~") ||
        a.name.localeCompare(b.name),
    };
    return list.sort(compare[sort]);
  }, [restaurants, query, filters, sort, counts]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const label = (options: Option[], value: string | null, fallback: string) =>
    options.find((o) => o.value === value)?.label ?? fallback;

  const pickerConfig = useSticky(
    picker === null
      ? null
      : picker === "sort"
        ? {
            title: "Sort by",
            options: sortOptions,
            value: sort,
            clearable: false,
          }
        : picker === "me"
          ? {
              title: "Which couple are you?",
              options: trip.couples.map(
                (c): Option => ({ value: c.id, label: `${c.emoji} ${c.name}` })
              ),
              value: me,
              clearable: true,
            }
          : {
              title: {
                category: "Category",
                area: "Area",
                interest: "Who wants it",
                planned: "Plan status",
              }[picker],
              options: {
                category: categoryOptions,
                area: areaOptions,
                interest: interestOptions,
                planned: plannedOptions,
              }[picker],
              value: filters[picker],
              clearable: true,
            }
  );

  function choose(value: string | null) {
    if (picker === "sort") setSort(value as SortKey);
    else if (picker === "me") setMe(value as CoupleId | null);
    else if (picker) setFilters((f) => ({ ...f, [picker]: value }));
    setPicker(null);
  }

  const meCouple = me ? coupleById(me) : undefined;

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
                {trip.name}
              </p>
              <h1 className="text-2xl leading-tight font-extrabold">
                Eats{" "}
                <span className="text-base font-semibold text-muted">
                  {restaurants.length}
                </span>
              </h1>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Which couple are you?"
              onClick={() => setPicker("me")}
            >
              {meCouple ? (
                <span className="text-lg">{meCouple.emoji}</span>
              ) : (
                <UserRound className="size-5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={view === "grid" ? "Show as list" : "Show as grid"}
              onClick={() => setView(view === "grid" ? "list" : "grid")}
            >
              {view === "grid" ? (
                <List className="size-5" />
              ) : (
                <LayoutGrid className="size-5" />
              )}
            </Button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className={cn(inputClass, "h-11 pr-10 pl-10")}
              placeholder="Search name, area, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-3">
            <Chip onClick={() => setPicker("sort")}>
              <ArrowUpDown className="size-3.5" />{" "}
              {label(sortOptions, sort, "Sort")}
            </Chip>
            <FilterChip
              label={label(interestOptions, filters.interest, "Who")}
              active={!!filters.interest}
              onClick={() => setPicker("interest")}
            />
            <FilterChip
              label={
                filters.category
                  ? label(categoryOptions, filters.category, filters.category)
                  : "Category"
              }
              active={!!filters.category}
              onClick={() => setPicker("category")}
            />
            <FilterChip
              label={filters.area ?? "Area"}
              active={!!filters.area}
              onClick={() => setPicker("area")}
            />
            <FilterChip
              label={label(plannedOptions, filters.planned, "Plan")}
              active={!!filters.planned}
              onClick={() => setPicker("planned")}
            />
            {activeFilters > 0 && (
              <Chip
                onClick={() => setFilters(noFilters)}
                className="border-transparent text-primary"
              >
                Clear
              </Chip>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-4">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-3xl bg-line/60"
              />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <EmptyState
            emoji="🍣"
            title="No places yet"
            body="Add the first restaurant you're dreaming about."
            action="Add a place"
            onAction={() => openSheet({ kind: "form" })}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="Nothing matches"
            body="Try a different search or filter."
            action="Clear filters"
            onAction={() => {
              setFilters(noFilters);
              setQuery("");
            }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                >
                  <RestaurantCard
                    restaurant={r}
                    planned={counts.get(r.id) ?? 0}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {visible.map((r) => (
              <RestaurantRow
                key={r.id}
                restaurant={r}
                planned={counts.get(r.id) ?? 0}
              />
            ))}
          </div>
        )}
      </main>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20"
      >
        <Button
          className="h-14 px-6 text-base shadow-lg"
          onClick={() => openSheet({ kind: "form" })}
        >
          <Plus className="size-5" strokeWidth={2.5} /> Add place
        </Button>
      </motion.div>

      <Sheet
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={pickerConfig?.title ?? ""}
      >
        {pickerConfig && (
          <ul className="space-y-1">
            {pickerConfig.clearable && (
              <OptionRow
                label={picker === "me" ? "Just browsing" : "All"}
                selected={pickerConfig.value === null}
                onClick={() => choose(null)}
              />
            )}
            {pickerConfig.options.map((o) => (
              <OptionRow
                key={o.value}
                label={o.label}
                count={o.count}
                selected={pickerConfig.value === o.value}
                onClick={() => choose(o.value)}
              />
            ))}
            {pickerConfig.options.length === 0 && (
              <p className="py-4 text-sm text-muted">Nothing to pick yet.</p>
            )}
          </ul>
        )}
        {picker === "me" && (
          <p className="mt-3 text-xs text-muted">
            Only used on this phone to put your side first. Anyone can still
            tick either couple.
          </p>
        )}
      </Sheet>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Chip active={active} onClick={onClick}>
      {label} <ChevronDown className="size-3.5 opacity-70" />
    </Chip>
  );
}

function OptionRow({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] transition",
          selected
            ? "bg-primary-soft font-semibold text-primary"
            : "active:bg-canvas"
        )}
      >
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && (
          <span className="text-sm text-muted">{count}</span>
        )}
        {selected && <Check className="size-4" />}
      </button>
    </li>
  );
}

function EmptyState({
  emoji,
  title,
  body,
  action,
  onAction,
}: {
  emoji: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="aurora mb-4 grid size-20 place-items-center rounded-full text-4xl">
        {emoji}
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <Button variant="soft" className="mt-5" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

/** Distinct non-empty values (case-insensitive) with how many places use each, most-used first. */
function countOptions(
  values: string[],
  format: (v: string) => string = (v) => v
): Option[] {
  const counts = new Map<string, Option>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count!++;
    else counts.set(key, { value: v, label: format(v), count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count! - a.count! || a.label.localeCompare(b.label)
  );
}
