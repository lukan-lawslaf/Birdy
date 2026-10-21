import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ZoomIn, ZoomOut, FoldVertical, UnfoldVertical, RotateCcw, X } from "lucide-react";
import { ancestorsOf, layoutPhylo, type PhyloIndex, type PlacedNode } from "../lib/phylo";

interface EvolutionTreeProps {
  index: PhyloIndex;
  selected: string | null;
  onSelect: (family: string) => void;
  /** Families the catalogue actually knows; the rest render dimmed. */
  knownFamilies: Set<string>;
  /** Family → vernacular name from the catalogue's taxonomy, when it has one. */
  titles?: Map<string, string>;
  height?: string;
}

const BASE_LEVEL = 24;
const BASE_ROW = 17;
const LABEL_GAP = 30;
const LABEL_WIDTH = 168;
const PAD_X = 22;
const PAD_Y = 20;

const clampZoom = (value: number) => Math.min(Math.max(Number(value.toFixed(2)), 0.55), 2);

/**
 * Rectangular phylogram of the BirdLife family tree.
 *
 * Every internal node is an unnamed clade, so branches carry no labels and the
 * plate reads top-to-tip: fold a clade by clicking its elbow, or search straight
 * for a family. Two roots are stacked because Tinamidae is rooted apart from
 * the rest of Aves in the source nexus.
 */
export const EvolutionTree: React.FC<EvolutionTreeProps> = ({
  index,
  selected,
  onSelect,
  knownFamilies,
  titles,
  height = "calc(100vh - 320px)",
}) => {
  const [zoom, setZoom] = useState(1);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<{ name: string; n: number } | null>(null);
  const plateRef = useRef<HTMLDivElement>(null);

  const levelWidth = BASE_LEVEL * zoom;
  const rowGap = BASE_ROW * zoom;
  const fontSize = Math.max(9.5, 11 * Math.min(zoom, 1.35));

  const layout = useMemo(
    () => layoutPhylo(index.roots, { levelWidth, rowGap, folded }),
    [index.roots, levelWidth, rowGap, folded]
  );

  // Pinned to the full tree depth so folding never drags the labels around.
  const labelX = index.maxDepth * levelWidth + LABEL_GAP;
  const svgWidth = PAD_X * 2 + labelX + LABEL_WIDTH;
  const svgHeight = PAD_Y * 2 + layout.height;

  const focusName = hovered ?? selected;
  const hot = useMemo(() => {
    if (!focusName) return new Set<string>();
    return new Set([focusName, ...ancestorsOf(focusName, index.byName)]);
  }, [focusName, index.byName]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return index.families
      .filter(
        (name) =>
          name.toLowerCase().includes(term) ||
          (titles?.get(name) ?? "").toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [query, index.families, titles]);

  // Narrow screens cannot show a 32-level plate at once. Land on the tip
  // labels rather than a blank stretch of deep trunk; panning left reveals the
  // basal structure.
  useEffect(() => {
    const plate = plateRef.current;
    if (plate && plate.scrollWidth > plate.clientWidth) {
      plate.scrollLeft = plate.scrollWidth - plate.clientWidth;
    }
  }, []);

  // Centre the revealed row without letting the browser scroll the page itself.
  useEffect(() => {
    if (!focus) return;
    const plate = plateRef.current;
    const place = layout.placed.get(focus.name);
    if (!plate || !place) return;
    plate.scrollTo({
      top: Math.max(0, PAD_Y + place.y - plate.clientHeight / 2),
      behavior: "smooth",
    });
    // `layout` is intentionally omitted: this should fire on a new target only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const reveal = (name: string) => {
    setFolded((prev) => {
      const next = new Set(prev);
      ancestorsOf(name, index.byName).forEach((ancestor) => next.delete(ancestor));
      return next;
    });
    onSelect(name);
    setQuery("");
    setFocus((prev) => ({ name, n: (prev?.n ?? 0) + 1 }));
  };

  const toggleFold = (name: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const foldAll = () => setFolded(new Set(index.roots.map((root) => root.name)));
  const unfoldAll = () => setFolded(new Set());
  const resetView = () => {
    unfoldAll();
    setZoom(1);
    setQuery("");
  };

  const edgeStroke = (from: string, to: string) =>
    hot.has(from) && hot.has(to) ? "var(--sage)" : "rgba(var(--sage-rgb),0.30)";
  const edgeWidth = (from: string, to: string) => (hot.has(from) && hot.has(to) ? 1.9 : 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) reveal(matches[0]);
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Find a family — Latin or common name…"
            className="w-full pl-9 pr-8 py-2 rounded-full liquid-glass-capsule border border-[rgba(var(--line-rgb),0.8)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--sage)]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              aria-label="Clear family search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {matches.length > 0 && (
            <div className="absolute z-30 mt-1.5 w-full rounded-xl liquid-glass-elevated border border-[var(--line)] shadow-xl p-1">
              {matches.map((name) => (
                <button
                  key={name}
                  onClick={() => reveal(name)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg text-xs font-mono text-[var(--ink)] hover:bg-[var(--chip)] cursor-pointer"
                >
                  <span>{name}</span>
                  <span className="text-[10px] text-[var(--muted)] truncate max-w-[110px]">
                    {titles?.get(name) ?? ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)]">
          <button
            onClick={() => setZoom((z) => clampZoom(z / 1.18))}
            className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] cursor-pointer"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-[var(--muted)] w-9 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => clampZoom(z * 1.18))}
            className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] cursor-pointer"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)]">
          <button
            onClick={foldAll}
            className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] cursor-pointer"
            title="Fold every clade to its root"
            aria-label="Fold all clades"
          >
            <FoldVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={unfoldAll}
            className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] cursor-pointer"
            title="Unfold every clade"
            aria-label="Unfold all clades"
          >
            <UnfoldVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)] cursor-pointer"
            title="Reset zoom and folding"
            aria-label="Reset the tree view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Plate */}
      <div
        ref={plateRef}
        style={{ height: svgHeight + 2, maxHeight: height }}
        className="relative overflow-auto rounded-2xl bg-[var(--bg)] border border-[var(--line)] shadow-inner"
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          role="img"
          aria-label="BirdLife family phylogeny: 243 families branching from two roots"
          className="block select-none"
        >
          <g transform={`translate(${PAD_X}, ${PAD_Y})`}>
            {/* Leader lines tying each tip to the fixed label column */}
            {layout.tips.map((tip) => (
              <line
                key={`leader-${tip.node.name}`}
                x1={tip.x + (tip.folded ? 7 : 0)}
                x2={labelX - 7}
                y1={tip.y}
                y2={tip.y}
                stroke={tip.folded ? "rgba(var(--sage-rgb),0.45)" : "rgba(var(--line-rgb),0.95)"}
                strokeWidth={1}
                strokeDasharray={tip.folded ? undefined : "1 4"}
              />
            ))}

            {/* Elbows: one vertical spine per clade, one stub per child */}
            {[...layout.placed.values()]
              .filter((place) => place.branches)
              .map((place) => {
                const children = place.node.children
                  .map((child) => layout.placed.get(child.name))
                  .filter((child): child is PlacedNode => Boolean(child));
                if (children.length === 0) return null;
                const top = children[0].y;
                const bottom = children[children.length - 1].y;

                return (
                  <g
                    key={`node-${place.node.name}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(place.node.name)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => toggleFold(place.node.name)}
                  >
                    <rect
                      x={place.x - 8}
                      y={top}
                      width={16}
                      height={Math.max(bottom - top, rowGap / 2)}
                      fill="transparent"
                    />
                    <line
                      x1={place.x}
                      x2={place.x}
                      y1={top}
                      y2={bottom}
                      stroke="rgba(var(--sage-rgb),0.30)"
                      strokeWidth={1}
                    />
                    {children.map((child) => (
                      <line
                        key={`edge-${child.node.name}`}
                        x1={place.x}
                        x2={child.x}
                        y1={child.y}
                        y2={child.y}
                        stroke={edgeStroke(place.node.name, child.node.name)}
                        strokeWidth={edgeWidth(place.node.name, child.node.name)}
                      />
                    ))}
                    <title>
                      {place.node.familyCount} families fold at this node
                    </title>
                  </g>
                );
              })}

            {/* Tips: family name, or a folded clade's family count */}
            {layout.tips.map((tip) => {
              const isKnown = !tip.folded && knownFamilies.has(tip.node.name);
              const isSelected = selected === tip.node.name;
              const isHot = hot.has(tip.node.name);

              return (
                <g
                  key={`tip-${tip.node.name}`}
                  id={`phylo-row-${tip.node.name}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(tip.node.name)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (tip.folded) toggleFold(tip.node.name);
                    else onSelect(tip.node.name);
                  }}
                >
                  <rect
                    x={tip.x}
                    y={tip.y - rowGap / 2}
                    width={labelX + LABEL_WIDTH - tip.x}
                    height={rowGap}
                    fill={isSelected ? "rgba(var(--sage-rgb),0.10)" : "transparent"}
                  />
                  <text
                    x={labelX}
                    y={tip.y}
                    dominantBaseline="central"
                    className="font-mono"
                    fontSize={fontSize}
                    fontWeight={isSelected ? 700 : isHot ? 600 : 400}
                    fill={
                      isSelected
                        ? "var(--sage)"
                        : tip.folded
                          ? "var(--muted)"
                          : isKnown
                            ? "var(--ink)"
                            : "var(--muted)"
                    }
                  >
                    {tip.folded ? `${tip.node.familyCount} families` : tip.node.name}
                  </text>
                  {tip.folded && (
                    <path
                      d={`M ${tip.x} ${tip.y - 4.5} L ${tip.x + 7} ${tip.y} L ${tip.x} ${
                        tip.y + 4.5
                      } Z`}
                      fill="var(--sage)"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--muted)] px-1">
        <span>
          {layout.tips.length} rows · depth {layout.depth} · two roots
        </span>
        <span className="hidden sm:inline">Click a branch to fold it · click a family to open it</span>
      </div>
    </div>
  );
};
