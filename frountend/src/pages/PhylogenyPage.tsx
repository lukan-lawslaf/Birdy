import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EvolutionTree } from "../components/EvolutionTree";
import { ancestorsOf, buildPhyloIndex } from "../lib/phylo";
import {
  ApiError,
  getFilters,
  getPhylogenySpecies,
  getPhylogenyTree,
  listSpecies,
  type PhylogenyNode,
} from "../lib/api";
import {
  Dna,
  GitBranch,
  Loader2,
  TriangleAlert,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";

/**
 * Two phylogeny names are spelled differently in the taxonomic catalogue —
 * AVONET splits Eulacestomatidae and Leiothrichidae differently. Lamproliidae
 * has no catalogue counterpart at all and falls through to the "not filed"
 * state on purpose.
 */
const FAMILY_ALIASES: Record<string, string> = {
  Leiotrichidae: "Leiothrichidae",
  Eulacestomidae: "Eulacestomatidae",
};

/** "Alcedinidae (Kingfishers)" → { bare: "Alcedinidae", title: "Kingfishers" } */
const splitFamily = (display: string) => {
  const match = /^(.+?)\s*\((.+)\)\s*$/.exec(display);
  return match
    ? { bare: match[1].trim(), title: match[2].trim() }
    : { bare: display.trim(), title: "" };
};

export const PhylogenyPage: React.FC = () => {
  const [tree, setTree] = useState<PhylogenyNode[] | null>(null);
  const [catalogueFamilies, setCatalogueFamilies] = useState<string[]>([]);
  const [hackettTips, setHackettTips] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getPhylogenyTree(),
      getFilters().catch(() => null),
      getPhylogenySpecies(1).catch(() => null),
    ])
      .then(([phylogeny, filters, tips]) => {
        if (cancelled) return;
        setTree(phylogeny);
        setCatalogueFamilies(filters?.families ?? []);
        setHackettTips(tips?.total ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Could not load the phylogeny."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const index = useMemo(() => (tree ? buildPhyloIndex(tree) : null), [tree]);

  // Bare family name → the catalogue's display string and vernacular.
  const catalogue = useMemo(() => {
    const map = new Map<string, { display: string; title: string }>();
    catalogueFamilies.forEach((display) => {
      const { bare, title } = splitFamily(display);
      map.set(bare, { display, title });
    });
    return map;
  }, [catalogueFamilies]);

  const lookup = (family: string) =>
    catalogue.get(FAMILY_ALIASES[family] ?? family) ?? null;

  const knownFamilies = useMemo(() => {
    const known = new Set<string>();
    index?.families.forEach((family) => {
      if (catalogue.has(FAMILY_ALIASES[family] ?? family)) known.add(family);
    });
    return known;
  }, [index, catalogue]);

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    catalogue.forEach(({ title }, bare) => {
      if (title) map.set(bare, title);
    });
    return map;
  }, [catalogue]);

  // Species counts are per family and only fetched when one is opened.
  const selectedRecord = selected ? lookup(selected) : null;
  useEffect(() => {
    if (!selected || !selectedRecord || selected in counts) return;
    let cancelled = false;

    listSpecies({ family: selectedRecord.display, page_size: 1 })
      .then((page) => {
        if (!cancelled) setCounts((prev) => ({ ...prev, [selected]: page.total }));
      })
      .catch(() => {
        if (!cancelled) setCounts((prev) => ({ ...prev, [selected]: null }));
      });

    return () => {
      cancelled = true;
    };
    // `selectedRecord.display` identifies the family; the map itself is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedRecord?.display, counts]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--bg)] text-center px-6">
        <TriangleAlert className="w-6 h-6 text-[#c4923f]" />
        <p className="text-sm font-semibold font-display text-[var(--ink)]">{error}</p>
        <p className="text-xs text-[var(--muted)]">
          Start the API with <code className="font-mono">uvicorn app.main:app --reload</code>.
        </p>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[var(--muted)]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--sage)]" />
        <span className="text-xs font-mono">Reading the BirdLife tree…</span>
      </div>
    );
  }

  const rootStats = index.roots.map((root) => ({
    name: root.name,
    families: root.familyCount,
  }));
  const siblings = selected
    ? (index.byName.get(index.byName.get(selected)?.parent ?? "")?.familyCount ?? 1) - 1
    : 0;
  const rootDepth = selected
    ? ancestorsOf(selected, index.byName).length
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] px-4 sm:px-6 lg:px-10 py-10 max-w-[1500px] mx-auto transition-colors duration-600">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--sage)] uppercase tracking-widest mb-2 font-bold">
            <Dna className="w-3.5 h-3.5" />
            <span>BirdLife Phylogeny · AVONET 2022</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--ink)] font-display tracking-tight">
            The Family Tree of Birds
          </h1>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl font-light">
            A rectangular phylogram of all {index.families.length} recognised families, drawn
            straight from the BirdLife family tree. Click a branch to fold it, or open a family to
            jump into the catalogue.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {[
            { label: "Families", value: index.families.length },
            { label: "Nodes", value: index.byName.size },
            { label: "Root lineages", value: index.roots.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-4 py-2 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)] text-center shadow-xs min-w-[92px]"
            >
              <div className="text-[10px] font-mono text-[var(--muted)]">{stat.label}</div>
              <div className="text-sm font-bold text-[var(--ink)] font-mono">
                {stat.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* Plate */}
        <div className="p-4 sm:p-5 rounded-3xl liquid-glass-elevated liquid-bevel shadow-xl">
          <EvolutionTree
            index={index}
            selected={selected}
            onSelect={setSelected}
            knownFamilies={knownFamilies}
            titles={titles}
          />
        </div>

        {/* Dossier */}
        <aside className="lg:sticky lg:top-24 space-y-4">
          {selected && selectedRecord ? (
            <div className="p-5 rounded-2xl liquid-glass-elevated liquid-bevel shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--sage)] font-bold">
                  Family
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[10.5px] font-mono text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <h2 className="text-2xl font-bold font-display mt-1 break-words">{selected}</h2>
              {selectedRecord.title && (
                <p className="text-xs text-[var(--muted)] mt-0.5">{selectedRecord.title}</p>
              )}

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Species in catalogue</span>
                  <span className="font-mono font-bold text-[var(--ink)]">
                    {selected in counts
                      ? counts[selected] === null
                        ? "—"
                        : (counts[selected] ?? 0).toLocaleString()
                      : "…"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Sister families</span>
                  <span className="font-mono font-bold text-[var(--ink)]">
                    {siblings === 1 ? "1 family" : `${siblings.toLocaleString()} families`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Levels from root</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{rootDepth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Catalogued as</span>
                  <span className="font-mono text-[10.5px] text-[var(--muted)] truncate max-w-[170px]">
                    {selectedRecord.display}
                  </span>
                </div>
              </div>

              <Link
                to={`/catalog?family=${encodeURIComponent(selectedRecord.display)}`}
                className="mt-4 w-full inline-flex items-center justify-between px-4 py-2.5 rounded-full liquid-pill-btn text-xs font-semibold text-[var(--sage-ink)] shadow-md transition-all active:scale-95"
              >
                <span>Browse {selectedRecord.title || selected}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : selected ? (
            <div className="p-5 rounded-2xl liquid-glass-elevated liquid-bevel shadow-lg space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#c4923f] font-bold">
                  Not filed
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[10.5px] font-mono text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <h2 className="text-2xl font-bold font-display break-words">{selected}</h2>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                No taxonomic rows are filed under this name. The phylogeny and the catalogue
                disagree on this family — either a spelling difference or a different rank in one
                source.
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl liquid-glass-elevated liquid-bevel shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-3.5 h-3.5 text-[var(--sage)]" />
                <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--sage)] font-bold">
                  Reading the plate
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-[var(--muted)] leading-relaxed">
                <li>
                  Branch lengths are <strong className="text-[var(--ink)]">rank levels</strong>, not
                  time — the source nexus carries topology only.
                </li>
                <li>
                  Internal nodes are unnamed clades in BirdLife's tree, so only the{" "}
                  <strong className="text-[var(--ink)]">tips</strong> are labelled.
                </li>
                <li>
                  Click any elbow to fold it to a single row showing how many families it holds.
                </li>
              </ul>

              <div className="mt-4 pt-3 border-t border-[var(--line)] space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">
                  Root lineages
                </div>
                {rootStats.map((root) => (
                  <div key={root.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[var(--muted)]">{root.name}</span>
                    <span className="font-mono font-bold text-[var(--ink)]">
                      {root.families} families
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-[var(--sage)]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">
                Also indexed
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              A separate Hackett Stage-1 species tree holds{" "}
              <strong className="text-[var(--ink)]">
                {hackettTips === null ? "—" : hackettTips.toLocaleString()}
              </strong>{" "}
              species tips. It is stored as a flat list without parent links, so it is indexed for
              lookup but not drawn here.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-sm flex items-start gap-2.5">
            <Layers className="w-3.5 h-3.5 text-[var(--sage)] mt-0.5 shrink-0" />
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              <strong className="text-[var(--ink)]">{knownFamilies.size}</strong> of{" "}
              {index.families.length} families link to species records in the catalogue. Dimmed
              names have no taxonomy rows yet.
            </p>
          </div>

          <Link
            to="/catalog"
            className="flex items-center justify-between px-4 py-3 rounded-2xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.7)] text-xs font-semibold text-[var(--ink)] hover:border-[var(--sage)] transition-all"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--sage)]" />
              Open the species catalogue
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)]" />
          </Link>
        </aside>
      </div>
    </div>
  );
};
