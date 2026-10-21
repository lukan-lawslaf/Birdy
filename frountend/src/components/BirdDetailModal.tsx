import { BirdAudioButton } from "./BirdAudioButton";
import { conservationLabel } from "../lib/conservation";
import React, { useEffect, useRef, useState } from "react";
import { BirdSpecies } from "../data/mockBirds";
import { birdAudio } from "../lib/birdAudio";
import { applyAudio, applyDetail } from "../lib/adapt";
import { getSpecies, getSpeciesAudio } from "../lib/api";
import { Link } from "react-router-dom";
import {
  X,
  Feather,
  Compass,
  Globe2,
  Volume2,
  Sparkles,
  Ruler,
  Weight,
  Radio,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Calendar,
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  Navigation2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BirdDetailModalProps {
  bird: BirdSpecies | null;
  onClose: () => void;
}

type TabType = "morphometrics" | "ecology" | "telemetry" | "conservation";

export const BirdDetailModal: React.FC<BirdDetailModalProps> = ({ bird: seed, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>("morphometrics");
  const [live, setLive] = useState<BirdSpecies | null>(null);
  const [loading, setLoading] = useState(false);

  const scientificName = seed?.scientificName ?? null;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!scientificName) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", escape);
      birdAudio.stop();
    };
  }, [scientificName]);

  // The list response is lean. Fetch the joined record once the modal opens and
  // swap in the measurements, conservation block and summary it carries.
  useEffect(() => {
    setLive(null);
    if (!scientificName) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const detail = await getSpecies(scientificName);
        if (cancelled) return;
        let merged = applyDetail(seed!, detail);
        setLive(merged);
        setLoading(false);

        // Audio is a separate endpoint and slower (it may hit the archive).
        try {
          const audio = await getSpeciesAudio(scientificName, 5);
          if (!cancelled) setLive(applyAudio(merged, audio));
        } catch {
          /* no recording is a normal answer */
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `seed` is deliberately absent: it is identified by scientificName alone,
    // and re-running on every render would refetch the same record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scientificName]);

  // Close releases the audio element and anything still buffering.
  useEffect(() => {
    if (!seed) birdAudio.stop();
  }, [seed]);

  const bird = live ?? seed;

  if (!bird) return null;


  const isVulnerable = bird.conservation?.threatened || bird.iucnCategory === "VU" || bird.iucnCategory === "EN" || bird.iucnCategory === "CR";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <AnimatePresence>
      <div role="dialog" aria-modal="true" aria-label={`${bird.name} species profile`} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/65 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-5xl max-h-[92dvh] overflow-y-auto md:overflow-hidden rounded-3xl liquid-glass-elevated liquid-bevel z-10 flex flex-col md:flex-row text-[var(--ink)]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2.5 rounded-full liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Column: Specimen Showcase Stage */}
          <div className="relative w-full md:w-5/12 bg-[rgba(var(--bg-rgb),0.6)] backdrop-blur-md p-4 sm:p-7 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[rgba(var(--line-rgb),0.75)] shrink-0">
            {/* Ambient Spotlight */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 rounded-full bg-[var(--sage-tint)] blur-3xl opacity-60" />
            </div>

            {/* Top Badges */}
            <div className="w-full flex flex-wrap items-center justify-between z-10 gap-2 pr-10 md:pr-0">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--sage)] bg-[var(--sage-tint)] px-3 py-1 rounded-full border border-[var(--sage)]/25 font-semibold">
                {bird.family}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-mono uppercase font-semibold px-2.5 py-1 rounded-full border ${
                  isVulnerable
                    ? "bg-[#b28236]/15 text-[#c4923f] border-[#b28236]/30"
                    : "bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)]"
                }`}
              >
                {isVulnerable ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-[#c4923f]" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--sage)]" />
                )}
                <span>{bird.conservation?.rlLabel || bird.iucnLabel}</span>
              </span>
            </div>

            {/* Bird Cutout / Portrait */}
            <div className="relative my-3 flex items-center justify-center w-full z-10 h-36 sm:h-64">
              {bird.imageUrl ? (
                <img
                  src={bird.imageUrl}
                  alt={bird.name}
                  className="max-h-full max-w-[90%] object-contain drop-shadow-[0_16px_30px_rgba(var(--shadow),0.35)] hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
                  <Feather className="w-14 h-14 text-[var(--sage)]/40" strokeWidth={1} />
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    No picture held
                  </span>
                </div>
              )}
            </div>

            {/* Vocalization & Audio Module */}
            <div className="w-full z-10 space-y-2">
              <BirdAudioButton scientificName={bird.scientificName} name={bird.name} />

              <div className="p-2 rounded-xl bg-[var(--panel)]/80 border border-[var(--line)] text-center">
                <p className="text-[11px] text-[var(--muted)] italic font-display">
                  "{bird.audio?.soundDescription || bird.soundDescription}"
                </p>
                {bird.audio?.recordist && (
                  <p className="text-[9.5px] font-mono text-[var(--muted)] mt-1 opacity-75">
                    Xeno-canto catalogue: {bird.audio.recordist}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Tabbed Scientific Dossier */}
          <div className="w-full md:w-7/12 flex flex-col justify-between shrink-0 md:shrink overflow-visible md:overflow-hidden">
            {/* Header info */}
            <div className="p-6 sm:p-7 pb-4 border-b border-[var(--line)] bg-[var(--panel)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--muted)]">
                  {bird.order} · {bird.family}
                </span>
                {bird.telemetry?.hasTracking && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--sage)] bg-[var(--sage-tint)] px-2.5 py-0.5 rounded-full border border-[var(--sage)]/25">
                    <Radio className="w-3 h-3 animate-pulse" />
                    Movebank Telemetry
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)] font-display mt-1">
                {bird.name}
              </h2>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-sm font-semibold text-[var(--sage)]">{bird.commonName}</p>
                <span className="text-xs text-[var(--muted)]">·</span>
                <p className="text-xs text-[var(--muted)] italic font-display">{bird.scientificName}</p>
                {loading && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--muted)]">
                    <span className="w-2.5 h-2.5 rounded-full border border-[var(--line)] border-t-[var(--sage)] animate-spin" />
                    loading full record
                  </span>
                )}
              </div>

              {/* Dossier Tabs - Liquid Glass Capsule */}
              <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 scrollbar-none liquid-glass-capsule p-1.5 rounded-2xl border border-[rgba(var(--line-rgb),0.6)]">
                <button
                  onClick={() => setActiveTab("morphometrics")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "morphometrics"
                      ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/70"
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Morphometrics</span>
                </button>

                <button
                  onClick={() => setActiveTab("ecology")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "ecology"
                      ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/70"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Ecology & Diet</span>
                </button>

                <button
                  onClick={() => setActiveTab("telemetry")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "telemetry"
                      ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/70"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Telemetry & Flyway</span>
                </button>

                <button
                  onClick={() => setActiveTab("conservation")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "conservation"
                      ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/70"
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>Conservation</span>
                </button>
              </div>
            </div>

            {/* Tab Body with Smooth Scrolling */}
            <div className="p-6 sm:p-7 overflow-y-auto max-h-[46vh] space-y-5">
              {/* TAB 1: MORPHOMETRICS (AVONET anatomical dataset) */}
              {activeTab === "morphometrics" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className="font-mono uppercase tracking-wider">AVONET Morphological Measurements</span>
                    <span className="text-[10px] font-mono bg-[var(--chip)] px-2 py-0.5 rounded border border-[var(--line)]">
                      Millimeter Precision
                    </span>
                  </div>

                  {/* 6-Grid Dimensions */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                        <Ruler className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span>Beak Culmen</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {bird.morphometrics?.beakLengthCulmenMm || "—"} mm
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                        <Layers className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span>Beak Depth × Width</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {bird.morphometrics?.beakDepthMm || "—"} × {bird.morphometrics?.beakWidthMm || "—"} mm
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                        <Feather className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span>Wing Length</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {bird.morphometrics?.wingLengthMm || "—"} mm
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                        <Activity className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span>Tarsus Length</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {bird.morphometrics?.tarsusLengthMm || "—"} mm
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                        <Feather className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span>Tail Length</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {bird.morphometrics?.tailLengthMm || "—"} mm
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] mb-1">
                        <Weight className="w-3.5 h-3.5 text-[var(--sage)]" />
                        <span>Body Mass</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {bird.morphometrics?.massFormatted || bird.massG}
                      </div>
                    </div>
                  </div>

                  {/* Hand-Wing Index (HWI) Aerodynamic Gauge */}
                  <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--ink)]">Hand-Wing Index (HWI)</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--sage-tint)] text-[var(--sage)] border border-[var(--sage)]/30 font-semibold">
                          Score: {bird.morphometrics?.handWingIndex || "—"}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--muted)]">
                        Kipp's Distance: {bird.morphometrics?.kippsDistanceMm || "—"} mm
                      </span>
                    </div>

                    {/* Visual Bar Gauge */}
                    <div className="w-full h-2 rounded-full bg-[var(--line)] overflow-hidden my-2">
                      <div
                        className="h-full rounded-full bg-[var(--sage)] transition-all duration-700"
                        style={{
                          width: `${Math.min(Math.max((bird.morphometrics?.handWingIndex || 20) * 1.4, 15), 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mt-1">
                      <span>Low (Sedentary / Woodland)</span>
                      <span>Moderate (Dispersive)</span>
                      <span>High (Pelagic / Long-distance Flyer)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ECOLOGY & HABITAT */}
              {activeTab === "ecology" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[11px] text-[var(--muted)] block mb-1">Trophic Level & Niche</span>
                      <span className="text-xs font-bold text-[var(--ink)]">
                        {bird.ecology?.trophicLevel} · {bird.ecology?.trophicNiche}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[11px] text-[var(--muted)] block mb-1">Primary Lifestyle</span>
                      <span className="text-xs font-bold text-[var(--ink)]">
                        {bird.ecology?.primaryLifestyle} ({bird.ecology?.migrationLabel})
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[11px] text-[var(--muted)] block mb-1">Habitat & Canopy Density</span>
                      <span className="text-xs font-bold text-[var(--ink)]">
                        {bird.ecology?.habitatDensity}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[11px] text-[var(--muted)] block mb-1">Global Breeding Range Size</span>
                      <span className="text-xs font-bold text-[var(--ink)] font-mono">
                        {bird.ecology?.rangeSizeFormatted || bird.range}
                      </span>
                    </div>
                  </div>

                  {/* Habitat Description */}
                  <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--line)] space-y-2">
                    <div className="text-xs font-bold text-[var(--ink)]">Natural Ecosystem & Preferred Terrain</div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      {bird.habitat}
                    </p>
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)] text-[11px] text-[var(--muted)]">
                      <span className="font-semibold text-[var(--ink)]">Dietary components:</span>
                      <span>{bird.diet}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TELEMETRY & FLYWAY (Movebank & GBIF) */}
              {activeTab === "telemetry" && (
                <div className="space-y-4">
                  {/* Movebank Live Telemetry Banner */}
                  <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-[var(--sage)] animate-pulse" />
                        <span className="text-xs font-bold text-[var(--ink)]">
                          {bird.telemetry?.hasTracking
                            ? "Movebank Animal-Borne Telemetry"
                            : "GBIF Occurrence Biodiversity Records"}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)]">
                        {bird.telemetry?.points.toLocaleString()} Total Records
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-[var(--line)]">
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">
                          {bird.telemetry?.individuals ? `${bird.telemetry.individuals} tagged` : "Broad sample"}
                        </div>
                        <div className="text-[10.5px] text-[var(--muted)]">Individuals</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">
                          {bird.telemetry?.studies ? `${bird.telemetry.studies} studies` : "Worldwide"}
                        </div>
                        <div className="text-[10.5px] text-[var(--muted)]">Campaigns</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--sage)]">
                          {bird.telemetry?.peakMonth || "Spring"}
                        </div>
                        <div className="text-[10.5px] text-[var(--muted)]">Peak Season</div>
                      </div>
                    </div>
                  </div>

                  {/* 12-Month Seasonal Distribution Histogram */}
                  <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[var(--sage)]" />
                        Annual Seasonal Occurrence Curve (GBIF)
                      </span>
                      <span className="text-[10.5px] text-[var(--muted)]">
                        Peak: {bird.telemetry?.peakMonth}
                      </span>
                    </div>

                    {/* Bar visualization */}
                    <div className="grid grid-cols-12 gap-1 items-end h-20 pt-2">
                      {(bird.telemetry?.monthlyDistribution || [20, 25, 45, 70, 90, 100, 95, 80, 65, 45, 30, 20]).map(
                        (val, idx) => (
                          <div key={months[idx]} className="flex flex-col items-center h-full justify-end group">
                            <div
                              style={{ height: `${val}%` }}
                              className={`w-full rounded-t transition-all ${
                                months[idx] === bird.telemetry?.peakMonth
                                  ? "bg-[var(--sage)] opacity-100 shadow-[0_0_10px_rgba(var(--shadow),0.2)]"
                                  : "bg-[var(--line)] hover:bg-[var(--muted)]"
                              }`}
                              title={`${months[idx]}: ${val}% activity`}
                            />
                            <span className="text-[9px] font-mono text-[var(--muted)] mt-1">{months[idx]}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Top Countries */}
                  {bird.telemetry?.topCountries && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)] flex-wrap">
                      <MapPin className="w-3.5 h-3.5 text-[var(--sage)] shrink-0" />
                      <span className="font-semibold text-[var(--ink)]">Sampled regions:</span>
                      {bird.telemetry.topCountries.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[11px]">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    to={`/flyways?species=${bird.id}`}
                    onClick={onClose}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mt-3"
                  >
                    <Navigation2 className="w-3.5 h-3.5" />
                    <span>Open in Geospatial Flyway & Migration Map</span>
                  </Link>
                </div>
              )}

              {/* TAB 4: CONSERVATION & BIO */}
              {activeTab === "conservation" && (
                <div className="space-y-4">
                  {/* Status Card */}
                  <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[var(--muted)] block">IUCN Red List Category</span>
                      <div className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mt-0.5">
                        <span>{bird.conservation?.rlLabel || bird.iucnLabel}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--line)]">
                          {conservationLabel(bird.conservation?.rlCategory || bird.iucnCategory)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-[var(--muted)] block">Population Trend</span>
                      <div className="inline-flex items-center gap-1 text-xs font-bold mt-1 text-[var(--ink)]">
                        {bird.conservation?.populationTrend === "Increasing" && (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        {bird.conservation?.populationTrend === "Decreasing" && (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        {bird.conservation?.populationTrend === "Stable" && (
                          <Minus className="w-3.5 h-3.5 text-[var(--sage)]" />
                        )}
                        <span>{bird.conservation?.populationTrend || "Stable"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Population Size if present */}
                  {bird.conservation?.populationSize && (
                    <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs">
                      <span className="text-[var(--muted)]">Estimated global mature population: </span>
                      <strong className="text-[var(--ink)] font-mono">{bird.conservation.populationSize}</strong>
                    </div>
                  )}

                  {/* Wikipedia Natural History Blurb */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[var(--ink)]">Natural History & Behavior</div>
                    <p className="text-xs text-[var(--ink)] leading-relaxed font-normal">
                      {bird.description}
                    </p>
                  </div>

                  {/* Attribution Footer */}
                  <div className="pt-3 border-t border-[var(--line)] text-[10.5px] text-[var(--muted)] font-mono space-y-1">
                    <p>Sources: AVONET (CC BY 4.0), BirdLife International 2024, Movebank Telemetry, GBIF, Xeno-canto.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-6 border-t border-[rgba(var(--line-rgb),0.75)] bg-[rgba(var(--panel-rgb),0.7)] backdrop-blur-md flex items-center justify-between gap-3">
              {bird.has3dModel ? (
                <Link
                  to="/atlas"
                  onClick={onClose}
                  className="w-full py-3 px-5 rounded-xl text-xs font-bold liquid-pill-btn text-[var(--sage-ink)] shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Inspect in 3D Feather Atlas</span>
                </Link>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-3 px-5 rounded-xl text-xs font-semibold liquid-glass-capsule text-[var(--ink)] hover:border-[var(--sage)] transition-colors cursor-pointer"
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
