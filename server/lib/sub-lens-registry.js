/**
 * Sub-Lens Registry — Hierarchical lens nesting
 *
 * Every lens can have a parent lens. Every lens can have child lenses.
 * DTUs can belong to a parent OR a child. Queries route to the most
 * specific matching lens (deepest child with matching content).
 *
 * The Oracle searches UP the tree (child inherits from parent context)
 * and DOWN the tree (parent can return child-specific answers).
 */

export const SUB_LENS_TREE = Object.freeze({
  // Each key is a parent lens. Value is { children: [subLensId], description }
  math: {
    description: 'Mathematical foundations',
    children: [
      'math.topology', 'math.number-theory', 'math.algebra', 'math.calculus',
      'math.set-theory', 'math.logic', 'math.probability', 'math.statistics',
      'math.combinatorics', 'math.category-theory', 'math.differential-equations',
      'math.algebraic-geometry', 'math.analysis', 'math.discrete',
    ],
  },
  physics: {
    description: 'Physical sciences',
    children: [
      'physics.classical', 'physics.quantum', 'physics.thermodynamics',
      'physics.electromagnetism', 'physics.fluid-dynamics', 'physics.particle',
      'physics.cosmology', 'physics.astrophysics', 'physics.condensed-matter',
      'physics.plasma', 'physics.biophysics', 'physics.relativity',
      'physics.string-theory', 'physics.qed', 'physics.qcd',
    ],
  },
  chem: {
    description: 'Chemistry branches',
    children: [
      'chem.organic', 'chem.inorganic', 'chem.biochem', 'chem.physical',
      'chem.analytical', 'chem.polymer', 'chem.medicinal', 'chem.electrochem',
      'chem.theoretical', 'chem.materials', 'chem.supramolecular',
    ],
  },
  healthcare: {
    description: 'Medical specialties',
    children: [
      'healthcare.neurology', 'healthcare.cardiology', 'healthcare.oncology',
      'healthcare.psychiatry', 'healthcare.dermatology', 'healthcare.pediatrics',
      'healthcare.geriatrics', 'healthcare.immunology', 'healthcare.endocrinology',
      'healthcare.gastroenterology', 'healthcare.radiology', 'healthcare.anesthesiology',
      'healthcare.orthopedics', 'healthcare.urology', 'healthcare.nephrology',
      'healthcare.pulmonology', 'healthcare.hematology', 'healthcare.rheumatology',
    ],
  },
  code: {
    description: 'Programming languages and paradigms',
    children: [
      'code.rust', 'code.go', 'code.python', 'code.typescript', 'code.javascript',
      'code.cpp', 'code.haskell', 'code.elixir', 'code.erlang', 'code.scala',
      'code.kotlin', 'code.swift', 'code.julia', 'code.r', 'code.lua', 'code.zig',
      'code.c', 'code.java', 'code.ruby', 'code.php', 'code.clojure', 'code.lisp',
      'code.fsharp', 'code.ocaml', 'code.dart', 'code.nim',
    ],
  },
  bio: {
    description: 'Biological sciences',
    children: [
      'bio.genetics', 'bio.molecular', 'bio.cellular', 'bio.microbiology',
      'bio.ecology', 'bio.evolution', 'bio.botany', 'bio.zoology',
      'bio.marine', 'bio.neuroscience', 'bio.immunology', 'bio.developmental',
    ],
  },
  music: {
    description: 'Musical genres and theory',
    children: [
      'music.jazz', 'music.classical', 'music.electronic', 'music.hip-hop',
      'music.blues', 'music.folk', 'music.metal', 'music.rock', 'music.pop',
      'music.country', 'music.reggae', 'music.soul', 'music.funk', 'music.gospel',
      'music.opera', 'music.ambient', 'music.experimental', 'music.world',
    ],
  },
  art: {
    description: 'Visual and tactile arts',
    children: [
      'art.painting', 'art.sculpture', 'art.photography', 'art.digital',
      'art.printmaking', 'art.ceramics', 'art.glassblowing', 'art.metalwork',
      'art.jewelry', 'art.textile', 'art.performance', 'art.installation',
      'art.collage', 'art.mosaic', 'art.calligraphy',
    ],
  },
  linguistics: {
    description: 'Language study',
    children: [
      'linguistics.spanish', 'linguistics.mandarin', 'linguistics.arabic',
      'linguistics.hindi', 'linguistics.french', 'linguistics.japanese',
      'linguistics.korean', 'linguistics.german', 'linguistics.russian',
      'linguistics.portuguese', 'linguistics.italian', 'linguistics.vietnamese',
      'linguistics.turkish', 'linguistics.swahili', 'linguistics.hebrew',
      'linguistics.latin', 'linguistics.sanskrit', 'linguistics.ancient-greek',
    ],
  },
  engineering: {
    description: 'Engineering disciplines',
    children: [
      'engineering.mechanical', 'engineering.electrical', 'engineering.civil',
      'engineering.chemical', 'engineering.aerospace', 'engineering.nuclear',
      'engineering.biomedical', 'engineering.environmental', 'engineering.industrial',
      'engineering.materials', 'engineering.software', 'engineering.systems',
    ],
  },
  philosophy: {
    description: 'Philosophical traditions',
    children: [
      'philosophy.stoicism', 'philosophy.buddhism', 'philosophy.existentialism',
      'philosophy.phenomenology', 'philosophy.analytic', 'philosophy.pragmatism',
      'philosophy.continental', 'philosophy.confucianism', 'philosophy.taoism',
      'philosophy.vedanta', 'philosophy.ethics', 'philosophy.aesthetics',
      'philosophy.mind', 'philosophy.science', 'philosophy.language',
      'philosophy.political', 'philosophy.mathematics',
    ],
  },
  legal: {
    description: 'Legal domains',
    children: [
      'legal.constitutional', 'legal.criminal', 'legal.civil', 'legal.corporate',
      'legal.intellectual-property', 'legal.international', 'legal.tax',
      'legal.employment', 'legal.family', 'legal.environmental', 'legal.contract',
      'legal.tort', 'legal.property', 'legal.bankruptcy', 'legal.immigration',
    ],
  },
  finance: {
    description: 'Financial specializations',
    children: [
      'finance.equity', 'finance.fixed-income', 'finance.derivatives',
      'finance.quantitative', 'finance.corporate', 'finance.personal',
      'finance.international', 'finance.behavioral', 'finance.risk',
      'finance.alternative', 'finance.commodities', 'finance.forex',
    ],
  },
  history: {
    description: 'Historical periods and regions',
    children: [
      'history.ancient', 'history.medieval', 'history.early-modern',
      'history.modern', 'history.contemporary', 'history.world',
      'history.american', 'history.european', 'history.asian',
      'history.african', 'history.latin-american', 'history.middle-eastern',
      'history.military', 'history.social', 'history.economic',
    ],
  },
  sports: {
    description: 'Sports and athletics',
    children: [
      'sports.soccer', 'sports.basketball', 'sports.football', 'sports.baseball',
      'sports.tennis', 'sports.golf', 'sports.track-field', 'sports.swimming',
      'sports.gymnastics', 'sports.boxing', 'sports.mma', 'sports.wrestling',
      'sports.martial-arts', 'sports.cycling', 'sports.skiing', 'sports.climbing',
    ],
  },
});

// Build reverse index: childId → parentId
const PARENT_OF = new Map();
for (const [parent, node] of Object.entries(SUB_LENS_TREE)) {
  for (const child of node.children) {
    PARENT_OF.set(child, parent);
  }
}

// Get parent of a sub-lens (or null for root lenses)
export function getParent(lensId) {
  return PARENT_OF.get(lensId) || null;
}

// Get children of a lens (empty if leaf)
export function getChildren(lensId) {
  return SUB_LENS_TREE[lensId]?.children || [];
}

// Get full ancestor chain (root → ... → lens)
export function getAncestors(lensId) {
  const chain = [];
  let current = lensId;
  while (current) {
    chain.unshift(current);
    current = getParent(current);
  }
  return chain;
}

// Get all descendants (recursive)
export function getDescendants(lensId) {
  const children = getChildren(lensId);
  const all = [...children];
  for (const child of children) {
    all.push(...getDescendants(child));
  }
  return all;
}

// Check if lens has sub-lenses
export function hasSubLenses(lensId) {
  return getChildren(lensId).length > 0;
}

// Check if lensA is an ancestor of lensB
export function isAncestor(lensA, lensB) {
  return getAncestors(lensB).includes(lensA);
}

// Find most specific lens matching a query
// Walks DOWN the tree from root — picks deepest child matching query terms
export function findMostSpecific(query, rootLensId = null) {
  const q = String(query).toLowerCase();
  const qWords = q.split(/\W+/).filter(w => w.length >= 3);

  // Score a lens against the query
  function score(lensId) {
    const parts = lensId.split('.');
    const leaf = parts[parts.length - 1].replace(/-/g, ' ');
    let s = 0;
    for (const w of qWords) {
      if (leaf.includes(w)) s += 2;
      if (lensId.includes(w)) s += 1;
    }
    return s;
  }

  const roots = rootLensId ? [rootLensId] : Object.keys(SUB_LENS_TREE);
  let best = null;
  let bestScore = 0;

  function walk(lensId) {
    const s = score(lensId);
    if (s > bestScore) { best = lensId; bestScore = s; }
    for (const child of getChildren(lensId)) {
      walk(child);
    }
  }

  for (const root of roots) walk(root);
  return best;
}

// Get all leaf lenses (no children)
export function getLeaves() {
  const leaves = [];
  function walk(lensId) {
    const children = getChildren(lensId);
    if (children.length === 0) leaves.push(lensId);
    else for (const c of children) walk(c);
  }
  for (const root of Object.keys(SUB_LENS_TREE)) walk(root);
  return leaves;
}

// Get full tree as JSON for visualization
export function getTree() {
  function build(lensId) {
    const children = getChildren(lensId);
    return {
      id: lensId,
      description: SUB_LENS_TREE[lensId]?.description,
      children: children.map(build),
    };
  }
  return Object.keys(SUB_LENS_TREE).map(build);
}

// Statistics
export function getStats() {
  const roots = Object.keys(SUB_LENS_TREE).length;
  const leaves = getLeaves().length;
  const total = roots + Array.from(PARENT_OF.keys()).length;
  const maxDepth = Math.max(...getLeaves().map(l => getAncestors(l).length));
  return { roots, leaves, total, maxDepth };
}
