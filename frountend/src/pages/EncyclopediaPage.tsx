import React, { useState, useMemo } from "react";
import { MOCK_BIRDS, BirdSpecies } from "../data/mockBirds";
import { BirdCard } from "../components/BirdCard";
import { BirdDetailModal } from "../components/BirdDetailModal";
import { 
  Search, 
  LayoutGrid, 
  List, 
  Sparkles,
  Feather
} from "lucide-react";

export const EncyclopediaPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "wingspan" | "mass">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeModalBird, setActiveModalBird] = useState<BirdSpecies | null>(null);

  // Extract unique orders
  const availableOrders = useMemo(() => {
    return Array.from(new Set(MOCK_BIRDS.map((b) => b.order))).sort();
  }, []);

  const filteredAndSortedBirds = useMemo(() => {
    return MOCK_BIRDS.filter((bird) => {
      const matchSearch =
        bird.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.scientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.habitat.toLowerCase().includes(searchQuery.toLowerCase());

      const matchOrder = selectedOrder === "all" || bird.order === selectedOrder;
      const matchStatus = selectedStatus === "all" || bird.iucnCategory === selectedStatus;

      return matchSearch && matchOrder && matchStatus;
    }).sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "wingspan") {
        return parseFloat(b.wingspanCm) - parseFloat(a.wingspanCm);
      }
      if (sortBy === "mass") {
        return parseFloat(b.massG) - parseFloat(a.massG);
      }
      return 0;
    });
  }, [searchQuery, selectedOrder, selectedStatus, sortBy]);

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
          Browse, filter, and study taxonomic records, morphology datasets, and anatomical characteristics across world species.
        </p>
      </div>

      {/* Control Bar: Filters, Search, Sort & View Mode */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] mb-10 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by common name, scientific binomial, family, or habitat…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--sage)] focus:ring-1 focus:ring-[var(--sage)]"
            />
          </div>

          {/* Quick Selects */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Taxonomic Order Filter */}
            <select
              value={selectedOrder}
              onChange={(e) => setSelectedOrder(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer"
            >
              <option value="all">All Orders</option>
              {availableOrders.map((ord) => (
                <option key={ord} value={ord}>
                  {ord}
                </option>
              ))}
            </select>

            {/* IUCN Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer"
            >
              <option value="all">All IUCN Statuses</option>
              <option value="LC">Least Concern (LC)</option>
              <option value="VU">Vulnerable (VU)</option>
              <option value="EN">Endangered (EN)</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--muted)] focus:text-[var(--ink)] focus:outline-none focus:border-[var(--sage)] cursor-pointer"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="wingspan">Sort: Wingspan</option>
              <option value="mass">Sort: Body Mass</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-xl border border-[var(--line)]">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "grid" ? "bg-[var(--sage)] text-[var(--sage-ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "list" ? "bg-[var(--sage)] text-[var(--sage-ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                title="List View"
                aria-label="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Count bar */}
        <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)]">
          <span>
            Showing <strong className="text-[var(--ink)]">{filteredAndSortedBirds.length}</strong> species
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[var(--sage)] hover:underline cursor-pointer"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Grid or List Display */}
      {filteredAndSortedBirds.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredAndSortedBirds.map((bird) => (
              <BirdCard
                key={bird.id}
                bird={bird}
                onSelect={(selected) => setActiveModalBird(selected)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedBirds.map((bird) => (
              <div
                key={bird.id}
                onClick={() => setActiveModalBird(bird)}
                className="group p-4 sm:p-5 rounded-2xl bg-[var(--panel)] hover:bg-[var(--chip)] border border-[var(--line)] hover:border-[var(--sage)] transition-all flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-16 h-16 rounded-xl bg-[var(--bg)] p-1.5 flex items-center justify-center shrink-0 border border-[var(--line)]">
                    <img
                      src={bird.imageUrl}
                      alt={bird.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--ink)] font-display group-hover:text-[var(--sage)] transition-colors">
                      {bird.name}
                    </h3>
                    <p className="text-xs text-[var(--muted)] italic font-display">
                      {bird.scientificName} · {bird.family}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">{bird.habitat}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto text-xs text-[var(--muted)]">
                  <div className="flex items-center gap-1.5">
                    <Feather className="w-3.5 h-3.5 text-[var(--sage)]" />
                    <span className="font-semibold text-[var(--ink)]">{bird.wingspanCm}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[var(--bg)] text-[10px] font-mono border border-[var(--line)]">
                    {bird.iucnLabel}
                  </span>
                  <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90">
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="p-16 rounded-3xl bg-[var(--panel)] border border-[var(--line)] text-center shadow-sm">
          <p className="text-base text-[var(--ink)] font-semibold mb-1 font-display">No species matched your filters</p>
          <p className="text-xs text-[var(--muted)]">Try adjusting your order or status selections.</p>
        </div>
      )}

      {/* Detail Modal */}
      <BirdDetailModal
        bird={activeModalBird}
        onClose={() => setActiveModalBird(null)}
      />
    </div>
  );
};
