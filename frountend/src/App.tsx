import React, { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./lib/ThemeContext";
import { AppNav } from "./components/AppNav";
import { AgentPopup } from "./components/AgentPopup";
import { LandingPage } from "./pages/LandingPage";
import { CinematicIntroOverlay } from "./components/CinematicIntroOverlay";
import { assetUrl, searchSpecies, type SpeciesListItem } from "./lib/api";
import { Search, X, Feather, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const AtlasPage = lazy(() => import("./pages/AtlasPage").then((m) => ({ default: m.AtlasPage })));
const EncyclopediaPage = lazy(() => import("./pages/EncyclopediaPage").then((m) => ({ default: m.EncyclopediaPage })));
const FlywaysPage = lazy(() => import("./pages/FlywaysPage").then((m) => ({ default: m.FlywaysPage })));
const PhylogenyPage = lazy(() => import("./pages/PhylogenyPage").then((m) => ({ default: m.PhylogenyPage })));

function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectBird,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectBird: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpeciesListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Debounced server search — the catalogue is ~11,000 species, so filtering a
  // local copy is no longer possible and a request per keystroke is wasteful.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const id = setTimeout(() => {
      searchSpecies(term, 6)
        .then((page) => {
          if (!cancelled) setResults(page.items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div role="dialog" aria-modal="true" aria-label="Search birds" className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-xl rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl p-4 z-10 text-[var(--ink)]"
        >
          <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--line)]">
            <Search className="w-5 h-5 text-[var(--sage)]" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by bird name, Latin binomial, or family..."
              className="w-full bg-transparent text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none"
            />
            <button onClick={onClose} aria-label="Close search" className="text-[var(--muted)] hover:text-[var(--ink)] p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--muted)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching the atlas…
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((bird) => (
                  <button type="button"
                    key={bird.scientific_name}
                    onClick={() => {
                      onClose();
                      onSelectBird(bird.scientific_name);
                    }}
                    className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--chip)] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {bird.image_url ? (
                        <img
                          src={assetUrl(bird.image_url)}
                          alt={bird.common_name ?? bird.scientific_name}
                          loading="lazy"
                          className="w-10 h-10 object-contain rounded-lg bg-[var(--bg)] p-1 border border-[var(--line)] shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center shrink-0">
                          <Feather className="w-4 h-4 text-[var(--muted)]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--ink)] font-display group-hover:text-[var(--sage)] truncate">
                          {bird.common_name ?? bird.scientific_name}
                        </div>
                        <div className="text-xs text-[var(--muted)] italic font-display truncate">
                          {bird.scientific_name}
                          {bird.family ? ` · ${bird.family}` : ""}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--sage)] transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            ) : query.trim().length >= 2 ? (
              <div className="text-center py-8 text-xs text-[var(--muted)]">
                No birds found matching "{query}".
              </div>
            ) : (
              <div className="px-3 py-4 text-xs text-[var(--muted)]">
                <div className="font-semibold text-[var(--ink)] mb-2">Quick Navigation</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/atlas");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--chip)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer"
                  >
                    <Feather className="w-3.5 h-3.5 text-[var(--sage)]" />
                    <span>3D Feather Atlas</span>
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/catalog");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--chip)] hover:bg-[var(--line)] text-[var(--ink)] cursor-pointer"
                  >
                    <span>Browse All 11,000+ Species</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, location.search]);

  // Only search lives here — the modal is above the router's pages, so a
  // selection has to navigate rather than open an in-page modal.
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setIsSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans transition-colors duration-600">
        <CinematicIntroOverlay />
        <AppNav onOpenSearch={() => setIsSearchOpen(true)} />
        <main className="flex-1">
          <Suspense fallback={<div role="status" className="min-h-[60vh] flex items-center justify-center text-[var(--muted)]">Opening the field guide…</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/atlas" element={<AtlasPage />} />
            <Route path="/flyways" element={<FlywaysPage />} />
            <Route path="/phylogeny" element={<PhylogenyPage />} />
            <Route path="/catalog" element={<EncyclopediaPage />} />
          </Routes>
          </Suspense>
        </main>
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectBird={(name) => navigate(`/catalog?q=${encodeURIComponent(name)}`)}
        />
        <AgentPopup />
      </div>
    </ThemeProvider>
  );
}

export default App;
