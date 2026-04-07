/**
 * license-tiers.js — Per-content-type license tier system for Concord
 *
 * Defines hierarchical license tiers, distribution modes, and utility
 * functions for pricing, access control, and upgrade calculations.
 *
 * Tiers are ordered from least to most permissive within each content type.
 * Higher tiers implicitly include the capabilities of all lower tiers.
 */

import { randomUUID, createHash } from 'crypto';

// ---------------------------------------------------------------------------
// License Tier Definitions
// ---------------------------------------------------------------------------

const LICENSE_TIERS = {
  MUSIC: [
    {
      id: 'listen',
      name: 'Listen',
      description: 'Stream only — no download or offline access',
      defaultPrice: { min: 0, max: 2 },
      capabilities: ['stream'],
    },
    {
      id: 'download',
      name: 'Download',
      description: 'Personal download for offline listening',
      defaultPrice: { min: 1, max: 5 },
      capabilities: ['stream', 'download'],
    },
    {
      id: 'remix',
      name: 'Remix',
      description: 'Create derivative works with royalty obligations',
      defaultPrice: { min: 5, max: 25 },
      capabilities: ['stream', 'download', 'remix'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Use in ads, games, and commercial projects',
      defaultPrice: { min: 25, max: 100 },
      capabilities: ['stream', 'download', 'remix', 'commercial'],
    },
    {
      id: 'exclusive',
      name: 'Exclusive',
      description: 'Full rights transfer — exclusive ownership',
      defaultPrice: { min: 100, max: 1000 },
      capabilities: ['stream', 'download', 'remix', 'commercial', 'exclusive'],
    },
    {
      id: 'stems',
      name: 'Stems',
      description: 'Access to individual instrument/vocal tracks',
      defaultPrice: { min: 10, max: 50 },
      capabilities: ['stream', 'download', 'stems'],
    },
  ],

  ART: [
    {
      id: 'view',
      name: 'View',
      description: 'Full resolution viewing on platform only',
      defaultPrice: { min: 0, max: 0 },
      capabilities: ['stream'],
    },
    {
      id: 'download',
      name: 'Download',
      description: 'Personal download — wallpaper, reference, etc.',
      defaultPrice: { min: 1, max: 5 },
      capabilities: ['stream', 'download'],
    },
    {
      id: 'print',
      name: 'Print',
      description: 'License to produce physical copies and prints',
      defaultPrice: { min: 5, max: 20 },
      capabilities: ['stream', 'download', 'remix'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Use on websites, marketing materials, products',
      defaultPrice: { min: 25, max: 100 },
      capabilities: ['stream', 'download', 'remix', 'commercial'],
    },
    {
      id: 'exclusive',
      name: 'Exclusive',
      description: 'Full rights transfer — exclusive ownership',
      defaultPrice: { min: 100, max: 1000 },
      capabilities: ['stream', 'download', 'remix', 'commercial', 'exclusive'],
    },
    {
      id: 'source_file',
      name: 'Source File',
      description: 'Access to PSD, AI, RAW, or other source formats',
      defaultPrice: { min: 10, max: 50 },
      capabilities: ['stream', 'download', 'source'],
    },
  ],

  CODE: [
    {
      id: 'view',
      name: 'View',
      description: 'Read-only access on platform',
      defaultPrice: { min: 0, max: 0 },
      capabilities: ['stream'],
    },
    {
      id: 'personal',
      name: 'Personal',
      description: 'Use in personal, non-commercial projects',
      defaultPrice: { min: 1, max: 10 },
      capabilities: ['stream', 'download'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Use in commercial products and services',
      defaultPrice: { min: 10, max: 50 },
      capabilities: ['stream', 'download', 'commercial'],
    },
    {
      id: 'resale',
      name: 'Resale',
      description: 'Include in products that are sold to others',
      defaultPrice: { min: 25, max: 100 },
      capabilities: ['stream', 'download', 'commercial', 'remix'],
    },
    {
      id: 'full_source',
      name: 'Full Source',
      description: 'Complete codebase with all dependencies and build tools',
      defaultPrice: { min: 50, max: 200 },
      capabilities: ['stream', 'download', 'commercial', 'remix', 'source'],
    },
  ],

  DOCUMENT: [
    {
      id: 'read',
      name: 'Read',
      description: 'View on platform only',
      defaultPrice: { min: 0, max: 0 },
      capabilities: ['stream'],
    },
    {
      id: 'download',
      name: 'Download',
      description: 'PDF download for personal use',
      defaultPrice: { min: 1, max: 5 },
      capabilities: ['stream', 'download'],
    },
    {
      id: 'citation',
      name: 'Citation',
      description: 'Licensed for academic citation and quotation',
      defaultPrice: { min: 2, max: 10 },
      capabilities: ['stream', 'download', 'remix'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Use in commercial reports, presentations, publications',
      defaultPrice: { min: 10, max: 50 },
      capabilities: ['stream', 'download', 'remix', 'commercial'],
    },
  ],

  '3D_ASSET': [
    {
      id: 'view',
      name: 'View',
      description: 'Interactive 3D viewer on platform',
      defaultPrice: { min: 0, max: 0 },
      capabilities: ['stream'],
    },
    {
      id: 'use_in_concord',
      name: 'Use in Concord',
      description: 'Use within Concord World lens environments only',
      defaultPrice: { min: 1, max: 5 },
      capabilities: ['stream', 'download'],
    },
    {
      id: 'download',
      name: 'Download',
      description: 'GLB/GLTF export for personal use',
      defaultPrice: { min: 5, max: 25 },
      capabilities: ['stream', 'download', 'remix'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Use in games, renders, and commercial projects',
      defaultPrice: { min: 25, max: 100 },
      capabilities: ['stream', 'download', 'remix', 'commercial'],
    },
  ],

  FILM: [
    {
      id: 'view',
      name: 'View',
      description: 'Watch on platform only',
      defaultPrice: { min: 0, max: 0 },
      capabilities: ['stream'],
    },
    {
      id: 'download',
      name: 'Download',
      description: 'Personal download for offline viewing',
      defaultPrice: { min: 2, max: 10 },
      capabilities: ['stream', 'download'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Use clips or full work commercially',
      defaultPrice: { min: 25, max: 100 },
      capabilities: ['stream', 'download', 'commercial'],
    },
    {
      id: 'exclusive',
      name: 'Exclusive',
      description: 'Full rights transfer — exclusive ownership',
      defaultPrice: { min: 100, max: 1000 },
      capabilities: ['stream', 'download', 'commercial', 'exclusive'],
    },
    {
      id: 'stems',
      name: 'Stems',
      description: 'Separate soundtrack, dialogue, and effects tracks',
      defaultPrice: { min: 10, max: 50 },
      capabilities: ['stream', 'download', 'stems'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Distribution Modes (Section 2.7 Amendment)
// ---------------------------------------------------------------------------

/**
 * Preview types per content type. When a mode calls for a "snippet" or
 * limited preview, these define what that looks like for each medium.
 */
const PREVIEW_TYPES = {
  MUSIC:    { kind: 'snippet',            label: '15-60 second audio clip' },
  ART:      { kind: 'watermarked_preview', label: 'Watermarked low-res image' },
  CODE:     { kind: 'readme_preview',      label: 'README and file listing only' },
  DOCUMENT: { kind: 'excerpt',             label: 'First page or abstract' },
  '3D_ASSET': { kind: 'thumbnail',         label: 'Static renders / limited rotation' },
  FILM:     { kind: 'trailer',             label: 'Trailer or 30-60 second clip' },
};

const DISTRIBUTION_MODES = {
  marketplace_only: {
    id: 'marketplace_only',
    code: 'A',
    name: 'Marketplace Only',
    description:
      'No free streaming or viewing. Content is purchase-only. ' +
      'An optional snippet/preview may be provided.',
    freeAccess: false,
    allowsStreaming: false,
    snippetOptional: true,
  },
  stream_and_marketplace: {
    id: 'stream_and_marketplace',
    code: 'B',
    name: 'Stream & Marketplace',
    description:
      'Full free streaming/viewing plus paid tiers for download, ' +
      'remix, commercial use, etc.',
    freeAccess: true,
    allowsStreaming: true,
    snippetOptional: false,
  },
  marketplace_with_snippet: {
    id: 'marketplace_with_snippet',
    code: 'C',
    name: 'Marketplace with Snippet',
    description:
      'No free streaming. A snippet/preview is always shown. ' +
      'Full content requires purchase.',
    freeAccess: false,
    allowsStreaming: false,
    snippetOptional: false,
  },
  free_with_upgrades: {
    id: 'free_with_upgrades',
    code: 'D',
    name: 'Free with Upgrades',
    description:
      'Full streaming and download are free. Revenue comes from ' +
      'paid remix, commercial, stems, and other premium tiers.',
    freeAccess: true,
    allowsStreaming: true,
    snippetOptional: false,
  },
};

// ---------------------------------------------------------------------------
// Snippet Rules
// ---------------------------------------------------------------------------

/**
 * Snippet constraints. A snippet is a separate DTU linked to its parent:
 *   { parent: parentDtuId, type: "snippet" }
 *
 * Snippets are always free to play regardless of distribution mode.
 * They cannot be downloaded, remixed, or purchased separately.
 */
const SNIPPET_RULES = {
  MUSIC:      { minDuration: 15, maxDuration: 60, unit: 'seconds' },
  FILM:       { minDuration: 30, maxDuration: 60, unit: 'seconds' },
  ART:        { maxResolution: 480, watermark: true },
  CODE:       { filesShown: ['README.md', 'package.json'], linesPerFile: 50 },
  DOCUMENT:   { maxPages: 1, abstractOnly: true },
  '3D_ASSET': { maxRotation: 90, staticRenders: 3 },
};

// ---------------------------------------------------------------------------
// Helper: build a tier-index map for fast hierarchical lookups
// ---------------------------------------------------------------------------

/** Map of contentType -> tierId -> positional index (0 = lowest). */
const _tierIndex = {};
for (const [contentType, tiers] of Object.entries(LICENSE_TIERS)) {
  _tierIndex[contentType] = {};
  tiers.forEach((tier, idx) => {
    _tierIndex[contentType][tier.id] = idx;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all tiers for a given content type.
 * @param {string} contentType — e.g. 'MUSIC', 'ART', 'CODE'
 * @returns {Array} Ordered tier objects (lowest to highest)
 */
export function getAvailableTiers(contentType) {
  const tiers = LICENSE_TIERS[contentType];
  if (!tiers) {
    throw new Error(`Unknown content type: ${contentType}`);
  }
  return [...tiers];
}

/**
 * Get a single tier definition.
 * @param {string} contentType
 * @param {string} tierId — e.g. 'download', 'commercial'
 * @returns {object|null} Tier object or null if not found
 */
export function getTier(contentType, tierId) {
  const tiers = LICENSE_TIERS[contentType];
  if (!tiers) return null;
  return tiers.find((t) => t.id === tierId) || null;
}

/**
 * Check whether a user's existing licenses grant access at the requested
 * tier level. Tiers are hierarchical: a commercial license includes all
 * capabilities of download and stream.
 *
 * Special-case tiers (stems, source_file, full_source) sit outside the
 * main hierarchy and must be purchased independently.
 *
 * @param {Array<{contentType: string, tierId: string}>} userLicenses
 * @param {string} contentType
 * @param {string} requestedTierId
 * @returns {boolean}
 */
export function canAccessAtTier(userLicenses, contentType, requestedTierId) {
  if (!LICENSE_TIERS[contentType] || !_tierIndex[contentType]) return false;

  const requestedIdx = _tierIndex[contentType][requestedTierId];
  if (requestedIdx === undefined) return false;

  const requestedTier = getTier(contentType, requestedTierId);
  const requestedCaps = new Set(requestedTier.capabilities);

  // Find all licenses the user holds for this content type
  const relevant = userLicenses.filter((l) => l.contentType === contentType);
  if (relevant.length === 0) return false;

  // Collect all capabilities the user has across their licenses
  const ownedCaps = new Set();
  for (const license of relevant) {
    const tier = getTier(contentType, license.tierId);
    if (tier) {
      for (const cap of tier.capabilities) {
        ownedCaps.add(cap);
      }
    }
  }

  // User has access if they possess every capability the requested tier needs
  for (const cap of requestedCaps) {
    if (!ownedCaps.has(cap)) return false;
  }
  return true;
}

/**
 * Calculate the upgrade price from one tier to another within the same
 * content type. Returns the price difference (never negative).
 *
 * @param {string} currentTierId — Tier the user currently owns
 * @param {string} targetTierId  — Tier the user wants
 * @param {string} contentType
 * @param {Object} pricing — Creator's pricing: { [tierId]: priceInCC }
 * @returns {number} Price difference in CC (Concord Credits)
 */
export function calculateUpgradePrice(currentTierId, targetTierId, contentType, pricing) {
  if (!LICENSE_TIERS[contentType]) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  const currentPrice = pricing[currentTierId];
  const targetPrice = pricing[targetTierId];

  if (currentPrice === undefined) {
    throw new Error(`No pricing set for tier "${currentTierId}" on ${contentType}`);
  }
  if (targetPrice === undefined) {
    throw new Error(`No pricing set for tier "${targetTierId}" on ${contentType}`);
  }

  const diff = targetPrice - currentPrice;
  return Math.max(0, diff);
}

/**
 * Validate a creator's pricing object against a content type's tiers.
 * Every tier must have a non-negative numeric price. Prices must respect
 * the hierarchical ordering (higher tiers cost more, or at least equal).
 *
 * @param {string} contentType
 * @param {Object} pricing — { [tierId]: priceInCC }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePricing(contentType, pricing) {
  const tiers = LICENSE_TIERS[contentType];
  if (!tiers) {
    return { valid: false, errors: [`Unknown content type: ${contentType}`] };
  }

  const errors = [];

  // Check that every tier has a valid price
  for (const tier of tiers) {
    const price = pricing[tier.id];
    if (price === undefined || price === null) {
      errors.push(`Missing price for tier "${tier.id}"`);
      continue;
    }
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      errors.push(`Price for tier "${tier.id}" must be a finite number`);
      continue;
    }
    if (price < 0) {
      errors.push(`Price for tier "${tier.id}" cannot be negative`);
    }
  }

  // Warn on extra keys that don't match any tier
  const validIds = new Set(tiers.map((t) => t.id));
  for (const key of Object.keys(pricing)) {
    if (!validIds.has(key)) {
      errors.push(`Unknown tier "${key}" for content type ${contentType}`);
    }
  }

  // Check hierarchical price ordering (excluding branch tiers like stems)
  // We compare consecutive tiers in the main sequence
  const mainSequence = tiers.filter(
    (t) => !['stems', 'source_file', 'full_source'].includes(t.id)
  );
  for (let i = 1; i < mainSequence.length; i++) {
    const prev = mainSequence[i - 1];
    const curr = mainSequence[i];
    const prevPrice = pricing[prev.id];
    const currPrice = pricing[curr.id];
    if (
      typeof prevPrice === 'number' &&
      typeof currPrice === 'number' &&
      currPrice < prevPrice
    ) {
      errors.push(
        `Tier "${curr.id}" ($${currPrice}) must cost at least as much ` +
        `as "${prev.id}" ($${prevPrice})`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Return default pricing for every tier of a content type using the
 * midpoint of each tier's default price range.
 *
 * @param {string} contentType
 * @returns {Object} { [tierId]: priceInCC }
 */
export function getDefaultPricing(contentType) {
  const tiers = LICENSE_TIERS[contentType];
  if (!tiers) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  const pricing = {};
  for (const tier of tiers) {
    pricing[tier.id] = Math.round(((tier.defaultPrice.min + tier.defaultPrice.max) / 2) * 100) / 100;
  }
  return pricing;
}

/**
 * Get a distribution mode definition by its id.
 * @param {string} modeId — e.g. 'marketplace_only'
 * @returns {object|null}
 */
export function getDistributionMode(modeId) {
  return DISTRIBUTION_MODES[modeId] || null;
}

/**
 * Check whether a distribution mode is valid for a given content type.
 * All four modes are valid for all content types.
 *
 * @param {string} contentType
 * @param {string} modeId
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateDistributionMode(contentType, modeId) {
  if (!LICENSE_TIERS[contentType]) {
    return { valid: false, reason: `Unknown content type: ${contentType}` };
  }
  if (!DISTRIBUTION_MODES[modeId]) {
    return { valid: false, reason: `Unknown distribution mode: ${modeId}` };
  }
  return { valid: true };
}

/**
 * Determine what the public can see for a given distribution mode and
 * content type. Returns a policy object describing free access, preview
 * behaviour, and which tiers are gated.
 *
 * @param {string} modeId
 * @param {string} contentType
 * @returns {object} Preview policy
 */
export function getPreviewPolicy(modeId, contentType) {
  const mode = DISTRIBUTION_MODES[modeId];
  if (!mode) {
    throw new Error(`Unknown distribution mode: ${modeId}`);
  }

  const tiers = LICENSE_TIERS[contentType];
  if (!tiers) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  const preview = PREVIEW_TYPES[contentType] || { kind: 'snippet', label: 'Limited preview' };
  const lowestTier = tiers[0];

  switch (modeId) {
    case 'marketplace_only':
      // Mode A — no free access. Optional snippet preview.
      return {
        mode: mode.code,
        freeContent: null,
        preview: { ...preview, required: false },
        gatedTiers: tiers.map((t) => t.id),
        snippetRules: SNIPPET_RULES[contentType] || null,
        description: `No free access. Purchase required. ${preview.label} may be provided.`,
      };

    case 'stream_and_marketplace':
      // Mode B — free streaming/viewing, paid higher tiers.
      return {
        mode: mode.code,
        freeContent: lowestTier.id,
        preview: null,
        gatedTiers: tiers.slice(1).map((t) => t.id),
        snippetRules: null,
        description:
          `Free ${lowestTier.name.toLowerCase()} access. ` +
          `Paid tiers: ${tiers.slice(1).map((t) => t.name).join(', ')}.`,
      };

    case 'marketplace_with_snippet':
      // Mode C — snippet/preview always shown, purchase for full.
      return {
        mode: mode.code,
        freeContent: null,
        preview: { ...preview, required: true },
        gatedTiers: tiers.map((t) => t.id),
        snippetRules: SNIPPET_RULES[contentType] || null,
        description: `${preview.label} shown. Full content requires purchase.`,
      };

    case 'free_with_upgrades':
      // Mode D — stream + download free, premium tiers paid.
      {
        const freeTiers = tiers.filter(
          (t) => t.capabilities.length <= 2 && !t.capabilities.includes('commercial')
        );
        const paidTiers = tiers.filter(
          (t) => t.capabilities.length > 2 || t.capabilities.includes('commercial')
        );
        return {
          mode: mode.code,
          freeContent: freeTiers.map((t) => t.id),
          preview: null,
          gatedTiers: paidTiers.map((t) => t.id),
          snippetRules: null,
          description:
            `Free: ${freeTiers.map((t) => t.name).join(', ')}. ` +
            `Paid: ${paidTiers.map((t) => t.name).join(', ')}.`,
        };
      }

    default:
      throw new Error(`Unhandled distribution mode: ${modeId}`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { LICENSE_TIERS, DISTRIBUTION_MODES, SNIPPET_RULES, PREVIEW_TYPES };
