import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TelemetryWaypoint } from "../data/mockTelemetry";
import { ApiError, getSpeciesTracks, type StudyOut, type TrackedSpecies } from "../lib/api";
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Navigation2,
  Radio,
  Calendar,
  Loader2,
  TriangleAlert,
} from "lucide-react";

interface FlywayMapProps {
  /** Species that actually have telemetry, from /tracking/species. */
  species: TrackedSpecies[];
  initialSpeciesId?: string;
  height?: string;
  showSidebar?: boolean;
  onSpeciesChange?: (speciesId: string) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Every species gets a stable colour from its name, so a reload looks the same. */
const PALETTE = ["#7f9a63", "#5b8fb9", "#b98a5b", "#9a63b9", "#63b9a1", "#b96371"];
const colourFor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const haversineKm = (a: [number, number], b: [number, number]) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const monthOf = (iso: string | null) => {
  if (!iso) return 0;
  // Stored fixes are UTC strings without a zone suffix. Read their calendar
  // month directly so a viewer's timezone cannot move a fix into another month.
  const month = Number(iso.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 0;
};

/** A species' whole archive is hundreds of individuals; draw the busiest few. */
const MAX_INDIVIDUALS = 14;

export const FlywayMap: React.FC<FlywayMapProps> = ({
  species,
  initialSpeciesId,
  height = "100%",
  showSidebar = true,
  onSpeciesChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>(
    initialSpeciesId || species[0]?.scientific_name || ""
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(6);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showTracks, setShowTracks] = useState<boolean>(true);
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);

  const [lines, setLines] = useState<{ individual: string; points: [number, number][] }[]>([]);
  const [waypoints, setWaypoints] = useState<TelemetryWaypoint[]>([]);
  const [studies, setStudies] = useState<StudyOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSpecies = useMemo(
    () => species.find((s) => s.scientific_name === selectedSpeciesId),
    [species, selectedSpeciesId]
  );

  // Prefer the caller's choice, then the first species that has any data.
  useEffect(() => {
    const match = initialSpeciesId ? species.find((item) =>
      item.scientific_name?.toLowerCase() === initialSpeciesId?.toLowerCase() ||
      item.common_name?.toLowerCase() === initialSpeciesId?.toLowerCase()
    ) : undefined;
    setSelectedSpeciesId(match?.scientific_name ?? (initialSpeciesId ? initialSpeciesId : species[0]?.scientific_name) ?? "");
  }, [initialSpeciesId, species]);

  // Load the selected species' tracks, heaviest individual first.
  useEffect(() => {
    const name = activeSpecies?.scientific_name;
    if (!name) {
      setLines([]);
      setWaypoints([]);
      setStudies([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getSpeciesTracks(name, "monthly")
      .then((response) => {
        if (cancelled) return;

        const features = [...response.geojson.features]
          .sort((a, b) => b.properties.points - a.properties.points)
          .slice(0, MAX_INDIVIDUALS);

        const allLines: { individual: string; points: [number, number][] }[] = [];
        const allWaypoints: TelemetryWaypoint[] = [];

        features.forEach((feature) => {
          const points = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          if (points.length === 0) return;
          allLines.push({
            individual: `${feature.properties.individual || "unnamed"} · ${feature.properties.individual_id ?? feature.properties.study_id ?? ""}`,
            points,
          });

          const timestamps = feature.properties.timestamps ?? [];
          points.forEach((point, idx) => {
            allWaypoints.push({
              lat: point[0],
              lng: point[1],
              month: monthOf(timestamps[idx] ?? null),
              date: timestamps[idx],
              locationName: `Individual ${feature.properties.individual ?? "—"}`,
            });
          });
        });

        setLines(allLines);
        setWaypoints(allWaypoints);
        setStudies(response.studies);
      })
      .catch((err) => {
        if (cancelled) return;
        setLines([]);
        setWaypoints([]);
        setError(err instanceof ApiError ? err.message : "Could not load tracks.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSpecies]);

  const activeMonths = useMemo(
    () => Array.from(new Set(waypoints.map((w) => w.month))).sort((a, b) => a - b),
    [waypoints]
  );

  const corridorKm = useMemo(
    () =>
      lines.reduce((total, line) => {
        let span = 0;
        for (let i = 1; i < line.points.length; i += 1) {
          const seg = haversineKm(line.points[i - 1], line.points[i]);
          if (seg < 400) span += seg; // guard against GPS jumps between fixes
        }
        return total + span;
      }, 0),
    [lines]
  );

  // ------------------------------------------------------------ Leaflet setup

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20, 10],
        zoom: 2,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layersGroupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });

    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const resize = new ResizeObserver(() => map.invalidateSize());
    if (mapContainerRef.current) resize.observe(mapContainerRef.current);
    return () => { resize.disconnect(); tiles.remove(); };
  }, []);

  // ----------------------------------------------------------- layer drawing

  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;
    const group = layersGroupRef.current;
    group.clearLayers();

    if (lines.length === 0) return;

    const colour = colourFor(activeSpecies?.scientific_name ?? "bird");

    lines.forEach((line) => {
      if (!showTracks) return;
      if (showPolygons) {
        group.addLayer(
          L.polyline(line.points, {
            color: colour,
            weight: 5,
            opacity: 0.22,
            lineCap: "round",
            lineJoin: "round",
          })
        );
      }
      group.addLayer(
        L.polyline(line.points, {
          color: colour,
          weight: showPolygons ? 2 : 2.5,
          opacity: 0.9,
          dashArray: "7, 8",
          lineCap: "round",
          lineJoin: "round",
        })
      );
    });

    waypoints.forEach((waypoint) => {
      if (!showHotspots || waypoint.month !== selectedMonth) return;
      const marker = L.circleMarker([waypoint.lat, waypoint.lng], {
        radius: 4,
        color: "#ffffff",
        weight: 1.5,
        fillColor: colour,
        fillOpacity: 0.95,
      });
      marker.bindTooltip(
        `<strong>${waypoint.locationName}</strong><br/><span style="font-size:10px;">${MONTHS[waypoint.month - 1]} · ${waypoint.lat.toFixed(2)}°, ${waypoint.lng.toFixed(2)}°</span>`,
        { sticky: true }
      );
      group.addLayer(marker);
    });

  }, [activeSpecies, lines, waypoints, selectedMonth, showTracks, showPolygons, showHotspots]);

  // Fit only when a species changes; playing the timeline must preserve a user's zoom.
  useEffect(() => {
    const points = lines.flatMap((line) => line.points);
    if (points.length && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 6 });
    }
  }, [lines]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSelectedMonth((prev) => (prev >= 12 ? 1 : prev + 1));
      }, 1400);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const handleSpeciesChange = (id: string) => {
    setSelectedSpeciesId(id);
    onSpeciesChange?.(id);
  };

  const colour = colourFor(activeSpecies?.scientific_name ?? "bird");
  const primaryStudy = studies[0];

  return (
    <div
      style={{ "--map-height": height, height: showSidebar ? undefined : height } as React.CSSProperties}
      className="bird-map isolate relative w-full md:h-[var(--map-height)] flex flex-col md:flex-row overflow-hidden bg-[var(--bg)] text-[var(--ink)] select-none"
    >
      <div className="relative flex-1 w-full h-[65vh] min-h-[460px] md:h-full md:min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" aria-label="Bird migration map" />

        {!activeSpecies && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-[var(--bg)]/90 p-8 text-center">
            <p className="max-w-sm text-sm">No tagged-bird tracks are held for this species. Choose a tracked bird on the Flyways page to explore recorded journeys.</p>
          </div>
        )}
        {/* Top Floating Control Bar */}
        <div className="absolute top-4 left-4 right-14 z-[400] flex items-center gap-2 flex-wrap ">
          <select
            aria-label="Tracked species"
            value={selectedSpeciesId}
            onChange={(e) => handleSpeciesChange(e.target.value)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold liquid-glass-capsule text-[var(--ink)] border border-[rgba(var(--line-rgb),0.75)] shadow-lg hover:border-[var(--sage)] focus:outline-none cursor-pointer max-w-[240px]"
          >
            {!activeSpecies && <option value={selectedSpeciesId}>{initialSpeciesId || "Choose a tracked species"} · no telemetry</option>}
            {species.map((s) => (
              <option
                key={s.scientific_name}
                value={s.scientific_name ?? ""}
                className="bg-[var(--panel)] text-[var(--ink)]"
              >
                {s.common_name ?? s.scientific_name} ({s.scientific_name})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-2xl liquid-glass-capsule shadow-lg text-xs">
            <button
              onClick={() => setShowTracks(!showTracks)}
              aria-pressed={showTracks}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showTracks
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              title="Toggle GPS telemetry corridors"
            >
              <Navigation2 className="w-3 h-3" />
              <span>Flyways</span>
            </button>

            <button
              onClick={() => setShowPolygons(!showPolygons)}
              aria-pressed={showPolygons}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showPolygons
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              title="Toggle corridor highlighting"
            >
              <Layers className="w-3 h-3" />
              <span>Corridor</span>
            </button>

            <button
              onClick={() => setShowHotspots(!showHotspots)}
              aria-pressed={showHotspots}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showHotspots
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              title="Toggle the month's fixes"
            >
              <Radio className="w-3 h-3" />
              <span>Fixes</span>
            </button>
          </div>
        </div>

        {/* Status pill */}
        <div className="absolute top-28 left-4 xl:top-4 xl:left-auto xl:right-16 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-xl liquid-glass-capsule text-[10.5px] font-mono text-[var(--muted)] shadow-lg">
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> loading tracks…
            </>
          ) : error ? (
            <>
              <TriangleAlert className="w-3 h-3 text-[#c4923f]" /> {error}
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colour }} />
              {lines.length} individuals · {waypoints.length} fixes
            </>
          )}
        </div>

        {/* Bottom Floating Seasonal Timeline Scrubber */}
        <div className="absolute bottom-6 inset-x-4 md:inset-x-12 z-[400] flex flex-col items-center">
          <div className="w-full max-w-2xl p-3 sm:p-4 rounded-2xl liquid-glass-elevated liquid-bevel shadow-2xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-xl liquid-pill-btn text-[var(--sage-ink)] shadow-md transition-all cursor-pointer"
                  title={isPlaying ? "Pause timeline" : "Play annual migration cycle"}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setSelectedMonth(1);
                  }}
                  className="p-2 rounded-xl liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                  title="Reset to January"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--sage)]" />
                  <span>Recorded fixes:</span>
                  <strong className="text-[var(--sage)] font-display text-sm">
                    {MONTHS[selectedMonth - 1]}
                  </strong>
                </span>
              </div>

              <span className="text-[11px] font-mono text-[var(--muted)] hidden sm:inline">
                {waypoints.filter((w) => w.month === selectedMonth).length} fixes this month
              </span>
            </div>

            <div className="grid grid-cols-12 gap-1 pt-1 border-t border-[rgba(var(--line-rgb),0.6)]">
              {MONTHS.map((month, idx) => {
                const monthNum = idx + 1;
                const isSelected = selectedMonth === monthNum;
                const hasFixes = activeMonths.includes(monthNum);
                return (
                  <button
                    key={month}
                    onClick={() => {
                      setIsPlaying(false);
                      setSelectedMonth(monthNum);
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer text-center relative ${
                      isSelected
                        ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md scale-105"
                        : hasFixes
                          ? "bg-[var(--chip)] text-[var(--ink)] hover:bg-[var(--line)]"
                          : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span>{month}</span>
                    {hasFixes && (
                      <span
                        className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          isSelected ? "bg-[var(--sage-ink)]" : "bg-[var(--sage)]"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Telemetry Dossier */}
      {showSidebar && activeSpecies && (
        <aside className="w-full md:w-80 lg:w-96 p-5 sm:p-6 bg-[rgba(var(--panel-rgb),0.85)] backdrop-blur-xl border-t md:border-t-0 md:border-l border-[rgba(var(--line-rgb),0.8)] flex flex-col justify-between shrink-0 overflow-y-auto max-h-[45vh] md:max-h-full">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--sage)] mb-1">
                <span className="flex items-center gap-1 font-bold">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  MOVEBANK ARCHIVE
                </span>
                <span className="text-[10px] bg-[var(--chip)] px-2 py-0.5 rounded border border-[var(--line)]">
                  {(activeSpecies.sources[0] ?? "gps").toUpperCase()}
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] font-display">
                {activeSpecies.common_name ?? activeSpecies.scientific_name}
              </h2>
              <p className="text-xs text-[var(--muted)] italic font-display">
                {activeSpecies.scientific_name}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl liquid-glass border border-[rgba(var(--line-rgb),0.7)] space-y-2">
              <div className="text-[11px] text-[var(--muted)]">Tracking campaign</div>
              <div className="text-xs font-mono font-bold text-[var(--ink)]">
                {primaryStudy?.name ?? `${activeSpecies.studies} studies`}
              </div>
              <div className="text-[10.5px] text-[var(--muted)] leading-tight">
                {activeSpecies.individuals.toLocaleString()} tagged individuals ·{" "}
                {activeSpecies.studies} studies
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.65)]">
                <div className="text-[10.5px] text-[var(--muted)]">Archived fixes</div>
                <div className="text-sm font-bold text-[var(--ink)] mt-0.5 font-mono">
                  {activeSpecies.points.toLocaleString()}
                </div>
              </div>

              <div className="p-3 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.65)]">
                <div className="text-[10.5px] text-[var(--muted)]">Sampled distance</div>
                <div className="text-sm font-bold text-[var(--sage)] mt-0.5 font-mono">
                  {Math.round(corridorKm).toLocaleString()} km
                </div>
              </div>

              <div className="p-3 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.65)] col-span-2">
                <div className="text-[10.5px] text-[var(--muted)]">Recording window</div>
                <div className="text-[11px] font-bold text-[var(--ink)] mt-0.5 font-mono">
                  {activeSpecies.first_timestamp?.slice(0, 10) ?? "—"} →{" "}
                  {activeSpecies.last_timestamp?.slice(0, 10) ?? "—"}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] pb-1.5 border-b border-[var(--line)] mb-2 font-semibold flex items-center justify-between">
                <span>Individuals on the map</span>
                <span className="text-[10px] text-[var(--sage)] font-mono">
                  {lines.length} drawn
                </span>
              </h3>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {lines.map((line) => (
                  <button type="button"
                    key={line.individual}
                    onClick={() => {
                      if (!mapInstanceRef.current) return;
                      mapInstanceRef.current.fitBounds(L.latLngBounds(line.points), {
                        padding: [40, 40],
                        maxZoom: 7,
                      });
                    }}
                    className="p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--sage)] text-xs w-full flex items-center justify-between cursor-pointer transition-all"
                  >
                    <span className="font-semibold text-[var(--ink)] text-[11px] truncate max-w-[170px]">
                      {line.individual}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--sage)]">
                      {line.points.length} pts
                    </span>
                  </button>
                ))}
                {lines.length === 0 && !loading && (
                  <div className="text-[11px] text-[var(--muted)]">No tracks for this species.</div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-[10px] text-[var(--muted)] font-mono">
              <span className="font-bold text-[var(--ink)] block mb-0.5">Study citation:</span>
              {primaryStudy?.citation ?? "Movebank study metadata available at /tracking/studies."}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
