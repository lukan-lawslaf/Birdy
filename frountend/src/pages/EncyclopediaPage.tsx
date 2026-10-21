import { conservationLabel } from "../lib/conservation";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BirdSpecies } from "../data/mockBirds";
import { BirdCard } from "../components/BirdCard";
import { BirdDetailModal } from "../components/BirdDetailModal";
import { fromListItem } from "../lib/adapt";
import {
  ApiError,
  getFilters,
  listSpecies,
  type FilterOptions,
  type SpeciesQuery,
} from "../lib/api";
import {
  Search,
  LayoutGrid,
  List,
  Sparkles,
  Feather,
  Weight,
  Compass,
  Radio,
  Loader2,
  TriangleAlert,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

const PAGE_SIZE = 24;



export const EncyclopediaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlFamily = searchParams.get("family") ?? "";
  const urlStatus = searchParams.get("iucn") ?? "all";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("all");
  const [selectedFamily, setSelectedFamily] = useState(urlFamily);
  const [selectedStatus, setSelectedStatus] = useState(urlStatus);
  const [sortBy, setSortBy] = useState<"taxonomic" | "name" | "family">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [activeModalBird, setActiveModalBird] = useState<BirdSpecies | null>(null);

  // A new catalogue link is a fresh view, including links from global search,
  // the family tree, the agent and the conservation section of the footer.
  useEffect(() => {
    setSearchQuery(urlQuery);
    setSelectedOrder("all");
    setSelectedFamily(urlFamily);
    setSelectedStatus(urlStatus);
    setPage(1);
  }, [urlQuery, urlFamily, urlStatus]);

  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [birds, setBirds] = useState<BirdSpecies[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFilters()
      .then(setFilters)
      .catch(() => setFilters(null));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const request: SpeciesQuery = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      order: selectedOrder === "all" ? undefined : selectedOrder,
      family: selectedFamily || undefined,
      iucn: selectedStatus === "all" ? undefined : selectedStatus,
      sort: sortBy,
      page,
      page_size: PAGE_SIZE,
    }),
    [debouncedQuery, selectedOrder, selectedFamily, selectedStatus, sortBy, page]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listSpecies(request)
      .then((result) => {
        if (cancelled) return;
        setBirds(result.items.map(fromListItem));
        setTotal(result.total);
        setPages(Math.max(result.pages, 1));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load the catalogue.");
        setBirds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedOrder("all");
    setSelectedFamily("");
    setSelectedStatus("all");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] px-4 sm:px-6 lg:px-12 py-10 max-w-7xl mx-auto transition-colors duration-600">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--sage)] uppercase tracking-widest mb-2 font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Curated Field Taxonomy</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--ink)] font-display tracking-tight">
          Birdpedia Species Catalog
        </h1>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl font-light">
          Browse, filter, and study taxonomic records, morphology datasets, and anatomical
          characteristics across world species.
        </p>
      </div>

      {/* Control Bar */}
      <div className="p-4 sm:p-5 rounded-3xl liquid-glass-elevated liquid-bevel mb-10 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by common name or scientific binomial…"
              className="w-full pl-10 pr-4 py-2.5 rounded-full liquid-glass-capsule border border-[rgba(var(--line-rgb),0.8)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--sage)] transition-all shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Taxonomic Order Filter */}
            <select
              value={selectedOrder}
              onChange={(e) => {
                setSelectedOrder(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.75)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer max-w-[180px]"
            >
              <option value="all" className="bg-[var(--panel)] text-[var(--ink)]">
                All Orders{filters ? ` (${filters.orders.length})` : ""}
              </option>
              {filters?.orders.map((ord) => (
                <option key={ord} value={ord} className="bg-[var(--panel)] text-[var(--ink)]">
                  {ord}
                </option>
              ))}
            </select>

            {/* Family Filter — filled by /species/filters and by phylogeny links */}
            <select
              value={selectedFamily}
              onChange={(e) => {
                setSelectedFamily(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.75)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer max-w-[220px]"
            >
              <option value="" className="bg-[var(--panel)] text-[var(--ink)]">
                All Families{filters ? ` (${filters.families.length})` : ""}
              </option>
              {/* Keep a deep-linked family selectable even before filters arrive. */}
              {selectedFamily &&
                !filters?.families.includes(selectedFamily) && (
                  <option value={selectedFamily} className="bg-[var(--panel)] text-[var(--ink)]">
                    {selectedFamily}
                  </option>
                )}
              {filters?.families.map((family) => (
                <option key={family} value={family} className="bg-[var(--panel)] text-[var(--ink)]">
                  {family}
                </option>
              ))}
            </select>

            {/* IUCN Status Filter */}
            <select
              aria-label="Conservation status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.75)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer"
            >
              <option value="all" className="bg-[var(--panel)] text-[var(--ink)]">
                All IUCN Statuses
              </option>
              {(filters?.iucn_categories ?? ["LC", "NT", "VU", "EN", "CR"]).map((code) => (
                <option key={code} value={code} className="bg-[var(--panel)] text-[var(--ink)]">
                  {conservationLabel(code)}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as typeof sortBy);
                setPage(1);
              }}
              className="px-3.5 py-2 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.75)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer"
            >
              <option value="name" className="bg-[var(--panel)] text-[var(--ink)]">Sort: Name (A-Z)</option>
              <option value="taxonomic" className="bg-[var(--panel)] text-[var(--ink)]">Sort: Taxonomic</option>
              <option value="family" className="bg-[var(--panel)] text-[var(--ink)]">Sort: Family</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 liquid-glass-capsule p-1 rounded-xl border border-[rgba(var(--line-rgb),0.75)]">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                title="List View"
                aria-label="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)]">
          <span className="flex items-center gap-1.5">
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {loading ? (
              "Reading the atlas…"
            ) : (
              <>
                Showing <strong className="text-[var(--ink)]">{birds.length}</strong> of{" "}
                <strong className="text-[var(--ink)]">{total.toLocaleString()}</strong> species
              </>
            )}
          </span>
          {(searchQuery || selectedOrder !== "all" || selectedFamily || selectedStatus !== "all") && (
            <button onClick={resetFilters} className="text-[var(--sage)] hover:underline cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-10 mb-8 rounded-3xl bg-[var(--panel)] border border-[var(--line)] text-center shadow-sm space-y-3">
          <TriangleAlert className="w-6 h-6 text-[#c4923f] mx-auto" />
          <p className="text-sm text-[var(--ink)] font-semibold font-display">{error}</p>
          <p className="text-xs text-[var(--muted)]">
            Start the backend with <code className="font-mono">uvicorn app.main:app --reload</code>
          </p>
        </div>
      )}

      {/* Grid or List Display */}
      {!error &&
        (loading && birds.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-[380px] rounded-2xl liquid-glass animate-pulse border border-[var(--line)]"
              />
            ))}
          </div>
        ) : birds.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {birds.map((bird) => (
                <BirdCard
                  key={bird.id}
                  bird={bird}
                  onSelect={(selected) => setActiveModalBird(selected)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {birds.map((bird) => {
                const isVulnerable =
                  bird.conservation?.threatened ||
                  bird.iucnCategory === "VU" ||
                  bird.iucnCategory === "EN" || bird.iucnCategory === "CR";
                return (
                  <div
                    key={bird.id}
                    onClick={() => setActiveModalBird(bird)}
                    className="group p-4 sm:p-5 rounded-2xl liquid-glass liquid-bevel hover:border-[var(--sage)] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer shadow-md hover:shadow-xl"
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-16 h-16 rounded-xl bg-[rgba(var(--bg-rgb),0.7)] p-1.5 flex items-center justify-center shrink-0 border border-[rgba(var(--line-rgb),0.7)] overflow-hidden">
                        {bird.imageUrl ? (
                          <img
                            src={bird.imageUrl}
                            alt={bird.name}
                            loading="lazy"
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Feather className="w-6 h-6 text-[var(--muted)]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[var(--ink)] font-display group-hover:text-[var(--sage)] transition-colors">
                            {bird.name}
                          </h3>
                          {bird.telemetry?.hasTracking && (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-mono text-[var(--sage)] bg-[var(--sage-tint)] px-2 py-0.5 rounded-full border border-[var(--sage)]/25">
                              <Radio className="w-2.5 h-2.5 animate-pulse" />
                              GPS Tracked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted)] italic font-display">
                          {bird.scientificName} · {bird.family}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate max-w-md">
                          {bird.habitat}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-6 w-full md:w-auto text-xs text-[var(--muted)]">
                      <div className="hidden sm:flex items-center gap-1.5" title="Body Mass">
                        <Weight className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span className="font-semibold text-[var(--ink)]">{bird.massG}</span>
                      </div>

                      <div className="flex items-center gap-1.5" title="Wing length">
                        <Feather className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span className="font-semibold text-[var(--ink)]">{bird.wingspanCm}</span>
                      </div>

                      <div className="hidden lg:flex items-center gap-1.5" title="Trophic Niche">
                        <Compass className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span className="font-semibold text-[var(--ink)] truncate max-w-[120px]">
                          {bird.ecology?.trophicNiche || bird.diet}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border ${
                          isVulnerable
                            ? "bg-[#b28236]/15 text-[#c4923f] border-[#b28236]/30"
                            : "liquid-glass-capsule text-[var(--muted)] border-[rgba(var(--line-rgb),0.6)]"
                        }`}
                      >
                        {bird.conservation?.rlLabel || bird.iucnLabel}
                      </span>

                      <button className="px-4 py-1.5 rounded-full text-xs font-semibold liquid-pill-btn text-[var(--sage-ink)] shadow-md cursor-pointer">
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="p-16 rounded-3xl bg-[var(--panel)] border border-[var(--line)] text-center shadow-sm">
            <p className="text-base text-[var(--ink)] font-semibold mb-1 font-display">
              No species matched your filters
            </p>
            <p className="text-xs text-[var(--muted)]">Try adjusting your order or status selections.</p>
          </div>
        ))}

      {/* Pagination */}
      {!error && !loading && pages > 1 && (
        <div className="flex items-center justify-center gap-3.5 mt-12">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              page === 1
                ? "liquid-glass-capsule text-[var(--muted)] cursor-not-allowed opacity-40"
                : "liquid-glass-capsule text-[var(--ink)] hover:border-[var(--sage)] hover:scale-105 active:scale-95 shadow-sm"
            }`}
            aria-label="Previous page"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-[var(--muted)] px-3 font-semibold">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
            disabled={page >= pages}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              page >= pages
                ? "liquid-glass-capsule text-[var(--muted)] cursor-not-allowed opacity-40"
                : "liquid-pill-btn text-[var(--sage-ink)] shadow-md hover:scale-105 active:scale-95"
            }`}
            aria-label="Next page"
          >
            <ArrowRight className="w-4 h-4 font-bold" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <BirdDetailModal bird={activeModalBird} onClose={() => setActiveModalBird(null)} />
    </div>
  );
};
