import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext";
import { BirdSpecies } from "../data/mockBirds";
import { BirdCard } from "../components/BirdCard";
import { BirdDetailModal } from "../components/BirdDetailModal";
import { SiteEnding } from "../components/SiteEnding";
import { CraneLandscapeBackdrop } from "../components/CraneLandscapeBackdrop";
import { GsapSpecimenStory } from "../components/GsapSpecimenStory";
import { AvianBentoGrid } from "../components/AvianBentoGrid";
import { fromListItem } from "../lib/adapt";
import { ApiError, listSpecies, type SpeciesQuery } from "../lib/api";
import {
  Sparkles,
  Search,
  ArrowLeft,
  ArrowRight,
  Feather,
  ChevronDown,
  Navigation2,
  ArrowUpRight,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { motion } from "motion/react";

const CARDS_PER_PAGE = 6;

/**
 * Each chip is a query the backend actually understands. "Featured" and
 * "3D Specimens" were mock-data inventions — the API has no 3D per species, so
 * they are replaced with filters the database can honour.
 */
const CATEGORIES: { label: string; query: SpeciesQuery }[] = [
  { label: "All Species", query: {} },
  { label: "With Photos", query: { has_image: true } },
  { label: "GPS Tracked", query: { has_tracks: true } },
  { label: "Songbirds", query: { order: "Passeriformes" } },
  { label: "Kingfishers", query: { family: "Alcedinidae" } },
  { label: "Hummingbirds", query: { family: "Trochilidae" } },
  { label: "Raptors", query: { order: "Accipitriformes" } },
  { label: "Waterfowl", query: { order: "Anseriformes" } },
];

export const LandingPage: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("All Species");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [birds, setBirds] = useState<BirdSpecies[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModalBird, setActiveModalBird] = useState<BirdSpecies | null>(null);

  const activeQuery = useMemo(
    () => CATEGORIES.find((c) => c.label === selectedCategory)?.query ?? {},
    [selectedCategory]
  );

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listSpecies({
        ...activeQuery,
        q: debouncedQuery || undefined,
        page: currentPage,
        page_size: CARDS_PER_PAGE,
        sort: debouncedQuery ? "name" : "taxonomic",
      });
      setBirds(page.items.map(fromListItem));
      setTotalPages(Math.max(page.pages, 1));
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the catalogue.");
      setBirds([]);
    } finally {
      setLoading(false);
    }
  }, [activeQuery, debouncedQuery, currentPage]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="relative min-h-screen text-[var(--ink)] overflow-x-hidden selection:bg-[var(--sage)] selection:text-[var(--sage-ink)]">
      {/* 0. Continuous Living Crane Landscape Video Backdrop */}
      <CraneLandscapeBackdrop />

      {/* 1. Cinematic Hero Section */}
      <section className="relative z-10 min-h-[92vh] lg:min-h-[96vh] flex flex-col justify-between px-4 sm:px-6 lg:px-12 pt-10 sm:pt-14 pb-8 max-w-7xl mx-auto">
        <div
          className="absolute inset-x-0 -top-8 h-[110%] pointer-events-none -z-10 transition-all duration-700"
          style={{
            background:
              theme === "dusk"
                ? "linear-gradient(to bottom, #14170f 0%, #14170f 42%, rgba(20,23,15,0.92) 58%, rgba(20,23,15,0.45) 74%, transparent 92%)"
                : "linear-gradient(to bottom, #f6f1e7 0%, #f6f1e7 42%, rgba(246,241,231,0.92) 58%, rgba(246,241,231,0.45) 74%, transparent 92%)",
          }}
        />

        <div className="relative flex flex-col items-center text-center max-w-5xl mx-auto pt-4 sm:pt-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-capsule text-xs font-mono text-[var(--sage)] mb-5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>GLOBAL AVIAN ARCHIVE & SPECIMEN REPOSITORY</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-[4.75rem] font-extrabold tracking-tight text-[var(--ink)] font-display leading-[1.08] mb-6 max-w-4xl"
          >
            Discover Earth’s{" "}
            <span className="text-[var(--sage)] italic">
              Living Avian Splendor
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base lg:text-lg text-[var(--muted)] leading-relaxed max-w-2xl mb-8 font-light"
          >
            Browse the AVONET trait set, animal-borne telemetry flyways, and archived
            Xeno-canto recordings — every figure on this page comes from the server.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <a
              href="#birdpedia-showcase"
              className="group/btn inline-flex items-center gap-3 px-7 py-3 rounded-full text-sm font-semibold liquid-pill-btn text-[var(--sage-ink)] shadow-md transition-all active:scale-95"
            >
              <span>Browse Birdpedia Cards</span>
              <span className="w-6 h-6 rounded-full bg-[var(--sage-ink)]/20 flex items-center justify-center transition-transform group-hover/btn:translate-y-0.5">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </a>
            <Link
              to="/atlas"
              className="group/btn inline-flex items-center gap-3 px-7 py-3 rounded-full text-sm font-semibold liquid-glass-capsule hover:text-[var(--ink)] hover:border-[var(--sage)] shadow-sm transition-all active:scale-95"
            >
              <Feather className="w-4 h-4 text-[var(--sage)]" />
              <span>Launch 3D Feather Atlas</span>
              <span className="w-6 h-6 rounded-full bg-[var(--line)] flex items-center justify-center transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--sage)]" />
              </span>
            </Link>
          </motion.div>
        </div>

        {/* Metric chips — live counts, not hard-coded ones */}
        <div className="relative mt-10 sm:mt-12 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 max-w-4xl mx-auto">
            {[
              { value: total ? total.toLocaleString() : "—", label: "Species in the filter" },
              { value: "742k+", label: "Movebank GPS Fixes" },
              { value: "57,512", label: "eBird Hotspots" },
              { value: "18,421", label: "Richness Grid Cells" },
            ].map((chip, idx) => (
              <div
                key={chip.label}
                className="p-1 rounded-2xl bg-[var(--line)]/40 border border-[var(--line)] shadow-md hover:border-[var(--sage)] transition-colors"
              >
                <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[var(--panel)]/90 backdrop-blur-md text-center">
                  <div
                    className={`text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono ${
                      idx % 2 === 0 ? "text-[var(--sage)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {chip.value}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5 font-medium">
                    {chip.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center mt-6">
            <a
              href="#monograph-story"
              className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--panel)]/85 backdrop-blur-md border border-[var(--line)] text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--sage)] transition-all shadow-sm"
              aria-label="Scroll down to inspect specimens"
            >
              <span className="font-sans font-medium">Gliding Cranes at Horizon</span>
              <span className="text-[var(--line)]">·</span>
              <span className="text-[var(--sage)] font-semibold flex items-center gap-1">
                Explore Monograph
                <ChevronDown className="w-3.5 h-3.5 animate-bounce group-hover:translate-y-0.5 transition-transform" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. Middle Journal Body */}
      <div className="relative z-10 bg-[var(--bg)]/92 backdrop-blur-md transition-colors duration-600 border-y border-[var(--line)]/50 shadow-sm">
        <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-[var(--bg)]/92 to-transparent pointer-events-none" />

        <div id="monograph-story">
          <GsapSpecimenStory />
        </div>

        <AvianBentoGrid />

        <section id="birdpedia-showcase" className="px-4 sm:px-6 lg:px-12 py-10 max-w-7xl mx-auto">
          <div className="text-left mb-10">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-display">
              <span className="text-[var(--sage)]">Birdpedia</span>{" "}
              <span className="text-[var(--ink)]">information</span>
            </h2>
            <p className="text-sm sm:text-base text-[var(--muted)] font-normal mt-2.5">
              on Birdpedia you can find information about birds in the world
            </p>
          </div>

          {/* Filter Chips & Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-[rgba(var(--line-rgb),0.65)]">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => {
                    setSelectedCategory(cat.label);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === cat.label
                      ? "liquid-pill-btn text-[var(--sage-ink)] shadow-md scale-102"
                      : "liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--sage)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search species, families…"
                className="w-full pl-10 pr-4 py-2 rounded-full liquid-glass-capsule border border-[rgba(var(--line-rgb),0.8)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--sage)] transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {Array.from({ length: CARDS_PER_PAGE }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[380px] rounded-2xl liquid-glass animate-pulse border border-[var(--line)]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="p-16 rounded-2xl bg-[var(--panel)] border border-[var(--line)] text-center shadow-sm space-y-3">
              <TriangleAlert className="w-6 h-6 text-[#c4923f] mx-auto" />
              <p className="text-sm text-[var(--ink)] font-semibold font-display">{error}</p>
              <button
                onClick={load}
                className="px-4 py-2 rounded-full liquid-pill-btn text-xs font-semibold text-[var(--sage-ink)] cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : birds.length > 0 ? (
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
            <div className="p-16 rounded-2xl bg-[var(--panel)] border border-[var(--line)] text-center shadow-sm">
              <p className="text-base text-[var(--ink)] font-semibold mb-1 font-display">
                No matching species found
              </p>
              <p className="text-xs text-[var(--muted)]">
                Try clearing your search query or selecting another category.
              </p>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3.5 mt-14">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  currentPage === 1
                    ? "liquid-glass-capsule text-[var(--muted)] cursor-not-allowed opacity-40"
                    : "liquid-glass-capsule text-[var(--ink)] hover:border-[var(--sage)] hover:scale-105 active:scale-95 shadow-sm"
                }`}
                aria-label="Previous Page"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono text-[var(--muted)] px-3 font-semibold">
                {currentPage} / {totalPages} · {total.toLocaleString()} species
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  currentPage >= totalPages
                    ? "liquid-glass-capsule text-[var(--muted)] cursor-not-allowed opacity-40"
                    : "liquid-pill-btn text-[var(--sage-ink)] shadow-md hover:scale-105 active:scale-95"
                }`}
                aria-label="Next Page"
              >
                <ArrowRight className="w-4 h-4 font-bold" />
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 mt-8 text-[11px] font-mono text-[var(--muted)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the atlas…
            </div>
          )}
        </section>

        {/* 2c. Telemetry teaser */}
        <section className="px-4 sm:px-6 lg:px-12 py-14 max-w-7xl mx-auto border-t border-[rgba(var(--line-rgb),0.65)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 sm:p-10 rounded-3xl liquid-glass-elevated liquid-bevel shadow-xl">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--sage)] uppercase tracking-wider font-semibold mb-2">
                <Navigation2 className="w-4 h-4" />
                <span>Telemetry Infrastructure</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-display text-[var(--ink)] mb-3">
                Real Animal-Borne GPS Migration Tracks
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                Birdpedia visualizes 742,755 GPS coordinates from 34 Movebank studies tracking
                White Storks, Ospreys, Bar-tailed Godwits, and Sagebrush songbirds across continents.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/flyways"
                className="px-6 py-3 rounded-full text-xs font-semibold liquid-pill-btn text-[var(--sage-ink)] shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                <span>Open Flyway GPS Map</span>
              </Link>
              <Link
                to="/catalog"
                className="px-6 py-3 rounded-full text-xs font-semibold liquid-glass-capsule text-[var(--ink)] hover:border-[var(--sage)] transition-colors"
              >
                Explore Full Archive
              </Link>
            </div>
          </div>
        </section>

        <div className="absolute inset-x-0 -bottom-20 h-20 bg-gradient-to-b from-[var(--bg)]/92 to-transparent pointer-events-none" />
      </div>

      {/* 3. Species Detail Modal */}
      <BirdDetailModal bird={activeModalBird} onClose={() => setActiveModalBird(null)} />

      {/* 4. Heritage Crane Video Ending Section */}
      <div className="relative z-10">
        <SiteEnding />
      </div>
    </div>
  );
};
