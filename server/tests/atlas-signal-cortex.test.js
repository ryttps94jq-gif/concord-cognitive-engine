/**
 * Atlas Signal Cortex — Test Suite
 *
 * Tests for signal classification, privacy architecture, and adjustment control:
 *   - Constants (categories, purposes, permissions, privacy, spatial)
 *   - Signal classification (5-property taxonomy)
 *   - Category identification (frequency, keyword, modulation matching)
 *   - Purpose classification
 *   - Adjustability determination
 *   - Signal taxonomy retrieval (taxonomy, unknown, anomalies, spectrum)
 *   - Privacy zone management (detection, classification, check, verify)
 *   - Presence & vehicle suppression (hardcoded at all tiers)
 *   - Signal adjustment permissions (safety checks, forbidden, permitted, restricted)
 *   - Chat intent detection
 *   - Metrics and heartbeat
 *   - Initialization and state reset
 *   - Full pipeline integration
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  SIGNAL_CATEGORIES,
  ALL_SIGNAL_CATEGORIES,
  SIGNAL_PURPOSES,
  ALL_SIGNAL_PURPOSES,
  ADJUSTMENT_PERMISSIONS,
  ADJUSTMENT_TYPES,
  PRIVACY_LEVELS,
  ZONE_CLASSIFICATIONS,
  ZONE_PROTECTION,
  OVERRIDE_AUTHORITY,
  SPATIAL_LEVELS,
  classifySignal,
  getTaxonomy,
  getUnknownSignals,
  getAnomalies,
  getSpectralOccupancy,
  detectPrivacyZone,
  checkPrivacy,
  getPrivacyZones,
  getPrivacyStats,
  verifyPrivacyZone,
  suppressPresenceDetection,
  suppressVehicleTracking,
  checkAdjustmentPermission,
  detectCortexIntent,
  getCortexMetrics,
  cortexHeartbeatTick,
  initializeCortex,
  _resetCortexState,
} from "../lib/atlas-signal-cortex.js";

beforeEach(() => {
  _resetCortexState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Constants", () => {
  it("defines 7 signal categories", () => {
    expect(ALL_SIGNAL_CATEGORIES).toHaveLength(7);
    expect(ALL_SIGNAL_CATEGORIES).toContain("INFRASTRUCTURE");
    expect(ALL_SIGNAL_CATEGORIES).toContain("COMMUNICATION");
    expect(ALL_SIGNAL_CATEGORIES).toContain("NAVIGATION");
    expect(ALL_SIGNAL_CATEGORIES).toContain("SCIENTIFIC");
    expect(ALL_SIGNAL_CATEGORIES).toContain("BIOLOGICAL");
    expect(ALL_SIGNAL_CATEGORIES).toContain("GEOLOGICAL");
    expect(ALL_SIGNAL_CATEGORIES).toContain("UNKNOWN");
  });

  it("defines 8 signal purposes", () => {
    expect(ALL_SIGNAL_PURPOSES).toHaveLength(8);
    expect(ALL_SIGNAL_PURPOSES).toContain("UTILITY");
    expect(ALL_SIGNAL_PURPOSES).toContain("COMMUNICATION");
    expect(ALL_SIGNAL_PURPOSES).toContain("BEACON");
    expect(ALL_SIGNAL_PURPOSES).toContain("MEASUREMENT");
    expect(ALL_SIGNAL_PURPOSES).toContain("NATURAL");
    expect(ALL_SIGNAL_PURPOSES).toContain("ARTIFACT");
    expect(ALL_SIGNAL_PURPOSES).toContain("LEGACY");
    expect(ALL_SIGNAL_PURPOSES).toContain("INTERFERENCE");
  });

  it("defines 5 adjustment permissions", () => {
    expect(ADJUSTMENT_PERMISSIONS.OBSERVE_ONLY).toBe("OBSERVE_ONLY");
    expect(ADJUSTMENT_PERMISSIONS.RESPOND_ALLOWED).toBe("RESPOND_ALLOWED");
    expect(ADJUSTMENT_PERMISSIONS.MODULATE_ALLOWED).toBe("MODULATE_ALLOWED");
    expect(ADJUSTMENT_PERMISSIONS.ADJUST_RESTRICTED).toBe("ADJUST_RESTRICTED");
    expect(ADJUSTMENT_PERMISSIONS.ADJUST_FORBIDDEN).toBe("ADJUST_FORBIDDEN");
  });

  it("defines 7 adjustment types", () => {
    expect(ADJUSTMENT_TYPES.GAMMA_MODULATION).toBe("GAMMA_MODULATION");
    expect(ADJUSTMENT_TYPES.MESH_OPTIMIZATION).toBe("MESH_OPTIMIZATION");
    expect(ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION).toBe("EMERGENCY_AMPLIFICATION");
    expect(ADJUSTMENT_TYPES.INFRASTRUCTURE_INTERACTION).toBe("INFRASTRUCTURE_INTERACTION");
    expect(ADJUSTMENT_TYPES.SPECTRUM_CLEARING).toBe("SPECTRUM_CLEARING");
    expect(ADJUSTMENT_TYPES.JAMMING).toBe("JAMMING");
  });

  it("defines 4 privacy levels", () => {
    expect(PRIVACY_LEVELS.ABSOLUTE).toBe("ABSOLUTE");
    expect(PRIVACY_LEVELS.RESTRICTED).toBe("RESTRICTED");
    expect(PRIVACY_LEVELS.CONTROLLED).toBe("CONTROLLED");
    expect(PRIVACY_LEVELS.OPEN).toBe("OPEN");
  });

  it("defines zone classifications", () => {
    expect(ZONE_CLASSIFICATIONS.RESIDENTIAL).toBe("residential");
    expect(ZONE_CLASSIFICATIONS.MEDICAL).toBe("medical");
    expect(ZONE_CLASSIFICATIONS.RELIGIOUS).toBe("religious");
    expect(ZONE_CLASSIFICATIONS.GOVERNMENT).toBe("government");
    expect(ZONE_CLASSIFICATIONS.MILITARY).toBe("military");
    expect(ZONE_CLASSIFICATIONS.COMMERCIAL).toBe("commercial");
    expect(ZONE_CLASSIFICATIONS.INDUSTRIAL).toBe("industrial");
  });

  it("maps zones to protection levels", () => {
    expect(ZONE_PROTECTION.residential).toBe("ABSOLUTE");
    expect(ZONE_PROTECTION.medical).toBe("ABSOLUTE");
    expect(ZONE_PROTECTION.religious).toBe("ABSOLUTE");
    expect(ZONE_PROTECTION.government).toBe("RESTRICTED");
    expect(ZONE_PROTECTION.military).toBe("RESTRICTED");
    expect(ZONE_PROTECTION.commercial).toBe("CONTROLLED");
    expect(ZONE_PROTECTION.industrial).toBe("CONTROLLED");
    expect(ZONE_PROTECTION.open_land).toBe("OPEN");
    expect(ZONE_PROTECTION.water).toBe("OPEN");
    expect(ZONE_PROTECTION.atmosphere).toBe("OPEN");
  });

  it("defines override authority per level", () => {
    expect(OVERRIDE_AUTHORITY.ABSOLUTE).toBe("NONE");
    expect(OVERRIDE_AUTHORITY.RESTRICTED).toBe("NONE");
    expect(OVERRIDE_AUTHORITY.CONTROLLED).toBe("GOVERNANCE");
    expect(OVERRIDE_AUTHORITY.OPEN).toBe("NONE");
  });

  it("defines 9 spatial index levels", () => {
    expect(SPATIAL_LEVELS.HEMISPHERE).toBe(0);
    expect(SPATIAL_LEVELS.BUILDING).toBe(7);
    expect(SPATIAL_LEVELS.ROOM).toBe(8);
  });

  it("all constants are frozen", () => {
    expect(Object.isFrozen(SIGNAL_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(ALL_SIGNAL_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(SIGNAL_PURPOSES)).toBe(true);
    expect(Object.isFrozen(ALL_SIGNAL_PURPOSES)).toBe(true);
    expect(Object.isFrozen(ADJUSTMENT_PERMISSIONS)).toBe(true);
    expect(Object.isFrozen(ADJUSTMENT_TYPES)).toBe(true);
    expect(Object.isFrozen(PRIVACY_LEVELS)).toBe(true);
    expect(Object.isFrozen(ZONE_CLASSIFICATIONS)).toBe(true);
    expect(Object.isFrozen(ZONE_PROTECTION)).toBe(true);
    expect(Object.isFrozen(OVERRIDE_AUTHORITY)).toBe(true);
    expect(Object.isFrozen(SPATIAL_LEVELS)).toBe(true);
  });
});

// ── Signal Classification ──────────────────────────────────────────────────

describe("Signal Classification", () => {
  it("classifies a signal across all 5 properties", () => {
    const result = classifySignal({
      frequency: 2400,
      modulation: "OFDM",
      keywords: ["wifi"],
      origin: { lat: 52.37, lng: 4.90 },
      power: -65,
      attenuation: 12,
      phase_shift: 30,
    });

    expect(result).not.toBeNull();
    expect(result.id).toMatch(/^sig_/);
    expect(result.category).toBe("COMMUNICATION");
    expect(result.location).toBeDefined();
    expect(result.purpose).toBe("COMMUNICATION");
    expect(result.measurement).toBeDefined();
    expect(result.adjustability).toBeDefined();
    expect(result.classified_at).toBeDefined();
    expect(result.tags).toContain("cortex");
    expect(result.tags).toContain("communication");
  });

  it("returns null for null input", () => {
    expect(classifySignal(null)).toBeNull();
    expect(classifySignal(undefined)).toBeNull();
  });

  it("preserves signal identity properties", () => {
    const result = classifySignal({
      id: "my_sig_1",
      frequency: 900,
      modulation: "LoRa",
      bandwidth: 125,
      power_level: 14,
    });

    expect(result.id).toBe("my_sig_1");
    expect(result.frequency).toBe(900);
    expect(result.modulation).toBe("LoRa");
    expect(result.bandwidth).toBe(125);
    expect(result.power_level).toBe(14);
  });

  it("records location properties", () => {
    const result = classifySignal({
      frequency: 1200,
      origin: { lat: 10, lng: 20 },
      destination: { lat: 11, lng: 21 },
      path: [{ lat: 10.5, lng: 20.5 }],
      propagation_medium: ["air"],
      distance: 5000,
      transit_time: 16.7,
    });

    expect(result.location.origin).toEqual({ lat: 10, lng: 20 });
    expect(result.location.destination).toEqual({ lat: 11, lng: 21 });
    expect(result.location.path).toHaveLength(1);
    expect(result.location.propagation_medium).toContain("air");
    expect(result.location.distance).toBe(5000);
    expect(result.location.transit_time).toBe(16.7);
  });

  it("records measurement properties", () => {
    const result = classifySignal({
      frequency: 2400,
      power: -65,
      attenuation: 15,
      phase_shift: 45,
      frequency_drift: 0.05,
      multipath: [{ delay: 10 }],
    });

    expect(result.measurement.power).toBe(-65);
    expect(result.measurement.attenuation).toBe(15);
    expect(result.measurement.phase_shift).toBe(45);
    expect(result.measurement.frequency_drift).toBe(0.05);
    expect(result.measurement.multipath).toHaveLength(1);
  });

  it("updates classification stats", () => {
    classifySignal({ frequency: 2400 });
    classifySignal({ frequency: 900 });

    const metrics = getCortexMetrics();
    expect(metrics.stats.signalsClassified).toBe(2);
    expect(metrics.stats.lastClassificationAt).not.toBeNull();
  });
});

// ── Category Identification ────────────────────────────────────────────────

describe("Category Identification", () => {
  it("identifies INFRASTRUCTURE by frequency (power line 50-60Hz)", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power"] });
    expect(result.category).toBe("INFRASTRUCTURE");
  });

  it("identifies INFRASTRUCTURE by keyword", () => {
    const result = classifySignal({ frequency: 150, keywords: ["scada", "grid"] });
    expect(result.category).toBe("INFRASTRUCTURE");
  });

  it("identifies COMMUNICATION by frequency (cellular/WiFi)", () => {
    const result = classifySignal({ frequency: 2400, modulation: "OFDM" });
    expect(result.category).toBe("COMMUNICATION");
  });

  it("identifies COMMUNICATION by keyword", () => {
    const result = classifySignal({ frequency: 800, keywords: ["cellular", "bluetooth"] });
    expect(result.category).toBe("COMMUNICATION");
  });

  it("identifies NAVIGATION by frequency (GPS band)", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    expect(result.category).toBe("NAVIGATION");
  });

  it("identifies NAVIGATION by keyword", () => {
    const result = classifySignal({ frequency: 1200, keywords: ["gps", "navigation"] });
    expect(result.category).toBe("NAVIGATION");
  });

  it("identifies SCIENTIFIC by frequency (weather satellite)", () => {
    const result = classifySignal({ frequency: 137.5, keywords: ["weather"] });
    expect(result.category).toBe("SCIENTIFIC");
  });

  it("identifies BIOLOGICAL by frequency (ELF bioelectric)", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural", "bioelectric"] });
    expect(result.category).toBe("BIOLOGICAL");
  });

  it("identifies GEOLOGICAL by frequency and keyword", () => {
    const result = classifySignal({ frequency: 0.01, keywords: ["tectonic", "geological"] });
    expect(result.category).toBe("GEOLOGICAL");
  });

  it("classifies as UNKNOWN when no pattern matches", () => {
    const result = classifySignal({ frequency: 99999 });
    expect(result.category).toBe("UNKNOWN");
  });

  it("queues UNKNOWN signals", () => {
    classifySignal({ frequency: 99999 });
    classifySignal({ frequency: 88888 });

    const unknown = getUnknownSignals();
    expect(unknown.count).toBe(2);
    expect(unknown.signals[0].category).toBe("UNKNOWN");
  });

  it("matches keywords with underscores normalized to spaces", () => {
    const result = classifySignal({ frequency: 55, description: "water system monitor" });
    expect(result.category).toBe("INFRASTRUCTURE");
  });

  it("matches description text for classification", () => {
    const result = classifySignal({ frequency: 1300, description: "marine beacon signal" });
    expect(result.category).toBe("NAVIGATION");
  });

  it("uses modulation type for scoring", () => {
    const result = classifySignal({ frequency: 800, modulation: "GFSK", keywords: ["mesh"] });
    expect(result.category).toBe("COMMUNICATION");
  });
});

// ── Purpose Classification ─────────────────────────────────────────────────

describe("Purpose Classification", () => {
  it("maps INFRASTRUCTURE to UTILITY", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power"] });
    expect(result.purpose).toBe("UTILITY");
  });

  it("maps COMMUNICATION to COMMUNICATION", () => {
    const result = classifySignal({ frequency: 2400, modulation: "OFDM" });
    expect(result.purpose).toBe("COMMUNICATION");
  });

  it("maps NAVIGATION to BEACON", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    expect(result.purpose).toBe("BEACON");
  });

  it("maps SCIENTIFIC to MEASUREMENT", () => {
    const result = classifySignal({ frequency: 137.5, keywords: ["weather"] });
    expect(result.purpose).toBe("MEASUREMENT");
  });

  it("maps BIOLOGICAL to NATURAL", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural"] });
    expect(result.purpose).toBe("NATURAL");
  });

  it("maps GEOLOGICAL to NATURAL", () => {
    const result = classifySignal({ frequency: 0.01, keywords: ["tectonic"] });
    expect(result.purpose).toBe("NATURAL");
  });

  it("detects legacy signals", () => {
    const result = classifySignal({ frequency: 2400, is_legacy: true });
    expect(result.purpose).toBe("LEGACY");
  });

  it("detects artifact signals", () => {
    const result = classifySignal({ frequency: 2400, description: "artifact from old system" });
    expect(result.purpose).toBe("ARTIFACT");
  });

  it("detects interference signals", () => {
    const result = classifySignal({ frequency: 2400, is_interference: true });
    expect(result.purpose).toBe("INTERFERENCE");
  });
});

// ── Adjustability Determination ────────────────────────────────────────────

describe("Adjustability Determination", () => {
  it("marks NAVIGATION as ADJUST_FORBIDDEN", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    expect(result.adjustability).toBe("ADJUST_FORBIDDEN");
  });

  it("marks BIOLOGICAL as OBSERVE_ONLY", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural"] });
    expect(result.adjustability).toBe("OBSERVE_ONLY");
  });

  it("marks INFRASTRUCTURE as ADJUST_RESTRICTED", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power", "grid"] });
    expect(result.adjustability).toBe("ADJUST_RESTRICTED");
  });

  it("marks COMMUNICATION as RESPOND_ALLOWED", () => {
    const result = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    expect(result.adjustability).toBe("RESPOND_ALLOWED");
  });

  it("FORBIDS signals on aviation frequencies (108-137 MHz)", () => {
    const result = classifySignal({ frequency: 121.5 });
    expect(result.adjustability).toBe("ADJUST_FORBIDDEN");
  });

  it("FORBIDS signals on medical frequencies (401-406 MHz)", () => {
    const result = classifySignal({ frequency: 403 });
    expect(result.adjustability).toBe("ADJUST_FORBIDDEN");
  });

  it("FORBIDS signals on emergency frequencies (156.8 MHz)", () => {
    const result = classifySignal({ frequency: 156.8 });
    expect(result.adjustability).toBe("ADJUST_FORBIDDEN");
  });

  it("FORBIDS signals on military frequencies (225-400 MHz)", () => {
    const result = classifySignal({ frequency: 300 });
    expect(result.adjustability).toBe("ADJUST_FORBIDDEN");
  });

  it("safety frequency check overrides category-based adjustability", () => {
    // 403 MHz is in medical range — even if communication frequency matches, should be FORBIDDEN
    const result = classifySignal({ frequency: 403, modulation: "OFDM", keywords: ["mesh"] });
    expect(result.adjustability).toBe("ADJUST_FORBIDDEN");
  });
});

// ── Signal Taxonomy Retrieval ──────────────────────────────────────────────

describe("Signal Taxonomy Retrieval", () => {
  beforeEach(() => {
    classifySignal({ frequency: 2400, modulation: "OFDM" });
    classifySignal({ frequency: 900, modulation: "LoRa" });
    classifySignal({ frequency: 50, keywords: ["power"] });
    classifySignal({ frequency: 99999 }); // UNKNOWN
  });

  it("retrieves full taxonomy", () => {
    const result = getTaxonomy("all");
    expect(result.ok).toBe(true);
    expect(result.totalClassified).toBe(4);
    expect(result.count).toBe(4);
    expect(result.signals).toHaveLength(4);
  });

  it("filters taxonomy by category", () => {
    const result = getTaxonomy("COMMUNICATION");
    expect(result.ok).toBe(true);
    expect(result.category).toBe("COMMUNICATION");
    expect(result.signals.every(s => s.category === "COMMUNICATION")).toBe(true);
  });

  it("respects limit parameter", () => {
    const result = getTaxonomy("all", 2);
    expect(result.count).toBe(2);
    expect(result.signals).toHaveLength(2);
  });

  it("retrieves unknown signals", () => {
    const result = getUnknownSignals();
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.signals[0].category).toBe("UNKNOWN");
  });

  it("retrieves anomalies based on measurement thresholds", () => {
    classifySignal({ frequency: 2400, frequency_drift: 0.5, attenuation: 60 });

    const result = getAnomalies();
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  it("returns spectral occupancy by band", () => {
    const result = getSpectralOccupancy();
    expect(result.ok).toBe(true);
    expect(result.totalSignals).toBe(4);
    expect(result.bands).toBeDefined();
  });
});

// ── Privacy Zone Management ────────────────────────────────────────────────

describe("Privacy Zone Detection", () => {
  it("detects residential zone from signal profile", () => {
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      signals: [
        { category: "COMMUNICATION", frequency: 2400, description: "wifi" },
        { frequency: 2450, description: "bluetooth" },
      ],
    });

    expect(zone).not.toBeNull();
    expect(zone.id).toMatch(/^zone_/);
    expect(zone.classification).toBe("residential");
    expect(zone.protection_level).toBe("ABSOLUTE");
    expect(zone.interior_data_exists).toBe(false);
    expect(zone.interior_reconstructable).toBe(false);
    expect(zone.data_retention).toBe("NONE");
  });

  it("detects medical zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["medical", "hospital"] });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("medical");
    expect(zone.protection_level).toBe("ABSOLUTE");
  });

  it("detects religious zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["church", "religious"] });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("religious");
    expect(zone.protection_level).toBe("ABSOLUTE");
  });

  it("detects government zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["government", "embassy"] });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("government");
    expect(zone.protection_level).toBe("RESTRICTED");
  });

  it("detects military zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["military", "base"] });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("military");
    expect(zone.protection_level).toBe("RESTRICTED");
  });

  it("detects commercial zone from description", () => {
    const zone = detectPrivacyZone({ description: "commercial office building" });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("commercial");
    expect(zone.protection_level).toBe("CONTROLLED");
  });

  it("detects industrial zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["industrial", "factory"] });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("industrial");
    expect(zone.protection_level).toBe("CONTROLLED");
  });

  it("returns null for open zones (no protection needed)", () => {
    const zone = detectPrivacyZone({ classification: "open_land" });
    expect(zone).toBeNull();
  });

  it("returns null for null input", () => {
    expect(detectPrivacyZone(null)).toBeNull();
  });

  it("aggressive residential detection — WiFi signals alone trigger protection", () => {
    const zone = detectPrivacyZone({
      signals: [
        { category: "COMMUNICATION", frequency: 2400 },
        { category: "COMMUNICATION", frequency: 5200 },
      ],
    });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("residential");
    expect(zone.protection_level).toBe("ABSOLUTE");
  });

  it("when in doubt with signals present, classify as residential (protect by default)", () => {
    const zone = detectPrivacyZone({
      signals: [{ category: "UNKNOWN", frequency: 800 }],
    });
    expect(zone).not.toBeNull();
    expect(zone.classification).toBe("residential");
    expect(zone.protection_level).toBe("ABSOLUTE");
  });

  it("uses explicit classification when provided", () => {
    const zone = detectPrivacyZone({ classification: "military" });
    expect(zone.classification).toBe("military");
    expect(zone.protection_level).toBe("RESTRICTED");
  });

  it("increments zone creation stats", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    expect(getCortexMetrics().privacy.totalZones).toBe(2);
  });
});

// ── Privacy Check (Pre-Reconstruction Gate) ────────────────────────────────

describe("Privacy Check", () => {
  it("blocks interior reconstruction in ABSOLUTE zones", () => {
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    expect(check.allowed).toBe(false);
    expect(check.protection_level).toBe("ABSOLUTE");
    expect(check.reason).toBe("absolute_privacy_zone");
    expect(check.interior_data_exists).toBe(false);
    expect(check.interior_reconstructable).toBe(false);
  });

  it("blocks interior reconstruction in RESTRICTED zones", () => {
    detectPrivacyZone({
      keywords: ["military"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    expect(check.allowed).toBe(false);
    expect(check.protection_level).toBe("RESTRICTED");
    expect(check.reason).toBe("restricted_zone_exterior_only");
  });

  it("allows CONTROLLED zones with governance requirement", () => {
    detectPrivacyZone({
      keywords: ["commercial"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    expect(check.allowed).toBe(true);
    expect(check.protection_level).toBe("CONTROLLED");
    expect(check.requires_governance).toBe(true);
  });

  it("allows reconstruction outside any privacy zone", () => {
    const check = checkPrivacy({ lat: 0, lng: 0 });
    expect(check.allowed).toBe(true);
    expect(check.reason).toBe("no_privacy_zone");
  });

  it("allows when no coordinates provided", () => {
    const check = checkPrivacy(null);
    expect(check.allowed).toBe(true);
    expect(check.reason).toBe("no_coordinates");
  });

  it("increments privacy block stats for ABSOLUTE", () => {
    detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    checkPrivacy({ lat: 52.365, lng: 4.905 });
    checkPrivacy({ lat: 52.365, lng: 4.905 });

    const stats = getPrivacyStats();
    expect(stats.blocksEnforced).toBe(2);
  });

  it("updates lastPrivacyCheckAt timestamp", () => {
    checkPrivacy({ lat: 0, lng: 0 });
    const stats = getPrivacyStats();
    expect(stats.lastPrivacyCheckAt).not.toBeNull();
  });
});

// ── Privacy Zone Retrieval ─────────────────────────────────────────────────

describe("Privacy Zone Retrieval", () => {
  beforeEach(() => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });
  });

  it("retrieves all privacy zones", () => {
    const result = getPrivacyZones();
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    expect(result.zones).toHaveLength(3);
  });

  it("respects limit", () => {
    const result = getPrivacyZones(2);
    expect(result.zones).toHaveLength(2);
  });

  it("returns aggregate privacy stats", () => {
    const stats = getPrivacyStats();
    expect(stats.ok).toBe(true);
    expect(stats.totalZones).toBe(3);
    expect(stats.byProtectionLevel.ABSOLUTE).toBe(2);
    expect(stats.byProtectionLevel.RESTRICTED).toBe(1);
    expect(stats.byClassification.residential).toBe(1);
    expect(stats.byClassification.medical).toBe(1);
    expect(stats.byClassification.military).toBe(1);
  });

  it("verifies a specific zone", () => {
    const zones = getPrivacyZones();
    const zoneId = zones.zones[0].id;

    const result = verifyPrivacyZone(zoneId);
    expect(result.ok).toBe(true);
    expect(result.integrity).toBe("verified");
    expect(result.interior_data_exists).toBe(false);
    expect(result.interior_reconstructable).toBe(false);
    expect(result.verified_at).toBeDefined();
  });

  it("returns error for nonexistent zone", () => {
    const result = verifyPrivacyZone("nonexistent");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("zone_not_found");
  });
});

// ── Presence & Vehicle Suppression ─────────────────────────────────────────

describe("Presence Suppression", () => {
  it("always suppresses presence detection", () => {
    const result = suppressPresenceDetection({ tier: "SOVEREIGN" });
    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe("presence_detection_permanently_suppressed");
    expect(result.tier_override_possible).toBe(false);
    expect(result.individual_data_available).toBe(false);
  });

  it("suppresses for all tiers including sovereign", () => {
    expect(suppressPresenceDetection({ tier: "PUBLIC" }).suppressed).toBe(true);
    expect(suppressPresenceDetection({ tier: "RESEARCH" }).suppressed).toBe(true);
    expect(suppressPresenceDetection({ tier: "SOVEREIGN" }).suppressed).toBe(true);
  });

  it("increments suppression counter", () => {
    suppressPresenceDetection({});
    suppressPresenceDetection({});
    suppressPresenceDetection({});

    expect(getCortexMetrics().privacy.presenceSuppressed).toBe(3);
  });
});

describe("Vehicle Tracking Suppression", () => {
  it("always suppresses vehicle tracking", () => {
    const result = suppressVehicleTracking({ tier: "SOVEREIGN" });
    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe("vehicle_tracking_permanently_suppressed");
    expect(result.tier_override_possible).toBe(false);
    expect(result.individual_data_available).toBe(false);
  });

  it("provides aggregate data only at road segment level", () => {
    const result = suppressVehicleTracking({});
    expect(result.aggregate_available).toBe(true);
    expect(result.aggregate_resolution).toBe("road_segment");
  });

  it("increments vehicle suppression counter", () => {
    suppressVehicleTracking({});
    suppressVehicleTracking({});

    expect(getCortexMetrics().privacy.vehicleSuppressed).toBe(2);
  });
});

// ── Signal Adjustment Permissions ──────────────────────────────────────────

describe("Signal Adjustment Permissions", () => {
  it("returns error for missing parameters", () => {
    expect(checkAdjustmentPermission(null, null).ok).toBe(false);
    expect(checkAdjustmentPermission("sig1", null).ok).toBe(false);
    expect(checkAdjustmentPermission(null, "JAMMING").ok).toBe(false);
  });

  it("PERMITS gamma modulation", () => {
    const sig = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    expect(result.ok).toBe(true);
    expect(result.permitted).toBe(true);
    expect(result.permission).toBe("MODULATE_ALLOWED");
    expect(result.authorization_required).toBe("NONE");
  });

  it("PERMITS mesh optimization", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);
    expect(result.permitted).toBe(true);
  });

  it("PERMITS emergency amplification", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION);
    expect(result.permitted).toBe(true);
  });

  it("PERMITS environmental harmonization", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.ENVIRONMENTAL_HARMONIZATION);
    expect(result.permitted).toBe(true);
  });

  it("RESTRICTS infrastructure interaction (requires sovereign)", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.INFRASTRUCTURE_INTERACTION);

    expect(result.ok).toBe(true);
    expect(result.permitted).toBe(false);
    expect(result.permission).toBe("ADJUST_RESTRICTED");
    expect(result.authorization_required).toBe("SOVEREIGN");
  });

  it("RESTRICTS spectrum clearing (requires sovereign)", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.SPECTRUM_CLEARING);
    expect(result.permitted).toBe(false);
    expect(result.authorization_required).toBe("SOVEREIGN");
  });

  it("FORBIDS jamming permanently", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);

    expect(result.ok).toBe(true);
    expect(result.permitted).toBe(false);
    expect(result.permission).toBe("ADJUST_FORBIDDEN");
    expect(result.reason).toBe("jamming_permanently_forbidden");
    expect(result.authorization_required).toBe("HARDCODED_DENY");
  });

  it("FORBIDS adjustment on aviation frequency signals", () => {
    const sig = classifySignal({ frequency: 121.5 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    expect(result.permitted).toBe(false);
    expect(result.permission).toBe("ADJUST_FORBIDDEN");
    expect(result.safety.affects_aviation).toBe(true);
    expect(result.authorization_required).toBe("HARDCODED_DENY");
  });

  it("FORBIDS adjustment on medical frequency signals", () => {
    const sig = classifySignal({ frequency: 403 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    expect(result.permitted).toBe(false);
    expect(result.safety.affects_medical).toBe(true);
    expect(result.authorization_required).toBe("HARDCODED_DENY");
  });

  it("FORBIDS adjustment on emergency frequency signals", () => {
    const sig = classifySignal({ frequency: 156.8 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    expect(result.permitted).toBe(false);
    expect(result.safety.affects_emergency).toBe(true);
  });

  it("FORBIDS adjustment on military frequency signals", () => {
    const sig = classifySignal({ frequency: 300 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    expect(result.permitted).toBe(false);
    expect(result.safety.affects_military).toBe(true);
  });

  it("safety check is non-overridable even for permitted types", () => {
    const sig = classifySignal({ frequency: 121.5 });
    // GAMMA_MODULATION is normally permitted, but 121.5 MHz is aviation guard frequency
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    expect(result.permitted).toBe(false);
    expect(result.authorization_required).toBe("HARDCODED_DENY");
  });

  it("tracks permitted adjustment count", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);

    expect(getCortexMetrics().adjustments.permitted).toBe(2);
  });

  it("tracks forbidden adjustment count", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);

    const sig2 = classifySignal({ frequency: 121.5 });
    checkAdjustmentPermission(sig2.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    expect(getCortexMetrics().adjustments.forbidden).toBe(2);
  });

  it("returns OBSERVE_ONLY for unknown adjustment type", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, "UNKNOWN_TYPE");
    expect(result.permitted).toBe(false);
    expect(result.permission).toBe("OBSERVE_ONLY");
  });
});

// ── Chat Intent Detection ──────────────────────────────────────────────────

describe("Chat Intent Detection", () => {
  it("returns false for empty input", () => {
    expect(detectCortexIntent("").isCortexRequest).toBe(false);
    expect(detectCortexIntent(null).isCortexRequest).toBe(false);
    expect(detectCortexIntent(undefined).isCortexRequest).toBe(false);
  });

  it("detects signal taxonomy queries", () => {
    expect(detectCortexIntent("Show the signal taxonomy").isCortexRequest).toBe(true);
    expect(detectCortexIntent("Signal classification tree").action).toBe("taxonomy");
    expect(detectCortexIntent("Classify this signal frequency").action).toBe("taxonomy");
  });

  it("detects unknown signal queries", () => {
    expect(detectCortexIntent("Show unknown signals").isCortexRequest).toBe(true);
    expect(detectCortexIntent("List unclassified signals").action).toBe("unknown");
    expect(detectCortexIntent("Any unidentified frequency detected?").action).toBe("unknown");
  });

  it("detects anomaly queries", () => {
    expect(detectCortexIntent("Show anomalous signals").isCortexRequest).toBe(true);
    expect(detectCortexIntent("Any unusual signal patterns?").action).toBe("anomalies");
  });

  it("detects spectrum queries", () => {
    expect(detectCortexIntent("Show spectrum occupancy").isCortexRequest).toBe(true);
    expect(detectCortexIntent("Frequency band usage").action).toBe("spectrum");
    expect(detectCortexIntent("What is the spectral map?").action).toBe("spectrum");
  });

  it("detects privacy zone queries", () => {
    expect(detectCortexIntent("Show privacy zone status").isCortexRequest).toBe(true);
    expect(detectCortexIntent("Privacy zone check").action).toBe("privacy");
    expect(detectCortexIntent("Privacy protection stats").action).toBe("privacy");
  });

  it("detects signal adjustment queries", () => {
    expect(detectCortexIntent("Can we adjust this signal?").isCortexRequest).toBe(true);
    expect(detectCortexIntent("Modulate this signal frequency").action).toBe("adjustment");
    expect(detectCortexIntent("Signal control options").action).toBe("adjustment");
  });

  it("does not match unrelated queries", () => {
    expect(detectCortexIntent("What's the weather today?").isCortexRequest).toBe(false);
    expect(detectCortexIntent("Show me the map").isCortexRequest).toBe(false);
    expect(detectCortexIntent("Hello how are you").isCortexRequest).toBe(false);
  });
});

// ── Metrics ─────────────────────────────────────────────────────────────────

describe("Cortex Metrics", () => {
  it("returns comprehensive metrics", async () => {
    await initializeCortex({});
    classifySignal({ frequency: 2400 });
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});

    const metrics = getCortexMetrics();
    expect(metrics.initialized).toBe(true);
    expect(metrics.taxonomy.totalClassified).toBe(1);
    expect(metrics.taxonomy.categories).toEqual(ALL_SIGNAL_CATEGORIES);
    expect(metrics.privacy.totalZones).toBe(1);
    expect(metrics.privacy.presenceSuppressed).toBe(1);
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
  });

  it("tracks unknown queue size", () => {
    classifySignal({ frequency: 99999 });
    classifySignal({ frequency: 88888 });

    expect(getCortexMetrics().taxonomy.unknownQueueSize).toBe(2);
  });
});

// ── Heartbeat ───────────────────────────────────────────────────────────────

describe("Cortex Heartbeat", () => {
  it("runs without error", async () => {
    await initializeCortex({});
    await expect(cortexHeartbeatTick({}, 1)).resolves.not.toThrow();
  });
});

// ── Initialization ──────────────────────────────────────────────────────────

describe("Initialization", () => {
  it("initializes successfully", async () => {
    const result = await initializeCortex({});
    expect(result.ok).toBe(true);
    expect(result.signalCategories).toEqual(ALL_SIGNAL_CATEGORIES);
    expect(result.signalPurposes).toEqual(ALL_SIGNAL_PURPOSES);
    expect(result.privacyLevels).toEqual(Object.values(PRIVACY_LEVELS));
    expect(result.adjustmentPermissions).toEqual(Object.values(ADJUSTMENT_PERMISSIONS));
    expect(result.message).toContain("Signal Cortex initialized");
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeCortex({});
    const result = await initializeCortex({});
    expect(result.ok).toBe(true);
    expect(result.alreadyInitialized).toBe(true);
  });
});

// ── State Reset ─────────────────────────────────────────────────────────────

describe("State Reset", () => {
  it("resets all state", async () => {
    await initializeCortex({});
    classifySignal({ frequency: 2400 });
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});
    _resetCortexState();

    const metrics = getCortexMetrics();
    expect(metrics.initialized).toBe(false);
    expect(metrics.taxonomy.totalClassified).toBe(0);
    expect(metrics.privacy.totalZones).toBe(0);
    expect(metrics.privacy.presenceSuppressed).toBe(0);
    expect(metrics.stats.signalsClassified).toBe(0);
  });
});

// ── Full Pipeline Integration ───────────────────────────────────────────────

describe("Full Pipeline Integration", () => {
  beforeEach(async () => {
    await initializeCortex({});
  });

  it("classify → detect zone → privacy check → adjustment check", () => {
    // Step 1: Classify signals in an area
    const sig1 = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    const sig2 = classifySignal({ frequency: 1800, keywords: ["cellular", "wifi"] });
    const sig3 = classifySignal({ frequency: 50, keywords: ["power", "grid"] });

    expect(sig1.category).toBe("COMMUNICATION");
    expect(sig3.category).toBe("INFRASTRUCTURE");

    // Step 2: Detect privacy zone from signal profile
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
      signals: [
        { category: "COMMUNICATION", frequency: 2400 },
        { frequency: 2450 },
      ],
    });

    expect(zone.classification).toBe("residential");
    expect(zone.protection_level).toBe("ABSOLUTE");

    // Step 3: Privacy check blocks interior reconstruction
    const privacyCheck = checkPrivacy({ lat: 52.365, lng: 4.905 });
    expect(privacyCheck.allowed).toBe(false);
    expect(privacyCheck.reason).toBe("absolute_privacy_zone");

    // Step 4: Adjustment check
    const adj = checkAdjustmentPermission(sig1.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    expect(adj.permitted).toBe(true);

    // Verify metrics tracked everything
    const metrics = getCortexMetrics();
    expect(metrics.stats.signalsClassified).toBe(3);
    expect(metrics.privacy.totalZones).toBe(1);
    expect(metrics.privacy.blocksEnforced).toBe(1);
    expect(metrics.adjustments.permitted).toBe(1);
  });

  it("presence and vehicle suppression are absolute regardless of tier", () => {
    const presence = suppressPresenceDetection({ tier: "SOVEREIGN", data: { count: 5 } });
    expect(presence.suppressed).toBe(true);
    expect(presence.tier_override_possible).toBe(false);

    const vehicle = suppressVehicleTracking({ tier: "SOVEREIGN", data: { plates: ["A1"] } });
    expect(vehicle.suppressed).toBe(true);
    expect(vehicle.tier_override_possible).toBe(false);
    expect(vehicle.aggregate_available).toBe(true);
  });

  it("safety frequencies are non-overridable for all adjustment types", () => {
    // Aviation guard freq — 121.5 MHz
    const sig = classifySignal({ frequency: 121.5 });

    // Even normally-permitted adjustments are forbidden on safety frequencies
    expect(checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION).permitted).toBe(false);
    expect(checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION).permitted).toBe(false);
    expect(checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION).permitted).toBe(false);
  });

  it("taxonomy grows and is prunable", () => {
    // Classify many signals
    for (let i = 0; i < 50; i++) {
      classifySignal({ frequency: 800 + i, modulation: "OFDM" });
    }

    const taxonomy = getTaxonomy("all", 100);
    expect(taxonomy.totalClassified).toBe(50);
    expect(taxonomy.signals.length).toBe(50);
  });

  it("spectral occupancy reflects classified signals", () => {
    classifySignal({ frequency: 800 });   // LF/MF band
    classifySignal({ frequency: 50 });    // ELF/SLF band
    classifySignal({ frequency: 0.01 });  // ELF/SLF band

    const spectrum = getSpectralOccupancy();
    expect(spectrum.totalSignals).toBe(3);
    expect(Object.keys(spectrum.bands).length).toBeGreaterThanOrEqual(1);
  });
});
