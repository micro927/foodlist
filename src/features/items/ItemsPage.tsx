import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpDown, Plus, UserRound } from "lucide-react";
import {
  countOptions,
  EmptyState,
  fabClass,
  FilterChip,
  GridSkeleton,
  OptionRow,
  PageTitle,
  SearchField,
  ViewToggle,
  type Option,
} from "@/components/browse";
import { Button, Chip, Sheet, useSticky } from "@/components/ui";
import { usePlanCounts, useItems } from "@/lib/data";
import { setMe, useMe } from "@/lib/device";
import { sections } from "@/lib/sections";
import type { Item, Section } from "@/lib/types";
import { local } from "@/lib/utils";
import { coupleById, trip, type CoupleId } from "@/trip.config";
import { useOpenSheet } from "../sheets";
import { ItemCard, ItemRow } from "./ItemCard";

type Interest = "both" | CoupleId | "none";
type Filters = {
  category: string | null;
  area: string | null;
  interest: Interest | null;
  planned: "planned" | "unplanned" | null;
};
type SortKey = "best" | "newest" | "name" | "category";

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
    label: `${c.emoji} Only ${c.name}`,
  })),
  { value: "none", label: "🤷 No one yet" },
];

const plannedOptions: Option[] = [
  { value: "planned", label: "📅 In the plan" },
  { value: "unplanned", label: "🗒️ Not planned yet" },
];

const allCouples = (r: Item) =>
  trip.couples.every((c) => r.interested.includes(c.id));

/** The Eats or Places tab. */
export function ItemsPage({ section }: { section: Section }) {
  const meta = sections[section];
  const { data: items = [], isPending } = useItems(section);
  const counts = usePlanCounts(section);
  const openSheet = useOpenSheet();
  const me = useMe();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [sort, setSortState] = useState<SortKey>(
    () => (local.get(`${meta.storagePrefix}sort`) as SortKey) || "name"
  );
  const [view, setViewState] = useState<"grid" | "list">(() =>
    local.get(`${meta.storagePrefix}view`) === "grid" ? "grid" : "list"
  );
  const [picker, setPicker] = useState<keyof Filters | "sort" | "me" | null>(
    null
  );

  const setSort = (s: SortKey) => (
    setSortState(s),
    local.set(`${meta.storagePrefix}sort`, s)
  );
  const setView = (v: "grid" | "list") => (
    setViewState(v),
    local.set(`${meta.storagePrefix}view`, v)
  );

  const categoryOptions = useMemo(
    () =>
      countOptions(
        items.map((r) => r.category),
        (c) => `${meta.emoji(c)} ${c}`
      ),
    [items, meta]
  );
  const areaOptions = useMemo(
    () => countOptions(items.map((r) => r.area)),
    [items]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((r) => {
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
      // A single couple means only them — items everyone wants live under "Both want".
      if (
        filters.interest &&
        filters.interest !== "both" &&
        filters.interest !== "none" &&
        (r.interested.length !== 1 || r.interested[0] !== filters.interest)
      )
        return false;
      if (filters.planned === "planned" && !counts.get(r.id)) return false;
      if (filters.planned === "unplanned" && counts.get(r.id)) return false;
      return true;
    });
    const newest = (a: Item, b: Item) =>
      b.created_at.localeCompare(a.created_at);
    const compare: Record<SortKey, (a: Item, b: Item) => number> = {
      best: (a, b) => b.interested.length - a.interested.length || newest(a, b),
      newest,
      name: (a, b) => a.name.localeCompare(b.name),
      category: (a, b) =>
        (a.category || "~").localeCompare(b.category || "~") ||
        a.name.localeCompare(b.name),
    };
    return list.sort(compare[sort]);
  }, [items, query, filters, sort, counts]);

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
  const addItem = () => openSheet({ kind: "form", section });

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center gap-2">
            <PageTitle title={meta.title} count={items.length} />
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
            <ViewToggle view={view} onChange={setView} />
          </div>

          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search name, area, notes…"
          />

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
          <GridSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            emoji={meta.empty.emoji}
            title={`No ${meta.nouns} yet`}
            body={meta.empty.body}
            action={`Add a ${meta.noun}`}
            onAction={addItem}
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
                  <ItemCard
                    section={section}
                    item={r}
                    planned={counts.get(r.id) ?? 0}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {visible.map((r) => (
              <ItemRow
                key={r.id}
                section={section}
                item={r}
                planned={counts.get(r.id) ?? 0}
              />
            ))}
          </div>
        )}
      </main>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={fabClass}
      >
        <Button className="h-14 px-6 text-base shadow-lg" onClick={addItem}>
          <Plus className="size-5" strokeWidth={2.5} /> Add{" "}
          {meta.noun}
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
