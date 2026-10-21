import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Feather,
  Navigation2,
  Volume2,
  Globe2,
  ArrowUpRight,
  Sparkles,
  Layers,
  Radio
} from "lucide-react";
import { getStats, getTrackedSpecies, type StatsResponse, type TrackedSpecies } from "../lib/api";

const rowsOf = (stats: StatsResponse | null, table: string) =>
  stats?.counts.find((c) => c.table === table)?.rows;

const count = (value: number | undefined) =>
  value === undefined ? "—" : value.toLocaleString();

export const AvianBentoGrid: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [tracked, setTracked] = useState<TrackedSpecies[]>([]);

  useEffect(() => {
    let cancelled = false;
    getStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => undefined);
    getTrackedSpecies()
      .then((rows) => !cancelled && setTracked(rows))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const fixes =
    rowsOf(stats, "movement_tracks") ??
    (tracked.length ? tracked.reduce((s, r) => s + r.points, 0) : undefined);
  const studies = tracked.reduce((s, r) => s + r.studies, 0) || undefined;
  const richnessCells = rowsOf(stats, "richness_cells");
  const gbif = rowsOf(stats, "gbif_occurrences");
  const hotspots = rowsOf(stats, "ebird_hotspots");

  const flywayNames = tracked
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((r) => r.common_name ?? r.scientific_name)
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="relative z-10 py-20 sm:py-28 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto select-none">
      {/* Editorial Header */}
      <div className="max-w-3xl mb-12 text-left">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase text-[var(--sage)] bg-[rgba(var(--sage-rgb),0.09)] border border-[rgba(var(--sage-rgb),0.22)] mb-4">
          <Layers className="w-3.5 h-3.5" />
          <span>Scientific Infrastructure & Instrumentation</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold text-[var(--ink)] font-display tracking-tight leading-[1.1]">
          Multidimensional Exploration of{" "}
          <span className="italic text-[var(--sage)] font-display">Planetary Birdlife</span>
        </h2>
        <p className="text-sm sm:text-base text-[var(--muted)] mt-3 leading-relaxed font-light max-w-2xl">
          Bridging physical ornithology collections with high-throughput digital instrumentation across four interconnected scientific laboratories.
        </p>
      </div>

      {/* Mathematically Verified Gapless Bento Grid (12 Columns with grid-flow-dense) */}
      <div className="grid grid-cols-1 md:grid-cols-12 grid-flow-dense gap-6 lg:gap-8">
        {/* BENTO 1: 3D Feather Atlas Stage (7 cols, md:col-span-7) */}
        <div className="md:col-span-7 group p-1.5 rounded-[2rem] bg-[var(--line)]/40 border border-[var(--line)] hover:border-[var(--sage)]/50 transition-all duration-500 shadow-xl flex flex-col justify-between">
          <div className="p-7 sm:p-9 rounded-[calc(2rem-0.375rem)] bg-[var(--panel)]/95 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col justify-between h-full relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[rgba(var(--sage-rgb),0.08)] rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--sage)] font-semibold uppercase tracking-wider">
                  <Feather className="w-4 h-4" />
                  <span>3D Photorealistic Optics</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--muted)] px-2.5 py-0.5 rounded-full bg-[var(--chip)] border border-[var(--line)]">
                  WebGL 60 FPS
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold font-display text-[var(--ink)] mb-3">
                Feather Atlas: Interactive 3D Anatomy
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed font-light max-w-lg mb-6">
                Examine specimens with 360-degree model rotation, adjustable lighting, and museum specimen scans.
              </p>
            </div>

            {/* Visual Specimen Callout */}
            <div className="relative my-4 flex items-center justify-center p-4 rounded-2xl bg-[var(--bg)]/60 border border-[var(--line)]/80">
              <div className="flex items-center gap-8 sm:gap-14">
                <div className="flex flex-col items-center group-hover:scale-105 transition-transform duration-500">
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_f9e3e60d-acdc-4925-b393-c4ce14b28711.png"
                    alt="Common Kingfisher"
                    className="w-24 h-24 object-contain drop-shadow-md"
                  />
                  <span className="text-xs font-display font-bold text-[var(--ink)] mt-1.5">Kingfisher</span>
                  <span className="text-[10px] font-mono text-[var(--sage)]">Alcedo atthis</span>
                </div>

                <div className="w-[1px] h-16 bg-[var(--line)]" />

                <div className="flex flex-col items-center group-hover:scale-105 transition-transform duration-500">
                  <img
                    src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_21ed095c-d038-4ab5-87b7-b44e527ec449.png"
                    alt="Eurasian Hoopoe"
                    className="w-24 h-24 object-contain drop-shadow-md"
                  />
                  <span className="text-xs font-display font-bold text-[var(--ink)] mt-1.5">Hoopoe</span>
                  <span className="text-[10px] font-mono text-[var(--sage)]">Upupa epops</span>
                </div>
              </div>
            </div>

            {/* Nested Button-in-Button CTA */}
            <div className="mt-4 pt-4 border-t border-[var(--line)]/60 flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--muted)]">Inspect micro-plumage & barbules</span>
              <Link
                to="/atlas"
                className="group/btn inline-flex items-center gap-3 px-5 py-2.5 rounded-full liquid-pill-btn text-xs font-semibold text-[var(--sage-ink)] shadow-md transition-all active:scale-95"
              >
                <span>Launch Stage</span>
                <span className="w-6 h-6 rounded-full bg-[var(--sage-ink)]/20 flex items-center justify-center transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* BENTO 2: Movebank Telemetry (5 cols, md:col-span-5) */}
        <div className="md:col-span-5 group p-1.5 rounded-[2rem] bg-[var(--line)]/40 border border-[var(--line)] hover:border-[var(--sage)]/50 transition-all duration-500 shadow-xl flex flex-col justify-between">
          <div className="p-7 sm:p-9 rounded-[calc(2rem-0.375rem)] bg-[var(--panel)]/95 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col justify-between h-full relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--sage)] font-semibold uppercase tracking-wider">
                  <Navigation2 className="w-4 h-4" />
                  <span>Bio-Telemetry</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--sage)] px-2.5 py-0.5 rounded-full bg-[rgba(var(--sage-rgb),0.12)] border border-[var(--sage)]/25">
                  <span className="w-2 h-2 rounded-full bg-[var(--sage)] animate-ping" />
                  <span>Archived GPS</span>
                </span>
              </div>

              <h3 className="text-2xl font-bold font-display text-[var(--ink)] mb-2">
                Movebank GPS Corridors
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed font-light mb-5">
                {count(fixes)} animal-borne GPS fixes charting the migratory routes of tracked
                species across continental divides.
              </p>
            </div>

            {/* Telemetry Route Mini-Preview */}
            <div className="p-4 rounded-2xl bg-[var(--bg)]/70 border border-[var(--line)] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--muted)]">Active Studies</span>
                <span className="font-bold text-[var(--ink)]">
                  {studies ? `${studies} Research Teams` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--muted)]">Daily Resolved Fixes</span>
                <span className="font-bold text-[var(--sage)]">{count(fixes)} Coordinates</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--muted)]">Tracked Taxa</span>
                <span className="font-bold text-[var(--ink)] truncate max-w-[180px]">
                  {flywayNames || "—"}
                </span>
              </div>
            </div>

            {/* Nested Button-in-Button CTA */}
            <div className="mt-5 pt-4 border-t border-[var(--line)]/60 flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--muted)]">Leaflet & GeoJSON</span>
              <Link
                to="/flyways"
                className="group/btn inline-flex items-center gap-3 px-5 py-2.5 rounded-full liquid-glass-capsule text-xs font-semibold text-[var(--ink)] hover:border-[var(--sage)] shadow-sm transition-all active:scale-95"
              >
                <span>Open Map</span>
                <span className="w-6 h-6 rounded-full bg-[var(--line)] flex items-center justify-center transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-[var(--sage)]" />
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* BENTO 3: Bio-Acoustic Spectral Lab (5 cols, md:col-span-5) */}
        <div className="md:col-span-5 group p-1.5 rounded-[2rem] bg-[var(--line)]/40 border border-[var(--line)] hover:border-[var(--sage)]/50 transition-all duration-500 shadow-xl flex flex-col justify-between">
          <div className="p-7 sm:p-9 rounded-[calc(2rem-0.375rem)] bg-[var(--panel)]/95 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col justify-between h-full relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--sage)] font-semibold uppercase tracking-wider">
                  <Volume2 className="w-4 h-4" />
                  <span>Acoustic Bio-Monitoring</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--muted)] px-2.5 py-0.5 rounded-full bg-[var(--chip)] border border-[var(--line)]">
                  Xeno-Canto
                </span>
              </div>

              <h3 className="text-2xl font-bold font-display text-[var(--ink)] mb-2">
                Spectral Audio & Sonograms
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed font-light mb-5">
                Listen to species-specific field recordings with recordist credits, source links and licences from Xeno-canto and Wikimedia Commons.
              </p>
            </div>

            {/* Synthetic Sonogram Wave Bars Graphic */}
            <div className="p-4 rounded-2xl bg-[var(--bg)]/70 border border-[var(--line)] flex items-end justify-between h-20 px-6 gap-1.5">
              {[38, 65, 45, 90, 72, 30, 85, 98, 55, 40, 78, 62, 88, 35, 70, 52, 95, 44].map((height, i) => (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className="w-1.5 rounded-full bg-[var(--sage)]/70 group-hover:bg-[var(--sage)] transition-all duration-300"
                />
              ))}
            </div>

            {/* Nested Button-in-Button CTA */}
            <div className="mt-5 pt-4 border-t border-[var(--line)]/60 flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--muted)]">Preview species calls</span>
              <a
                href="#birdpedia-showcase"
                className="group/btn inline-flex items-center gap-3 px-5 py-2.5 rounded-full liquid-glass-capsule text-xs font-semibold text-[var(--ink)] hover:border-[var(--sage)] shadow-sm transition-all active:scale-95"
              >
                <span>Listen on Cards</span>
                <span className="w-6 h-6 rounded-full bg-[var(--line)] flex items-center justify-center transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                  <Volume2 className="w-3.5 h-3.5 text-[var(--sage)]" />
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* BENTO 4: Global Hotspot Index & Richness (7 cols, md:col-span-7) */}
        <div className="md:col-span-7 group p-1.5 rounded-[2rem] bg-[var(--line)]/40 border border-[var(--line)] hover:border-[var(--sage)]/50 transition-all duration-500 shadow-xl flex flex-col justify-between">
          <div className="p-7 sm:p-9 rounded-[calc(2rem-0.375rem)] bg-[var(--panel)]/95 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col justify-between h-full relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--sage)] font-semibold uppercase tracking-wider">
                  <Globe2 className="w-4 h-4" />
                  <span>Geographic Distribution</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--muted)] px-2.5 py-0.5 rounded-full bg-[var(--chip)] border border-[var(--line)]">
                  {count(hotspots)} Hotspots
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold font-display text-[var(--ink)] mb-3">
                Global Richness & eBird Field Observatories
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed font-light max-w-lg mb-6">
                {count(richnessCells)} equal-area spatial grid cells cross-referenced with{" "}
                {count(gbif)} GBIF observations and {count(hotspots)} eBird hotspot censuses to
                pinpoint planetary avian diversity epicenters.
              </p>
            </div>

            {/* Quick Metrics Ticker */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[var(--bg)]/70 border border-[var(--line)] text-center font-mono">
              <div>
                <div className="text-lg font-bold text-[var(--sage)]">{count(richnessCells)}</div>
                <div className="text-[10px] text-[var(--muted)]">Richness Cells</div>
              </div>
              <div className="border-x border-[var(--line)]">
                <div className="text-lg font-bold text-[var(--ink)]">{count(gbif)}</div>
                <div className="text-[10px] text-[var(--muted)]">GBIF Occurrences</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--sage)]">{count(hotspots)}</div>
                <div className="text-[10px] text-[var(--muted)]">eBird Stations</div>
              </div>
            </div>

            {/* Nested Button-in-Button CTA */}
            <div className="mt-5 pt-4 border-t border-[var(--line)]/60 flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--muted)]">AVONET 2022 Spatial Database</span>
              <Link
                to="/catalog"
                className="group/btn inline-flex items-center gap-3 px-5 py-2.5 rounded-full liquid-pill-btn text-xs font-semibold text-[var(--sage-ink)] shadow-md transition-all active:scale-95"
              >
                <span>Explore Catalog</span>
                <span className="w-6 h-6 rounded-full bg-[var(--sage-ink)]/20 flex items-center justify-center transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
