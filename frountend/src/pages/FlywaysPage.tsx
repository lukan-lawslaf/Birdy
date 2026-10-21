import React, { useEffect, useState } from "react";
import { FlywayMap } from "../components/FlywayMap";
import { ApiError, getTrackedSpecies, type TrackedSpecies } from "../lib/api";
import { Radio, Navigation2, Loader2, TriangleAlert, ArrowRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export const FlywaysPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSpecies = searchParams.get("species") || undefined;
  const [species, setSpecies] = useState<TrackedSpecies[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTrackedSpecies()
      .then((rows) => {
        if (cancelled) return;
        setSpecies(rows);
        if (initialSpecies) {
          // The link from a species modal may carry a scientific name or a slug;
          // accept either by matching on the binomial.
          const match = rows.find(
            (r) =>
              r.scientific_name?.toLowerCase() === initialSpecies.toLowerCase() ||
              r.common_name?.toLowerCase() === initialSpecies.toLowerCase()
          );
          if (!match) setError(`No telemetry held for "${initialSpecies}".`);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load telemetry.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialSpecies]);

  const totalPoints = species.reduce((sum, s) => sum + s.points, 0);
  const totalIndividuals = species.reduce((sum, s) => sum + s.individuals, 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col transition-colors duration-600">
      {/* Top Telemetry Header Bar */}
      <div className="px-4 sm:px-6 lg:px-10 py-5 bg-[rgba(var(--panel-rgb),0.85)] backdrop-blur-xl border-b border-[rgba(var(--line-rgb),0.8)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--sage)] uppercase tracking-wider mb-1 font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Global Avian Telemetry & Migration Corridors</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] font-display tracking-tight">
              Movebank Migration Flyways
            </h1>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-2xl font-light">
              Animal-borne GPS and Argos fixes, drawn straight from the tracking tables. Each
              line is one tagged bird; the scrubber filters the fixes by month.
            </p>
          </div>

          {/* Live counters */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)] text-center shadow-xs">
              <div className="text-[10px] font-mono text-[var(--muted)]">GPS Positions</div>
              <div className="text-xs font-bold text-[var(--ink)] font-mono">
                {loading ? "…" : `${totalPoints.toLocaleString()} pts`}
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)] text-center shadow-xs">
              <div className="text-[10px] font-mono text-[var(--muted)]">Tracked Taxa</div>
              <div className="text-xs font-bold text-[var(--sage)] font-mono">
                {loading ? "…" : `${species.length} species`}
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)] text-center shadow-xs">
              <div className="text-[10px] font-mono text-[var(--muted)]">Tagged Birds</div>
              <div className="text-xs font-bold text-[var(--ink)] font-mono">
                {loading ? "…" : totalIndividuals.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Map Stage */}
      <div className="flex-1 w-full relative min-h-[calc(100vh-210px)] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--sage)]" />
            <span className="text-xs font-mono">Loading telemetry catalogue…</span>
          </div>
        ) : species.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <TriangleAlert className="w-6 h-6 text-[#c4923f]" />
            <p className="text-sm font-semibold font-display">{error ?? "No telemetry available."}</p>
            <p className="text-xs text-[var(--muted)] max-w-md">
              The tracking tables hold nothing yet. Run the Movebank ingest, then reload this page.
            </p>
          </div>
        ) : (
          <FlywayMap
            species={species}
            initialSpeciesId={initialSpecies}
            height="calc(100vh - 190px)"
            showSidebar={true}
          />
        )}
      </div>

      {/* Quick Corridor Selection Strip */}
      {!loading && species.length > 0 && (
        <div className="p-4 sm:p-5 bg-[rgba(var(--panel-rgb),0.85)] backdrop-blur-xl border-t border-[rgba(var(--line-rgb),0.8)]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-[var(--ink)] font-display flex items-center gap-1.5">
                <Navigation2 className="w-3.5 h-3.5 text-[var(--sage)]" />
                <span>Featured Active Telemetry Campaigns</span>
              </span>
              <span className="text-[11px] text-[var(--muted)]">
                Pick a species in the map's top bar to switch campaigns
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[...species]
                .sort((a, b) => b.points - a.points)
                .slice(0, 12)
                .map((entry) => (
                  <div
                    key={entry.scientific_name}
                    className="p-2.5 rounded-xl liquid-glass hover:border-[var(--sage)] text-[var(--muted)] transition-all"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="truncate">
                        {entry.common_name ?? entry.scientific_name}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5 shrink-0 ml-1 text-[var(--sage)]" />
                    </div>
                    <div className="text-[11px] font-bold text-[var(--ink)] font-mono">
                      {entry.points.toLocaleString()} pts
                    </div>
                    <div className="text-[9.5px] text-[var(--muted)] truncate mt-0.5">
                      {entry.individuals} individuals · {entry.studies} studies
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
