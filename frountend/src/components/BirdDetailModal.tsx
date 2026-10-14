import React, { useState } from "react";
import { BirdSpecies } from "../data/mockBirds";
import { birdAudio } from "../lib/birdAudio";
import { Link } from "react-router-dom";
import { X, Feather, Compass, Globe2, Volume2, Sparkles, Ruler, Weight, UtensilsCrossed } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BirdDetailModalProps {
  bird: BirdSpecies | null;
  onClose: () => void;
}

export const BirdDetailModal: React.FC<BirdDetailModalProps> = ({ bird, onClose }) => {
  const [isPlayingSound, setIsPlayingSound] = useState(false);

  if (!bird) return null;

  const handlePlaySound = () => {
    setIsPlayingSound(true);
    birdAudio.play(bird.id);
    setTimeout(() => {
      setIsPlayingSound(false);
    }, 1800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--panel)] border border-[var(--line)] shadow-[0_25px_60px_-15px_rgba(var(--shadow),0.4)] z-10 flex flex-col md:flex-row text-[var(--ink)]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] border border-[var(--line)] transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Column: Specimen Image Stage */}
          <div className="relative w-full md:w-5/12 bg-[var(--bg)] p-8 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[var(--line)] min-h-[320px]">
            {/* Ambient Radial Spotlight */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 rounded-full bg-[var(--sage-tint)] blur-3xl opacity-60" />
            </div>

            {/* Badges */}
            <div className="w-full flex items-center justify-between z-10">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--sage)] bg-[var(--sage-tint)] px-3 py-1 rounded-full border border-[var(--sage)]/25 font-semibold">
                {bird.family}
              </span>
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)]">
                {bird.iucnLabel}
              </span>
            </div>

            {/* Bird Cutout */}
            <div className="relative my-6 flex items-center justify-center w-full z-10">
              <img
                src={bird.imageUrl}
                alt={bird.name}
                className="max-h-64 object-contain drop-shadow-[0_16px_30px_rgba(var(--shadow),0.35)]"
              />
            </div>

            {/* Live Procedural Vocalization Sound Button */}
            <div className="w-full z-10">
              <button
                onClick={handlePlaySound}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isPlayingSound
                    ? "bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage)] scale-[1.02]"
                    : "bg-[var(--chip)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--sage)]"
                }`}
              >
                <Volume2 className={`w-4 h-4 ${isPlayingSound ? "animate-bounce" : ""}`} />
                <span>{isPlayingSound ? "Singing vocalization…" : "Listen to vocal call"}</span>
              </button>
              {bird.soundDescription && (
                <p className="text-[11px] text-[var(--muted)] italic mt-2 text-center font-display">
                  "{bird.soundDescription}"
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Information Dossier */}
          <div className="w-full md:w-7/12 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="mb-4">
                <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
                  {bird.order}
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--ink)] font-display mt-1">
                  {bird.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-semibold text-[var(--sage)]">{bird.commonName}</p>
                  <span className="text-xs text-[var(--muted)]">·</span>
                  <p className="text-sm text-[var(--muted)] italic font-display">{bird.scientificName}</p>
                </div>
              </div>

              {/* Tag Pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {bird.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 rounded-full bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)] font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="text-sm text-[var(--ink)] leading-relaxed mb-6 font-normal">
                {bird.description}
              </p>

              {/* Morphometrics & Key Traits Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
                <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                    <Ruler className="w-3.5 h-3.5 text-[var(--sage)]" />
                    <span>Length</span>
                  </div>
                  <div className="text-xs font-bold text-[var(--ink)]">{bird.lengthCm}</div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                    <Feather className="w-3.5 h-3.5 text-[var(--sage)]" />
                    <span>Wingspan</span>
                  </div>
                  <div className="text-xs font-bold text-[var(--ink)]">{bird.wingspanCm}</div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                    <Weight className="w-3.5 h-3.5 text-[var(--sage)]" />
                    <span>Mass</span>
                  </div>
                  <div className="text-xs font-bold text-[var(--ink)]">{bird.massG}</div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-[var(--sage)]" />
                    <span>Diet</span>
                  </div>
                  <div className="text-xs font-bold text-[var(--ink)] truncate" title={bird.diet}>
                    {bird.diet.split(",")[0]}
                  </div>
                </div>
              </div>

              {/* Habitat & Distribution */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2.5 text-xs">
                  <Compass className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[var(--ink)]">Habitat: </span>
                    <span className="text-[var(--muted)]">{bird.habitat}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <Globe2 className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[var(--ink)]">Range: </span>
                    <span className="text-[var(--muted)]">{bird.range}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-[var(--line)] flex items-center justify-between gap-3">
              {bird.has3dModel ? (
                <Link
                  to="/atlas"
                  onClick={onClose}
                  className="w-full py-3 px-5 rounded-xl text-xs font-bold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Inspect in 3D Feather Atlas</span>
                </Link>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-3 px-5 rounded-xl text-xs font-semibold bg-[var(--chip)] text-[var(--ink)] hover:bg-[var(--line)] border border-[var(--line)] transition-colors cursor-pointer"
                >
                  Close Dossier
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
