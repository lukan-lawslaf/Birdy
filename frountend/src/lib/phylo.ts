/**
 * Turn the API's nested phylogeny into something a phylogram can draw.
 *
 * The BirdLife tree is a pure bifurcation: 243 family leaves, 239 internal
 * nodes with two children, one with three, and no unary chains. Internal nodes
 * are unnamed (`clade_<n>`), so the only meaningful labels are at the tips —
 * which is why the UI draws a plate and never an indented list.
 */

import type { PhylogenyNode } from "./api";

export interface PhyloNode {
  name: string;
  isFamily: boolean;
  parent: string | null;
  children: PhyloNode[];
  /** Family leaves below this node — 1 for a family, the subtree count above. */
  familyCount: number;
}

export interface PhyloIndex {
  roots: PhyloNode[];
  byName: Map<string, PhyloNode>;
  /** Every family name, A→Z. */
  families: string[];
  /** Longest root-to-tip run in the whole tree — the label column is pinned here
   *  so folding a clade never shifts the text. */
  maxDepth: number;
}

export const buildPhyloIndex = (roots: PhylogenyNode[]): PhyloIndex => {
  const byName = new Map<string, PhyloNode>();
  let maxDepth = 0;

  const make = (raw: PhylogenyNode, parent: string | null, level: number): PhyloNode => {
    maxDepth = Math.max(maxDepth, level);
    const node: PhyloNode = {
      name: raw.name,
      isFamily: raw.is_family,
      parent,
      children: [],
      familyCount: 0,
    };
    byName.set(node.name, node);
    node.children = raw.children.map((child) => make(child, node.name, level + 1));
    node.familyCount = node.isFamily
      ? 1
      : node.children.reduce((sum, child) => sum + child.familyCount, 0);
    return node;
  };

  const built = roots.map((root) => make(root, null, 0));
  const families = [...byName.values()]
    .filter((node) => node.isFamily)
    .map((node) => node.name)
    .sort((a, b) => a.localeCompare(b));

  return { roots: built, byName, families, maxDepth };
};

/** Names from this node's parent up to its root, nearest first. */
export const ancestorsOf = (name: string, byName: Map<string, PhyloNode>): string[] => {
  const chain: string[] = [];
  let cursor = byName.get(name)?.parent ?? null;
  while (cursor) {
    chain.push(cursor);
    cursor = byName.get(cursor)?.parent ?? null;
  }
  return chain;
};

export interface PlacedNode {
  node: PhyloNode;
  x: number;
  y: number;
  /** Folded by the user: rendered as a triangle with a family count. */
  folded: boolean;
  /** Visible children exist, so this node draws an elbow rather than a tip. */
  branches: boolean;
}

export interface TreeLayout {
  placed: Map<string, PlacedNode>;
  /** Rows with no visible children: real families, plus folded clades. */
  tips: PlacedNode[];
  /** y of the lowest tip. */
  height: number;
  /** Longest root-to-tip run, in levels. */
  depth: number;
}

/**
 * Classic rectangular phylogram: leaves take the next row, internal nodes sit
 * at the midpoint of their outermost children. Roots are stacked with a small
 * gap because BirdLife's tree comes back as two (Tinamidae is rooted apart).
 */
export const layoutPhylo = (
  roots: PhyloNode[],
  options: { levelWidth: number; rowGap: number; folded: Set<string>; rootGap?: number }
): TreeLayout => {
  const { levelWidth, rowGap, folded, rootGap = 1.4 } = options;
  const placed = new Map<string, PlacedNode>();
  const tips: PlacedNode[] = [];
  let row = 0;
  let depth = 0;

  const walk = (node: PhyloNode, level: number): number => {
    depth = Math.max(depth, level);
    const isFolded = folded.has(node.name) && node.children.length > 0;
    const children = isFolded ? [] : node.children;

    let y: number;
    if (children.length === 0) {
      y = row * rowGap;
      row += 1;
    } else {
      const childYs = children.map((child) => walk(child, level + 1));
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }

    const entry: PlacedNode = {
      node,
      x: level * levelWidth,
      y,
      folded: isFolded,
      branches: children.length > 0,
    };
    placed.set(node.name, entry);
    if (!entry.branches) tips.push(entry);
    return y;
  };

  roots.forEach((root, index) => {
    if (index > 0) row += rootGap;
    walk(root, 0);
  });

  return { placed, tips, height: Math.max(0, (row - 1) * rowGap), depth };
};
