import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext";
import { MOCK_BIRDS, BIRD_CATEGORIES, BirdSpecies } from "../data/mockBirds";
import { BirdCard } from "../components/BirdCard";
import { BirdDetailModal } from "../components/BirdDetailModal";
import { SiteEnding } from "../components/SiteEnding";
import { CraneLandscapeBackdrop } from "../components/CraneLandscapeBackdrop";
import { 
  Sparkles, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Feather, 
  ChevronDown,
  Navigation2
} from "lucide-react";
import { motion } from "motion/react";

export const LandingPage: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("All Species");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeModalBird, setActiveModalBird] = useState<BirdSpecies | null>(null);

  const CARDS_PER_PAGE = 6;

  // Filter species based on category and search query
  const filteredBirds = useMemo(() => {
    return MOCK_BIRDS.filter((bird) => {
      const matchesSearch =
        bird.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.scientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bird.sublabel.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === "All Species") return true;
      if (selectedCategory === "Featured") return bird.featured;
      if (selectedCategory === "3D Specimens") return bird.has3dModel;
      if (selectedCategory === "Songbirds") return bird.order === "Passeriformes";
      if (selectedCategory === "Kingfishers") return bird.family === "Alcedinidae";
      if (selectedCategory === "Hummingbirds") return bird.family === "Trochilidae";
      if (selectedCategory === "Raptors") return bird.tags.includes("Raptor") || bird.order === "Falconiformes";
      if (selectedCategory === "Waterfowl") return bird.tags.includes("River bird") || bird.tags.includes("Pelagic");
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Paginated chunk (6 cards per page matching the 3x2 grid from user image)
  const totalPages = Math.ceil(filteredBirds.length / CARDS_PER_PAGE) || 1;
  const currentBirds = useMemo(() => {
    const start = currentPage * CARDS_PER_PAGE;
    return filteredBirds.slice(start, start + CARDS_PER_PAGE);
  }, [filteredBirds, currentPage]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  return (
    <div className="relative min-h-screen text-[var(--ink)] overflow-x-hidden selection:bg-[var(--sage)] selection:text-[var(--sage-ink)]">
      {/* 0. Continuous Living Crane Landscape Video Backdrop */}
      <CraneLandscapeBackdrop />

      {/* 1. Cinematic Hero Section (Full Viewport on desktop: Top 3/4th solid/tapered, bottom 1/4th reveals gliding cranes) */}
      <section className="relative z-10 min-h-[92vh] lg:min-h-[96vh] flex flex-col justify-between px-4 sm:px-6 lg:px-12 pt-10 sm:pt-14 pb-8 max-w-7xl mx-auto">
        {/* Atmospheric parchment gradient mask: Solid at top 50%, gentle dissolve 50-75%, 100% transparent below 3/4th mark */}
        <div
          className="absolute inset-x-0 -top-8 h-[110%] pointer-events-none -z-10 transition-all duration-700"
          style={{
            background:
              theme === "dusk"
                ? "linear-gradient(to bottom, #14170f 0%, #14170f 42%, rgba(20,23,15,0.92) 58%, rgba(20,23,15,0.45) 74%, transparent 92%)"
                : "linear-gradient(to bottom, #f6f1e7 0%, #f6f1e7 42%, rgba(246,241,231,0.92) 58%, rgba(246,241,231,0.45) 74%, transparent 92%)",
          }}
        />

        {/* Hero Content Top: Eyebrow, Display Typography, and Actions */}
        <div className="relative flex flex-col items-center text-center max-w-3xl mx-auto pt-4 sm:pt-6">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--panel)]/90 backdrop-blur-sm border border-[var(--line)] text-xs font-mono text-[var(--sage)] mb-5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>GLOBAL AVIAN ARCHIVE & SPECIMEN REPOSITORY</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--ink)] font-display leading-[1.08] mb-5"
          >
            Discover Earth’s <br />
            <span className="text-[var(--sage)] italic">
              Living Avian Splendor
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base lg:text-lg text-[var(--muted)] leading-relaxed max-w-2xl mb-7 font-light"
          >
            Explore 11,000+ species, animal-borne telemetry flyways, and
            millimeter-accurate 3D anatomical specimens with physical lighting and acoustic calls.
          </motion.p>

          {/* Hero CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3.5"
          >
            <a
              href="#birdpedia-showcase"
              className="px-7 py-3 rounded-full text-sm font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              Browse Birdpedia Cards
            </a>
            <Link
              to="/atlas"
              className="px-7 py-3 rounded-full text-sm font-semibold bg-[var(--panel)]/90 backdrop-blur-sm hover:bg-[var(--chip)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--sage)] shadow-sm transition-all flex items-center gap-2"
            >
              <Feather className="w-4 h-4 text-[var(--sage)]" />
              <span>Launch 3D Feather Atlas</span>
            </Link>
          </motion.div>
        </div>

        {/* Hero Bottom Horizon (At 3/4th line): Floating Frosted Metric Chips + Subtle Scroll Prompt */}
        <div className="relative mt-10 sm:mt-12 pt-4">
          {/* Global Statistics Floating Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--panel)]/80 backdrop-blur-md border border-[var(--line)]/80 text-center shadow-sm hover:border-[var(--sage)] transition-colors">
              <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--sage)] font-mono">11,009</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5 font-medium">AVONET Species Profiles</div>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--panel)]/80 backdrop-blur-md border border-[var(--line)]/80 text-center shadow-sm hover:border-[var(--sage)] transition-colors">
              <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--ink)] font-mono">708k+</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5 font-medium">Movebank GPS Fixes</div>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--panel)]/80 backdrop-blur-md border border-[var(--line)]/80 text-center shadow-sm hover:border-[var(--sage)] transition-colors">
              <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--sage)] font-mono">526</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5 font-medium">Vision Classifier Classes</div>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--panel)]/80 backdrop-blur-md border border-[var(--line)]/80 text-center shadow-sm hover:border-[var(--sage)] transition-colors">
              <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--ink)] font-mono">99.6%</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5 font-medium">Resolved Taxon Matching</div>
            </div>
          </div>

          {/* Living Horizon Notice & Downward Scroll Invitation */}
          <div className="flex flex-col items-center justify-center mt-6">
            <a
              href="#feather-spotlight"
              className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--panel)]/85 backdrop-blur-md border border-[var(--line)] text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--sage)] transition-all shadow-sm"
              aria-label="Scroll down to inspect specimens"
            >
              <span className="font-sans font-medium">Gliding Cranes at Horizon</span>
              <span className="text-[var(--line)]">·</span>
              <span className="text-[var(--sage)] font-semibold flex items-center gap-1">
                Explore Archive
                <ChevronDown className="w-3.5 h-3.5 animate-bounce group-hover:translate-y-0.5 transition-transform" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. Middle Journal Body: Translucent organic veil so cards & text are razor-sharp while the fixed crane backdrop gently breathes behind */}
      <div className="relative z-10 bg-[var(--bg)]/92 backdrop-blur-md transition-colors duration-600 border-y border-[var(--line)]/50 shadow-sm">
        {/* Soft top gradient dissolve */}
        <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-[var(--bg)]/92 to-transparent pointer-events-none" />

        {/* 2a. Interactive 3D Feature Spotlight Banner */}
        <section id="feather-spotlight" className="px-4 sm:px-6 lg:px-12 py-14 max-w-7xl mx-auto">
          <div className="relative rounded-3xl bg-[var(--panel)]/95 border border-[var(--line)] p-8 sm:p-12 overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
            <div className="max-w-xl text-left z-10">
              <span className="text-xs font-mono uppercase tracking-widest text-[var(--sage)] font-bold">
                LABORATORY FEATURE
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--ink)] font-display tracking-tight mt-2 mb-3">
                Feather Atlas: 3D Photorealistic Field Guide
              </h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed mb-6 font-light">
                Inspect real-time 3D specimens with micro-zoom optics, dynamic Day and Dusk sunlight
                simulation, and 360-degree rotational physics.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/atlas"
                  className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 shadow-sm transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                >
                  <span>Open 3D Stage (Kingfisher & Hoopoe)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-xs text-[var(--muted)] font-mono">WebGL · 60 FPS</span>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-36 sm:w-44 h-36 sm:h-44 rounded-2xl bg-[var(--bg)] border border-[var(--line)] p-3 flex flex-col items-center justify-center text-center shadow-sm group hover:border-[var(--sage)] transition-colors">
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_f9e3e60d-acdc-4925-b393-c4ce14b28711.png"
                  alt="Kingfisher"
                  className="w-20 h-20 object-contain drop-shadow group-hover:scale-105 transition-transform"
                />
                <span className="text-xs font-bold text-[var(--ink)] mt-2 font-display">Kingfisher</span>
                <span className="text-[10px] text-[var(--sage)] font-mono font-semibold">3D Specimen</span>
              </div>

              <div className="w-36 sm:w-44 h-36 sm:h-44 rounded-2xl bg-[var(--bg)] border border-[var(--line)] p-3 flex flex-col items-center justify-center text-center shadow-sm group hover:border-[var(--sage)] transition-colors">
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_21ed095c-d038-4ab5-87b7-b44e527ec449.png"
                  alt="Hoopoe"
                  className="w-20 h-20 object-contain drop-shadow group-hover:scale-105 transition-transform"
                />
                <span className="text-xs font-bold text-[var(--ink)] mt-2 font-display">Eurasian Hoopoe</span>
                <span className="text-[10px] text-[var(--sage)] font-mono font-semibold">3D Specimen</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2b. The Core Reference Section: "Birdpedia information" */}
        {/* (Faithfully reproduces the layout, cards, and pagination from the user's mockup with birds p.txt palette) */}
        <section id="birdpedia-showcase" className="px-4 sm:px-6 lg:px-12 py-10 max-w-7xl mx-auto">
          {/* Header from the user's mockup */}
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
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-[var(--line)]">
            {/* Category Chips */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {BIRD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCurrentPage(0);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                      : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] border border-[var(--line)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Instant Search Bar */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Search species, families…"
                className="w-full pl-10 pr-4 py-2 rounded-full bg-[var(--panel)] border border-[var(--line)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--sage)] focus:ring-1 focus:ring-[var(--sage)] transition-all"
              />
            </div>
          </div>

          {/* 3x2 Grid of Bird Cards */}
          {currentBirds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {currentBirds.map((bird) => (
                <BirdCard
                  key={bird.id}
                  bird={bird}
                  onSelect={(selected) => setActiveModalBird(selected)}
                />
              ))}
            </div>
          ) : (
            <div className="p-16 rounded-2xl bg-[var(--panel)] border border-[var(--line)] text-center shadow-sm">
              <p className="text-base text-[var(--ink)] font-semibold mb-1 font-display">No matching species found</p>
              <p className="text-xs text-[var(--muted)]">Try clearing your search query or selecting another category.</p>
            </div>
          )}

          {/* Bottom Pagination Controls matching the user's reference mockup:
              Left arrow (dark/panel circled button) + Right arrow (filled sage circle) */}
          <div className="flex items-center justify-center gap-3.5 mt-14">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                currentPage === 0
                  ? "bg-[var(--panel)]/50 border-[var(--line)] text-[var(--muted)] cursor-not-allowed opacity-40"
                  : "bg-[var(--panel)] hover:bg-[var(--chip)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--sage)] shadow-sm"
              }`}
              aria-label="Previous Page"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-[var(--muted)] px-3 font-semibold">
              {currentPage + 1} / {totalPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages - 1}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                currentPage >= totalPages - 1
                  ? "bg-[var(--panel)]/50 border border-[var(--line)] text-[var(--muted)] cursor-not-allowed opacity-40"
                  : "bg-[var(--sage)] hover:opacity-90 text-[var(--sage-ink)] shadow-sm active:scale-95"
              }`}
              aria-label="Next Page"
            >
              <ArrowRight className="w-4 h-4 font-bold" />
            </button>
          </div>
        </section>

        {/* 2c. Global Migration & Movebank Telemetry Teaser */}
        <section className="px-4 sm:px-6 lg:px-12 py-14 max-w-7xl mx-auto border-t border-[var(--line)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 rounded-3xl bg-[var(--panel)]/95 border border-[var(--line)]">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--sage)] uppercase tracking-wider font-semibold mb-2">
                <Navigation2 className="w-4 h-4" />
                <span>Telemetry Infrastructure</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-display text-[var(--ink)] mb-3">
                Real Animal-Borne GPS Migration Tracks
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                Birdpedia visualizes over 708,000 GPS coordinates from 34 Movebank studies tracking
                White Storks, Ospreys, Bar-tailed Godwits, and Sagebrush songbirds across continents.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/catalog"
                className="px-6 py-3 rounded-full text-xs font-semibold bg-[var(--chip)] text-[var(--ink)] hover:bg-[var(--line)] border border-[var(--line)] transition-colors"
              >
                Explore Full Archive
              </Link>
            </div>
          </div>
        </section>

        {/* Soft bottom gradient dissolve transitioning into the full-view ending */}
        <div className="absolute inset-x-0 -bottom-20 h-20 bg-gradient-to-b from-[var(--bg)]/92 to-transparent pointer-events-none" />
      </div>

      {/* 3. Species Detail Modal */}
      <BirdDetailModal
        bird={activeModalBird}
        onClose={() => setActiveModalBird(null)}
      />

      {/* 4. Heritage Crane Video Ending Section (Opens up to 100% full view of the background video) */}
      <div className="relative z-10">
        <SiteEnding />
      </div>
    </div>
  );
};
