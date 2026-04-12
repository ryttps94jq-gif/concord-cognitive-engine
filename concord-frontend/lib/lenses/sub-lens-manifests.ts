/**
 * Sub-Lens Manifests — Auto-generated from SUB_LENS_PARENTS.
 *
 * Each parent lens (math, physics, code, ...) has a set of sub-lenses
 * (topology, quantum, rust, ...). This module generates a LensManifest
 * entry for every sub-lens by inheriting from its parent manifest and
 * rewriting the macro prefix from `lens.<parent>.*` to
 * `lens.<parent>.<sub>.*`.
 *
 * The `domain` field uses dotted notation: `${parent}.${sub}`.
 *
 * NOTE: To avoid circular imports with manifest.ts, this module
 * intentionally does NOT import LENS_MANIFESTS directly. Callers pass
 * in the parent manifest list, and manifest.ts is responsible for
 * merging the returned entries back into LENS_MANIFESTS.
 *
 * Mirror of server/lib/sub-lens-registry.js — keep in sync.
 */

import type { LensManifest } from './manifest';

/**
 * Parent → list of sub-lens leaf names (without parent prefix).
 *
 * Must stay in sync with SUB_LENS_TREE in server/lib/sub-lens-registry.js.
 */
export const SUB_LENS_PARENTS: Record<string, string[]> = {
  math: [
    'topology', 'number-theory', 'algebra', 'calculus',
    'set-theory', 'logic', 'probability', 'statistics',
    'combinatorics', 'category-theory', 'differential-equations',
    'algebraic-geometry', 'analysis', 'discrete',
  ],
  physics: [
    'classical', 'quantum', 'thermodynamics',
    'electromagnetism', 'fluid-dynamics', 'particle',
    'cosmology', 'astrophysics', 'condensed-matter',
    'plasma', 'biophysics', 'relativity',
    'string-theory', 'qed', 'qcd',
  ],
  chem: [
    'organic', 'inorganic', 'biochem', 'physical',
    'analytical', 'polymer', 'medicinal', 'electrochem',
    'theoretical', 'materials', 'supramolecular',
  ],
  healthcare: [
    'neurology', 'cardiology', 'oncology',
    'psychiatry', 'dermatology', 'pediatrics',
    'geriatrics', 'immunology', 'endocrinology',
    'gastroenterology', 'radiology', 'anesthesiology',
    'orthopedics', 'urology', 'nephrology',
    'pulmonology', 'hematology', 'rheumatology',
  ],
  code: [
    'rust', 'go', 'python', 'typescript', 'javascript',
    'cpp', 'haskell', 'elixir', 'erlang', 'scala',
    'kotlin', 'swift', 'julia', 'r', 'lua', 'zig',
    'c', 'java', 'ruby', 'php', 'clojure', 'lisp',
    'fsharp', 'ocaml', 'dart', 'nim',
  ],
  bio: [
    'genetics', 'molecular', 'cellular', 'microbiology',
    'ecology', 'evolution', 'botany', 'zoology',
    'marine', 'neuroscience', 'immunology', 'developmental',
  ],
  music: [
    'jazz', 'classical', 'electronic', 'hip-hop',
    'blues', 'folk', 'metal', 'rock', 'pop',
    'country', 'reggae', 'soul', 'funk', 'gospel',
    'opera', 'ambient', 'experimental', 'world',
  ],
  art: [
    'painting', 'sculpture', 'photography', 'digital',
    'printmaking', 'ceramics', 'glassblowing', 'metalwork',
    'jewelry', 'textile', 'performance', 'installation',
    'collage', 'mosaic', 'calligraphy',
  ],
  linguistics: [
    'spanish', 'mandarin', 'arabic',
    'hindi', 'french', 'japanese',
    'korean', 'german', 'russian',
    'portuguese', 'italian', 'vietnamese',
    'turkish', 'swahili', 'hebrew',
    'latin', 'sanskrit', 'ancient-greek',
  ],
  engineering: [
    'mechanical', 'electrical', 'civil',
    'chemical', 'aerospace', 'nuclear',
    'biomedical', 'environmental', 'industrial',
    'materials', 'software', 'systems',
  ],
  philosophy: [
    'stoicism', 'buddhism', 'existentialism',
    'phenomenology', 'analytic', 'pragmatism',
    'continental', 'confucianism', 'taoism',
    'vedanta', 'ethics', 'aesthetics',
    'mind', 'science', 'language',
    'political', 'mathematics',
  ],
  legal: [
    'constitutional', 'criminal', 'civil', 'corporate',
    'intellectual-property', 'international', 'tax',
    'employment', 'family', 'environmental', 'contract',
    'tort', 'property', 'bankruptcy', 'immigration',
  ],
  finance: [
    'equity', 'fixed-income', 'derivatives',
    'quantitative', 'corporate', 'personal',
    'international', 'behavioral', 'risk',
    'alternative', 'commodities', 'forex',
  ],
  history: [
    'ancient', 'medieval', 'early-modern',
    'modern', 'contemporary', 'world',
    'american', 'european', 'asian',
    'african', 'latin-american', 'middle-eastern',
    'military', 'social', 'economic',
  ],
  sports: [
    'soccer', 'basketball', 'football', 'baseball',
    'tennis', 'golf', 'track-field', 'swimming',
    'gymnastics', 'boxing', 'mma', 'wrestling',
    'martial-arts', 'cycling', 'skiing', 'climbing',
  ],
};

/**
 * Extended manifest shape for sub-lenses.
 *
 * Sub-lens manifests carry the same structural fields as a normal
 * LensManifest but also record their parent domain so UI / routing can
 * walk the hierarchy without re-parsing the dotted id.
 */
export interface SubLensManifest extends LensManifest {
  /** Parent domain id (e.g. 'math' for 'math.topology'). */
  parentDomain: string;
  /** Leaf id without parent prefix (e.g. 'topology'). */
  subId: string;
}

/**
 * Rewrite a parent macro map into a sub-lens macro map.
 *
 * Replaces `lens.<parent>.` with `lens.<parent>.<sub>.` in every
 * macro value while preserving the key set.
 */
function rewriteMacros(
  macros: LensManifest['macros'],
  parent: string,
  subDomain: string,
): LensManifest['macros'] {
  const parentPrefix = `lens.${parent}.`;
  const subPrefix = `lens.${subDomain}.`;
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(macros)) {
    if (typeof v === 'string' && v.startsWith(parentPrefix)) {
      out[k] = subPrefix + v.slice(parentPrefix.length);
    } else if (typeof v === 'string') {
      out[k] = v;
    }
  }
  return out as LensManifest['macros'];
}

/**
 * Build a LensManifest array containing one entry per sub-lens.
 *
 * Accepts the parent manifest list explicitly to avoid a circular
 * import with manifest.ts (which calls this function to append
 * sub-lens entries to its own exported LENS_MANIFESTS array).
 *
 * Parents that do not have an existing manifest entry are skipped, so
 * this is safe to run even if a parent lens has not yet been
 * registered.
 */
export function buildSubLensManifests(
  parentManifests: LensManifest[],
): SubLensManifest[] {
  const parentMap = new Map<string, LensManifest>();
  for (const m of parentManifests) parentMap.set(m.domain, m);

  const manifests: SubLensManifest[] = [];
  for (const [parent, subs] of Object.entries(SUB_LENS_PARENTS)) {
    const parentManifest = parentMap.get(parent);
    if (!parentManifest) continue;
    for (const sub of subs) {
      const subDomain = `${parent}.${sub}`;
      manifests.push({
        domain: subDomain,
        label: `${parentManifest.label} · ${sub}`,
        artifacts: parentManifest.artifacts,
        macros: rewriteMacros(parentManifest.macros, parent, subDomain),
        exports: parentManifest.exports,
        actions: parentManifest.actions,
        category: parentManifest.category,
        parentDomain: parent,
        subId: sub,
      });
    }
  }
  return manifests;
}

/**
 * Return total count of sub-lenses defined in SUB_LENS_PARENTS.
 *
 * This is a pure count over the static parent → sub map and does not
 * depend on whether a parent manifest is actually registered.
 */
export function getSubLensParentCount(): number {
  let total = 0;
  for (const subs of Object.values(SUB_LENS_PARENTS)) total += subs.length;
  return total;
}
