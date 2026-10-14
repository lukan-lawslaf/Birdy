import React, { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./lib/ThemeContext";
import { AppNav } from "./components/AppNav";
import { LandingPage } from "./pages/LandingPage";
import { AtlasPage } from "./pages/AtlasPage";
import { EncyclopediaPage } from "./pages/EncyclopediaPage";
import { MOCK_BIRDS, BirdSpecies } from "./data/mockBirds";
import { CinematicIntroOverlay } from "./components/CinematicIntroOverlay";
import { Search, X, Feather, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectBird,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectBird: (b: BirdSpecies) => void;
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const results = query.trim()
    ? MOCK_BIRDS.filter(
        (b) =>
          b.name.toLowerCase().includes(query.toLowerCase()) ||
          b.commonName.toLowerCase().includes(query.toLowerCase()) ||
          b.scientificName.toLowerCase().includes(query.toLowerCase()) ||
          b.family.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 select-none">
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
            <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((bird) => (
                  <div
                    key={bird.id}
                    onClick={() => {
                      onClose();
                      onSelectBird(bird);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--chip)] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={bird.imageUrl}
                        alt={bird.name}
                        className="w-10 h-10 object-contain rounded-lg bg-[var(--bg)] p-1 border border-[var(--line)]"
                      />
                      <div>
                        <div className="text-sm font-semibold text-[var(--ink)] font-display group-hover:text-[var(--sage)]">
                          {bird.name}
                        </div>
                        <div className="text-xs text-[var(--muted)] italic font-display">
                          {bird.scientificName} · {bird.family}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--sage)] transition-transform group-hover:translate-x-1" />
                  </div>
                ))}
              </div>
            ) : query.trim() ? (
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

  return (
    <ThemeProvider>
      <BrowserRouter>
        {/* Cinematic Intro & Animated Kingfisher Loading Overlay */}
        <CinematicIntroOverlay />

        <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans transition-colors duration-600">
          <AppNav onOpenSearch={() => setIsSearchOpen(true)} />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/atlas" element={<AtlasPage />} />
              <Route path="/catalog" element={<EncyclopediaPage />} />
            </Routes>
          </main>
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectBird={() => {}}
          />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
