import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpDown, MapPin, Plus } from "lucide-react";
import {
  EmptyState,
  fabClass,
  GridSkeleton,
  OptionRow,
  PageTitle,
  SearchField,
  ViewToggle,
  type Option,
} from "@/components/browse";
import { Cover } from "@/components/Cover";
import { Button, Chip, Sheet } from "@/components/ui";
import { useAreas } from "@/lib/data";
import type { Area } from "@/lib/types";
import { local } from "@/lib/utils";
import { goodForById, trip, type GoodForId } from "@/trip.config";
import { useOpenSheet } from "../sheets";
import { areaEmoji, useAreaItems } from "./areaItems";

type SortKey = "name" | "newest";
const sortOptions: Option[] = [
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
];
const SORT_KEY = "foodlist:areas:sort";
const VIEW_KEY = "foodlist:areas:view";

export function AreasPage() {
  const { data: areas = [], isPending } = useAreas();
  const openSheet = useOpenSheet();

  const [query, setQuery] = useState("");
  const [goodFor, setGoodFor] = useState<GoodForId[]>([]);
  const [sort, setSortState] = useState<SortKey>(() =>
    local.get(SORT_KEY) === "newest" ? "newest" : "name"
  );
  const [view, setViewState] = useState<"grid" | "list">(() =>
    local.get(VIEW_KEY) === "grid" ? "grid" : "list"
  );
  const [sorting, setSorting] = useState(false);

  const setSort = (s: SortKey) => (setSortState(s), local.set(SORT_KEY, s));
  const setView = (v: "grid" | "list") => (
    setViewState(v),
    local.set(VIEW_KEY, v)
  );
  const toggleGoodFor = (id: GoodForId) =>
    setGoodFor((list) =>
      list.includes(id) ? list.filter((g) => g !== id) : [...list, id]
    );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = areas.filter((a) => {
      if (q && ![a.name, a.notes ?? ""].some((v) => v.toLowerCase().includes(q)))
        return false;
      // Every picked tag must apply: each one narrows the list.
      return goodFor.every((g) => a.good_for.includes(g));
    });
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.created_at.localeCompare(a.created_at)
    );
  }, [areas, query, goodFor, sort]);

  const addArea = () => openSheet({ kind: "areaForm" });

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center gap-2">
            <PageTitle title="Areas" count={areas.length} />
            <ViewToggle view={view} onChange={setView} />
          </div>

          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search name, notes…"
          />

          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-3">
            <Chip onClick={() => setSorting(true)}>
              <ArrowUpDown className="size-3.5" />{" "}
              {sortOptions.find((o) => o.value === sort)?.label}
            </Chip>
            {trip.goodFor.map((g) => (
              <Chip
                key={g.id}
                active={goodFor.includes(g.id)}
                onClick={() => toggleGoodFor(g.id)}
              >
                {g.emoji} {g.label}
              </Chip>
            ))}
            {goodFor.length > 0 && (
              <Chip
                onClick={() => setGoodFor([])}
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
        ) : areas.length === 0 ? (
          <EmptyState
            emoji="🗺️"
            title="No areas yet"
            body="Add a neighbourhood and what it's good for."
            action="Add an area"
            onAction={addArea}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="Nothing matches"
            body="Try a different search or fewer tags."
            action="Clear filters"
            onAction={() => {
              setGoodFor([]);
              setQuery("");
            }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                >
                  <AreaCard area={a} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {visible.map((a) => (
              <AreaRow key={a.id} area={a} />
            ))}
          </div>
        )}
      </main>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={fabClass}
      >
        <Button className="h-14 px-6 text-base shadow-lg" onClick={addArea}>
          <Plus className="size-5" strokeWidth={2.5} /> Add area
        </Button>
      </motion.div>

      <Sheet open={sorting} onClose={() => setSorting(false)} title="Sort by">
        <ul className="space-y-1">
          {sortOptions.map((o) => (
            <OptionRow
              key={o.value}
              label={o.label}
              selected={sort === o.value}
              onClick={() => {
                setSort(o.value as SortKey);
                setSorting(false);
              }}
            />
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

const goodForEmoji = (a: Area) =>
  a.good_for.map((g) => goodForById(g)?.emoji).join(" ");

function Counts({ area }: { area: Area }) {
  const { eats, places } = useAreaItems(area);
  const parts = [
    eats.length > 0 && `${eats.length} ${eats.length === 1 ? "restaurant" : "restaurants"}`,
    places.length > 0 && `${places.length} ${places.length === 1 ? "place" : "places"}`,
  ].filter(Boolean);
  return <>{parts.join(" · ")}</>;
}

function AreaCard({ area }: { area: Area }) {
  const openSheet = useOpenSheet();
  return (
    <article
      onClick={() => openSheet({ kind: "area", id: area.id })}
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition active:scale-[0.98]"
    >
      <Cover of={area} emoji={areaEmoji} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col p-3 pt-2.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold">
          {area.name}
        </h3>
        <p className="mt-0.5 truncate text-sm">{goodForEmoji(area) || " "}</p>
        <p className="mt-auto truncate pt-1.5 text-xs text-muted">
          <Counts area={area} />
        </p>
      </div>
    </article>
  );
}

function AreaRow({ area }: { area: Area }) {
  const openSheet = useOpenSheet();
  return (
    <article
      onClick={() => openSheet({ kind: "area", id: area.id })}
      className="flex cursor-pointer items-center gap-3 p-2.5 pr-3 transition active:bg-canvas"
    >
      <Cover
        of={area}
        emoji={areaEmoji}
        className="size-16 shrink-0 rounded-2xl"
        emojiClass="text-2xl"
      />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold">
          {area.name}
        </h3>
        <p className="truncate text-sm">{goodForEmoji(area) || "—"}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {area.maps_url && (
            <a
              href={area.maps_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 font-semibold text-primary"
            >
              <MapPin className="size-3" /> Map
            </a>
          )}
          <span className="truncate">
            <Counts area={area} />
          </span>
        </div>
      </div>
    </article>
  );
}
