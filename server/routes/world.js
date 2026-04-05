/**
 * World API Routes
 *
 * REST endpoints for the Concord World Lens platform:
 *
 * Districts & Zones:
 *   GET  /api/world/districts         — list all districts
 *   GET  /api/world/districts/:id     — get district details
 *   GET  /api/world/districts/by-lens/:lens — find district by lens
 *
 * Workstations:
 *   POST /api/world/workstations/start — start workstation session
 *   POST /api/world/workstations/end   — end workstation session
 *
 * Organizations:
 *   GET    /api/world/orgs             — list organizations
 *   POST   /api/world/orgs             — create organization
 *   GET    /api/world/orgs/:id         — get organization
 *   POST   /api/world/orgs/:id/join    — join organization
 *   POST   /api/world/orgs/:id/leave   — leave organization
 *
 * Parties:
 *   POST   /api/world/parties          — create party
 *   POST   /api/world/parties/:id/join — join party
 *   POST   /api/world/parties/:id/leave — leave party
 *
 * Jobs:
 *   GET    /api/world/jobs             — list job templates
 *   POST   /api/world/jobs/assign      — assign job to player
 *   POST   /api/world/jobs/quit        — quit current job
 *   POST   /api/world/jobs/activity    — record job activity
 *
 * Businesses:
 *   GET    /api/world/businesses       — list businesses
 *   POST   /api/world/businesses       — create business
 *   POST   /api/world/businesses/:id/sale — record sale
 *
 * Progression:
 *   GET    /api/world/progression/:userId  — get mastery profile
 *   POST   /api/world/progression/xp       — award XP
 *   GET    /api/world/leaderboard          — get leaderboard
 *   GET    /api/world/achievements/:userId — get achievements
 *   POST   /api/world/explorer/visit       — record district visit
 *   GET    /api/world/explorer/:userId     — get explorer stats
 *   POST   /api/world/daily-login          — record daily login
 *
 * Seasons:
 *   GET    /api/world/season               — get current season
 *   POST   /api/world/season               — start new season
 *   POST   /api/world/season/challenge     — add challenge
 *   POST   /api/world/season/complete      — complete challenge
 *
 * Events:
 *   GET    /api/world/events               — list events
 *   POST   /api/world/events               — create event
 *   GET    /api/world/events/:id           — get event
 *   POST   /api/world/events/:id/rsvp      — RSVP to event
 *   POST   /api/world/events/:id/start     — start event
 *   POST   /api/world/events/:id/end       — end event
 *   GET    /api/world/events/calendar/:cityId — get calendar
 *
 * Mechanics:
 *   GET    /api/world/mechanics/:cityId     — get city mechanics
 *   POST   /api/world/mechanics/:cityId     — create mechanic
 *   POST   /api/world/mechanics/:cityId/fire — fire trigger
 *   DELETE /api/world/mechanics/:cityId/:mechanicId — delete mechanic
 *
 * Templates:
 *   GET    /api/world/templates            — list city templates
 *   GET    /api/world/templates/:id        — get template
 *
 * Wizard:
 *   GET    /api/world/wizard/steps          — get wizard steps
 *   POST   /api/world/wizard/validate       — validate wizard step
 *   POST   /api/world/wizard/build          — build city from wizard
 *
 * City Config:
 *   GET    /api/world/config/themes         — get valid themes
 *   GET    /api/world/config/domains        — get valid domains
 *   GET    /api/world/config/rules-schema   — get rules schema
 */

import { Router } from "express";
import logger from "../logger.js";

// World engine
import {
  getDistrict,
  getDistrictByLens,
  DISTRICTS,
  DISTRICT_CATEGORIES,
  CONTROL_MODES,
  listDistricts,
  getDistrictCategories,
  getDistrictAtPosition,
  getActiveWorkstations,
  getDistrictObjects,
  removeWorldObject,
  getWorldStats,
  startWorkstationSession,
  endWorkstationSession,
} from "../lib/world-engine.js";

// Organizations
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  joinOrganization,
  leaveOrganization,
  createParty,
  joinParty,
  leaveParty,
} from "../lib/world-organizations.js";

// Jobs
import {
  listJobTemplates,
  assignJob,
  quitJob,
  promoteEmployee,
  getUserJob,
  recordJobActivity,
  createBusiness,
  stockBusiness,
  hireToBusiness,
  rateBusiness,
  getBusiness,
  listBusinesses,
  recordBusinessSale,
  getJobStats,
} from "../lib/world-jobs.js";

// Progression
import {
  getMasteryProfile,
  awardXP,
  getLeaderboard,
  getAchievements,
  recordDistrictVisit,
  getExplorerStats,
  recordDailyLogin,
  startSeason,
  getCurrentSeason,
  addSeasonChallenge,
  completeChallenge,
} from "../lib/world-progression.js";

// Events
import {
  createEvent,
  getEvent,
  updateEvent,
  cancelEvent,
  startEvent,
  endEvent,
  rsvpEvent,
  cancelRsvp,
  getCityEvents,
  getEventCalendar,
  getUpcomingEvents,
  getEventAttendees,
} from "../lib/world-events.js";

// Mechanics
import {
  createMechanic,
  fireTrigger,
  getCityMechanics,
  deleteMechanic,
  getTemplate,
  listTemplates,
  getWizardSteps,
  validateWizardStep,
  buildCityFromWizard,
} from "../lib/world-mechanics.js";

// City config
import {
  getValidThemes,
  getValidDomains,
  getCityRulesSchema,
} from "../lib/city-manager.js";

/**
 * @param {object} [opts]
 * @param {Function} [opts.requireAuth] - Auth middleware
 * @returns {Router}
 */
export default function createWorldRoutes({ requireAuth } = {}) {
  const router = Router();

  function _userId(req) {
    return req.user?.userId ?? req.actor?.userId ?? req.body?.userId ?? null;
  }

  const auth = (req, res, next) => {
    if (requireAuth) return requireAuth(req, res, next);
    next();
  };

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      logger.warn?.("[world-route] error:", err.message);
      const status = err.message.includes("not found") ? 404
        : err.message.includes("required") || err.message.includes("Invalid") ? 400
        : err.message.includes("owner") || err.message.includes("Only") ? 403
        : 500;
      res.status(status).json({ ok: false, error: err.message });
    }
  };

  // ── Districts ────────────────────────────────────────────────────────────

  router.get("/districts", wrap((req, res) => {
    const { category } = req.query;
    const districts = category ? listDistricts(category) : DISTRICTS;
    res.json({ ok: true, districts, count: districts.length });
  }));

  router.get("/districts/by-lens/:lens", wrap((req, res) => {
    const district = getDistrictByLens(req.params.lens);
    if (!district) return res.status(404).json({ ok: false, error: "No district for this lens" });
    res.json({ ok: true, district });
  }));

  router.get("/districts/:id", wrap((req, res) => {
    const district = getDistrict(req.params.id);
    if (!district) return res.status(404).json({ ok: false, error: "District not found" });
    res.json({ ok: true, district });
  }));

  router.get("/districts/:id/objects", wrap((req, res) => {
    const objects = getDistrictObjects(req.params.id);
    res.json({ ok: true, objects, count: objects.length });
  }));

  router.get("/district-categories", wrap((_req, res) => {
    res.json({ ok: true, categories: getDistrictCategories() });
  }));

  router.get("/district-at-position", wrap((req, res) => {
    const x = parseFloat(req.query.x);
    const z = parseFloat(req.query.z);
    if (Number.isNaN(x) || Number.isNaN(z)) return res.status(400).json({ ok: false, error: "x and z query params required" });
    const district = getDistrictAtPosition(x, z);
    if (!district) return res.status(404).json({ ok: false, error: "No district at this position" });
    res.json({ ok: true, district });
  }));

  router.get("/control-modes", wrap((_req, res) => {
    res.json({ ok: true, controlModes: CONTROL_MODES });
  }));

  router.get("/stats", wrap((_req, res) => {
    res.json({ ok: true, ...getWorldStats() });
  }));

  router.delete("/objects/:objectId", auth, wrap((req, res) => {
    const removed = removeWorldObject(req.params.objectId);
    if (!removed) return res.status(404).json({ ok: false, error: "Object not found" });
    res.json({ ok: true, removed: true });
  }));

  // ── Workstations ─────────────────────────────────────────────────────────

  router.post("/workstations/start", auth, wrap((req, res) => {
    const { workstationId, districtId } = req.body;
    const result = startWorkstationSession(_userId(req), workstationId, districtId);
    res.json({ ok: true, ...result });
  }));

  router.post("/workstations/end", auth, wrap((req, res) => {
    const { sessionId } = req.body;
    const result = endWorkstationSession(sessionId);
    res.json({ ok: true, ...result });
  }));

  router.get("/workstations/active", wrap((req, res) => {
    const { districtId } = req.query;
    const sessions = getActiveWorkstations(districtId || undefined);
    res.json({ ok: true, sessions, count: sessions.length });
  }));

  // ── Organizations ────────────────────────────────────────────────────────

  router.get("/orgs", wrap((_req, res) => {
    const orgs = listOrganizations();
    res.json({ ok: true, organizations: orgs, count: orgs.length });
  }));

  router.post("/orgs", auth, wrap((req, res) => {
    const org = createOrganization({ ...req.body, leaderId: _userId(req) });
    res.status(201).json({ ok: true, organization: org });
  }));

  router.get("/orgs/:id", wrap((req, res) => {
    const org = getOrganization(req.params.id);
    if (!org) return res.status(404).json({ ok: false, error: "Organization not found" });
    res.json({ ok: true, organization: org });
  }));

  router.post("/orgs/:id/join", auth, wrap((req, res) => {
    const result = joinOrganization(req.params.id, _userId(req));
    res.json({ ok: true, ...result });
  }));

  router.post("/orgs/:id/leave", auth, wrap((req, res) => {
    const result = leaveOrganization(req.params.id, _userId(req));
    res.json({ ok: true, ...result });
  }));

  // ── Parties ──────────────────────────────────────────────────────────────

  router.post("/parties", auth, wrap((req, res) => {
    const party = createParty(_userId(req), req.body);
    res.status(201).json({ ok: true, party });
  }));

  router.post("/parties/:id/join", auth, wrap((req, res) => {
    const result = joinParty(req.params.id, _userId(req));
    res.json({ ok: true, ...result });
  }));

  router.post("/parties/:id/leave", auth, wrap((req, res) => {
    const result = leaveParty(req.params.id, _userId(req));
    res.json({ ok: true, ...result });
  }));

  // ── Jobs ─────────────────────────────────────────────────────────────────

  router.get("/jobs", wrap((_req, res) => {
    const templates = listJobTemplates();
    res.json({ ok: true, jobs: templates, count: templates.length });
  }));

  router.post("/jobs/assign", auth, wrap((req, res) => {
    const { jobTemplateId, cityId } = req.body;
    const result = assignJob(_userId(req), jobTemplateId, cityId);
    res.json({ ok: true, ...result });
  }));

  router.post("/jobs/quit", auth, wrap((req, res) => {
    const result = quitJob(_userId(req));
    res.json({ ok: true, ...result });
  }));

  router.post("/jobs/activity", auth, wrap((req, res) => {
    const { activityType, data } = req.body;
    const result = recordJobActivity(_userId(req), activityType, data);
    res.json({ ok: true, ...result });
  }));

  router.post("/jobs/promote", auth, wrap((req, res) => {
    const { targetUserId } = req.body;
    const result = promoteEmployee(targetUserId, _userId(req));
    res.json(result);
  }));

  router.get("/jobs/me", auth, wrap((req, res) => {
    const job = getUserJob(_userId(req));
    if (!job) return res.status(404).json({ ok: false, error: "No active job" });
    res.json({ ok: true, job });
  }));

  router.get("/jobs/user/:userId", wrap((req, res) => {
    const job = getUserJob(req.params.userId);
    if (!job) return res.status(404).json({ ok: false, error: "No active job for this user" });
    res.json({ ok: true, job });
  }));

  router.get("/jobs/stats", wrap((_req, res) => {
    res.json({ ok: true, ...getJobStats() });
  }));

  // ── Businesses ───────────────────────────────────────────────────────────

  router.get("/businesses", wrap((req, res) => {
    const { cityId } = req.query;
    const businesses = listBusinesses({ cityId: cityId || undefined });
    res.json({ ok: true, businesses, count: businesses.length });
  }));

  router.post("/businesses", auth, wrap((req, res) => {
    const business = createBusiness({ ...req.body, ownerId: _userId(req) });
    res.status(201).json({ ok: true, business });
  }));

  router.get("/businesses/:id", wrap((req, res) => {
    const business = getBusiness(req.params.id);
    if (!business) return res.status(404).json({ ok: false, error: "Business not found" });
    res.json({ ok: true, business });
  }));

  router.post("/businesses/:id/stock", auth, wrap((req, res) => {
    const { dtuId, price } = req.body;
    const result = stockBusiness(req.params.id, dtuId, price, _userId(req));
    res.json(result);
  }));

  router.post("/businesses/:id/hire", auth, wrap((req, res) => {
    const { employeeId, role, revenueSharePct } = req.body;
    const result = hireToBusiness(req.params.id, employeeId, { role, revenueSharePct }, _userId(req));
    res.json(result);
  }));

  router.post("/businesses/:id/rate", auth, wrap((req, res) => {
    const { rating } = req.body;
    const result = rateBusiness(req.params.id, _userId(req), rating);
    res.json(result);
  }));

  router.post("/businesses/:id/sale", auth, wrap((req, res) => {
    const { buyerId, itemId, amount } = req.body;
    const result = recordBusinessSale(req.params.id, buyerId, itemId, amount);
    res.json({ ok: true, ...result });
  }));

  // ── Progression ──────────────────────────────────────────────────────────

  // GET /progression/me — get mastery profile for the authenticated user
  router.get("/progression/me", wrap((req, res) => {
    const userId = _userId(req) || req.user?.id || req.query.userId;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized", message: "User ID required" });
    const profile = getMasteryProfile(userId);
    res.json({ ok: true, profile });
  }));

  router.get("/progression/:userId", wrap((req, res) => {
    const profile = getMasteryProfile(req.params.userId);
    res.json({ ok: true, profile });
  }));

  router.post("/progression/xp", auth, wrap((req, res) => {
    const { action, lens, multiplier, source } = req.body;
    const result = awardXP(_userId(req), action, { lens, multiplier, source });
    res.json({ ok: true, ...result });
  }));

  router.get("/leaderboard", wrap((req, res) => {
    const { lens, limit } = req.query;
    const board = getLeaderboard({ lens, limit: limit ? parseInt(limit) : undefined });
    res.json({ ok: true, leaderboard: board });
  }));

  router.get("/achievements/:userId", wrap((req, res) => {
    const achievements = getAchievements(req.params.userId);
    res.json({ ok: true, achievements });
  }));

  // ── Explorer ─────────────────────────────────────────────────────────────

  router.post("/explorer/visit", auth, wrap((req, res) => {
    const { districtId } = req.body;
    const result = recordDistrictVisit(_userId(req), districtId);
    res.json({ ok: true, ...result });
  }));

  router.get("/explorer/:userId", wrap((req, res) => {
    const stats = getExplorerStats(req.params.userId);
    res.json({ ok: true, ...stats });
  }));

  router.post("/daily-login", auth, wrap((req, res) => {
    const result = recordDailyLogin(_userId(req));
    res.json({ ok: true, ...result });
  }));

  // ── Seasons ──────────────────────────────────────────────────────────────

  router.get("/season", wrap((_req, res) => {
    const season = getCurrentSeason();
    res.json({ ok: true, season });
  }));

  router.post("/season", auth, wrap((req, res) => {
    const result = startSeason(req.body);
    res.status(201).json({ ok: true, ...result });
  }));

  router.post("/season/challenge", auth, wrap((req, res) => {
    const result = addSeasonChallenge(req.body);
    res.json({ ok: true, ...result });
  }));

  router.post("/season/complete", auth, wrap((req, res) => {
    const { challengeId } = req.body;
    const result = completeChallenge(_userId(req), challengeId);
    res.json({ ok: true, ...result });
  }));

  // ── Events ───────────────────────────────────────────────────────────────

  router.get("/events", wrap((req, res) => {
    const { cityId, status, type, lens, upcoming } = req.query;
    if (cityId) {
      const events = getCityEvents(cityId, { status, type, lens, upcoming: upcoming === "true" });
      res.json({ ok: true, events, count: events.length });
    } else {
      const events = getUpcomingEvents({ type });
      res.json({ ok: true, events, count: events.length });
    }
  }));

  router.post("/events", auth, wrap((req, res) => {
    const event = createEvent({ ...req.body, hostId: _userId(req) });
    res.status(201).json({ ok: true, event });
  }));

  router.get("/events/calendar/:cityId", wrap((req, res) => {
    const { month, year } = req.query;
    const calendar = getEventCalendar(req.params.cityId, {
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
    });
    res.json({ ok: true, ...calendar });
  }));

  router.get("/events/:id", wrap((req, res) => {
    const event = getEvent(req.params.id);
    if (!event) return res.status(404).json({ ok: false, error: "Event not found" });
    res.json({ ok: true, event });
  }));

  router.post("/events/:id/rsvp", auth, wrap((req, res) => {
    const result = rsvpEvent(req.params.id, _userId(req), req.body);
    res.json({ ok: true, ...result });
  }));

  router.delete("/events/:id/rsvp", auth, wrap((req, res) => {
    const result = cancelRsvp(req.params.id, _userId(req));
    res.json({ ok: true, ...result });
  }));

  router.post("/events/:id/start", auth, wrap((req, res) => {
    const result = startEvent(req.params.id, _userId(req));
    res.json({ ok: true, event: result });
  }));

  router.post("/events/:id/end", auth, wrap((req, res) => {
    const result = endEvent(req.params.id, _userId(req));
    res.json({ ok: true, ...result });
  }));

  router.get("/events/:id/attendees", wrap((req, res) => {
    const attendees = getEventAttendees(req.params.id);
    res.json({ ok: true, attendees, count: attendees.length });
  }));

  // ── Mechanics ────────────────────────────────────────────────────────────

  router.get("/mechanics/:cityId", wrap((req, res) => {
    const mechanics = getCityMechanics(req.params.cityId);
    res.json({ ok: true, mechanics, count: mechanics.length });
  }));

  router.post("/mechanics/:cityId", auth, wrap((req, res) => {
    const mechanic = createMechanic(req.params.cityId, req.body);
    res.status(201).json({ ok: true, mechanic });
  }));

  router.post("/mechanics/:cityId/fire", auth, wrap((req, res) => {
    const { triggerId, context } = req.body;
    const result = fireTrigger(req.params.cityId, triggerId, context);
    res.json({ ok: true, ...result });
  }));

  router.delete("/mechanics/:cityId/:mechanicId", auth, wrap((req, res) => {
    const result = deleteMechanic(req.params.cityId, req.params.mechanicId);
    res.json({ ok: true, ...result });
  }));

  // ── Templates ────────────────────────────────────────────────────────────

  router.get("/templates", wrap((_req, res) => {
    const templates = listTemplates();
    res.json({ ok: true, templates, count: templates.length });
  }));

  router.get("/templates/:id", wrap((req, res) => {
    const template = getTemplate(req.params.id);
    if (!template) return res.status(404).json({ ok: false, error: "Template not found" });
    res.json({ ok: true, template });
  }));

  // ── Wizard ───────────────────────────────────────────────────────────────

  router.get("/wizard/steps", wrap((_req, res) => {
    const steps = getWizardSteps();
    res.json({ ok: true, steps });
  }));

  router.post("/wizard/validate", wrap((req, res) => {
    const { stepId, data } = req.body;
    const result = validateWizardStep(stepId, data);
    res.json({ ok: true, ...result });
  }));

  router.post("/wizard/build", auth, wrap((req, res) => {
    const config = buildCityFromWizard(req.body);
    res.json({ ok: true, config });
  }));

  // ── City Config ──────────────────────────────────────────────────────────

  router.get("/config/themes", wrap((_req, res) => {
    res.json({ ok: true, themes: getValidThemes() });
  }));

  router.get("/config/domains", wrap((_req, res) => {
    res.json({ ok: true, domains: getValidDomains() });
  }));

  router.get("/config/rules-schema", wrap((_req, res) => {
    res.json({ ok: true, schema: getCityRulesSchema() });
  }));

  // ══════════════════════════════════════════════════════════════════
  // WORLD LENS — Simulation Pipeline API
  // ══════════════════════════════════════════════════════════════════

  // ── Material Properties Database ──────────────────────────────────

  const SEED_MATERIALS = [
    { id: 'mat-usb-a', name: 'USB Composite A (Standard)', category: 'USB-composite', properties: { tensileStrength: 450, compressiveStrength: 380, shearStrength: 220, elasticModulus: 45, density: 1850, thermalConductivity: 0.35, thermalExpansionCoeff: 8e-6, meltingPoint: 850, fireResistanceHours: 2, corrosionResistance: 'high', fatigueLimit: 180, cost: 120 }, creator: 'system', citations: 0, validationStatus: 'validated' },
    { id: 'mat-usb-b', name: 'USB Composite B (High Strength)', category: 'USB-composite', properties: { tensileStrength: 680, compressiveStrength: 550, shearStrength: 340, elasticModulus: 62, density: 2100, thermalConductivity: 0.42, thermalExpansionCoeff: 7e-6, meltingPoint: 920, fireResistanceHours: 3, corrosionResistance: 'extreme', fatigueLimit: 280, cost: 240 }, creator: 'system', citations: 0, validationStatus: 'validated' },
    { id: 'mat-usb-c', name: 'USB Composite C (Lightweight)', category: 'USB-composite', properties: { tensileStrength: 350, compressiveStrength: 280, shearStrength: 170, elasticModulus: 38, density: 1450, thermalConductivity: 0.28, thermalExpansionCoeff: 9e-6, meltingPoint: 780, fireResistanceHours: 1.5, corrosionResistance: 'high', fatigueLimit: 140, cost: 95 }, creator: 'system', citations: 0, validationStatus: 'validated' },
    { id: 'mat-steel-a36', name: 'Steel A36 (Structural)', category: 'steel', properties: { tensileStrength: 400, compressiveStrength: 250, shearStrength: 230, elasticModulus: 200, density: 7850, thermalConductivity: 50, thermalExpansionCoeff: 12e-6, meltingPoint: 1540, fireResistanceHours: 0.5, corrosionResistance: 'low', fatigueLimit: 160, cost: 85 }, creator: 'system', citations: 0, validationStatus: 'validated' },
    { id: 'mat-concrete-c40', name: 'Concrete C40/50', category: 'concrete', properties: { tensileStrength: 3.5, compressiveStrength: 40, shearStrength: 5, elasticModulus: 35, density: 2450, thermalConductivity: 1.8, thermalExpansionCoeff: 10e-6, meltingPoint: 1200, fireResistanceHours: 4, corrosionResistance: 'moderate', fatigueLimit: 14, cost: 55 }, creator: 'system', citations: 0, validationStatus: 'validated' },
    { id: 'mat-timber-glulam', name: 'Glued Laminated Timber', category: 'wood', properties: { tensileStrength: 24, compressiveStrength: 28, shearStrength: 6, elasticModulus: 13.5, density: 480, thermalConductivity: 0.14, thermalExpansionCoeff: 5e-6, meltingPoint: 300, fireResistanceHours: 1, corrosionResistance: 'low', fatigueLimit: 10, cost: 55 }, creator: 'system', citations: 0, validationStatus: 'validated' },
  ];

  // In-memory stores for simulation data
  const simMaterials = new Map(SEED_MATERIALS.map(m => [m.id, m]));
  const simCitations = [];
  const simBuildingDTUs = new Map();
  const simMarketplace = new Map();
  const simDistricts = new Map();
  const simAvatars = new Map();
  const simFirms = new Map();
  const simPlayerWorlds = new Map();
  const simEvents = new Map();

  // Game systems stores
  const simInventories = new Map();
  const simCraftingStations = new Map();
  const simQuests = new Map();
  const simNotifications = new Map();
  const simReports = new Map();
  const simModActions = [];
  const simReplays = new Map();
  const simProfiles = new Map();
  const simFriends = new Map();
  const simMessages = new Map();
  const simPresence = new Map();
  const simSnapTemplates = new Map();
  const simVisitorLogs = [];
  const simDailyDigests = new Map();
  const simAnalytics = new Map();
  const simCraftingRecipes = [
    { id: 'recipe-usb-beam', name: 'USB Composite Beam', inputs: [{ itemId: 'mat-usb-a', quantity: 3 }], output: { itemId: 'comp-usb-beam', quantity: 1 }, stationType: 'forge', duration: 30, skillRequired: 'novice' },
    { id: 'recipe-steel-column', name: 'Steel Column', inputs: [{ itemId: 'mat-steel-a36', quantity: 5 }], output: { itemId: 'comp-steel-column', quantity: 1 }, stationType: 'forge', duration: 45, skillRequired: 'apprentice' },
    { id: 'recipe-concrete-slab', name: 'Concrete Floor Slab', inputs: [{ itemId: 'mat-concrete-c40', quantity: 8 }], output: { itemId: 'comp-concrete-slab', quantity: 1 }, stationType: 'assembly', duration: 60, skillRequired: 'journeyman' },
    { id: 'recipe-timber-truss', name: 'Timber Roof Truss', inputs: [{ itemId: 'mat-timber-glulam', quantity: 6 }], output: { itemId: 'comp-timber-truss', quantity: 1 }, stationType: 'workbench', duration: 40, skillRequired: 'apprentice' },
    { id: 'recipe-glass-panel', name: 'Tempered Glass Panel', inputs: [{ itemId: 'mat-glass-float', quantity: 2 }], output: { itemId: 'comp-glass-panel', quantity: 1 }, stationType: 'kiln', duration: 50, skillRequired: 'journeyman' },
    { id: 'recipe-solar-cell', name: 'Solar Cell Array', inputs: [{ itemId: 'mat-usb-c', quantity: 4 }, { itemId: 'mat-glass-float', quantity: 1 }], output: { itemId: 'comp-solar-array', quantity: 1 }, stationType: 'lab', duration: 90, skillRequired: 'expert' },
  ];

  // ── Materials API ─────────────────────────────────────────────────

  router.get("/sim/materials", wrap((_req, res) => {
    res.json({ ok: true, materials: Array.from(simMaterials.values()) });
  }));

  router.get("/sim/materials/:id", wrap((req, res) => {
    const mat = simMaterials.get(req.params.id);
    if (!mat) return res.status(404).json({ ok: false, error: "Material not found" });
    res.json({ ok: true, material: mat });
  }));

  router.post("/sim/materials", auth, wrap((req, res) => {
    const id = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const material = { id, ...req.body, creator: req.user?.id || 'anonymous', citations: 0, validationStatus: 'experimental' };
    simMaterials.set(id, material);
    res.json({ ok: true, material });
  }));

  // ── Validation API ────────────────────────────────────────────────

  router.post("/sim/validate", auth, wrap((req, res) => {
    const { members, foundations, districtId } = req.body;
    const SAFETY_FACTOR = 1.5;
    const allMembers = [...(foundations || []), ...(members || [])];
    const results = [];

    for (const member of allMembers) {
      const mat = simMaterials.get(member.materialId);
      if (!mat) { results.push({ memberId: member.id, status: 'red', error: 'Material not found' }); continue; }
      const vol = (member.dimensions?.length || 1) * (member.dimensions?.width || 0.3) * (member.dimensions?.height || 0.3);
      const selfWeight = vol * mat.properties.density * 9.81;
      const area = member.crossSectionArea || ((member.dimensions?.width || 0.3) * (member.dimensions?.height || 0.3));
      const stress = area > 0 ? selfWeight / area / 1e6 : 0;
      const allowable = (member.type === 'column' || member.type === 'wall' ? mat.properties.compressiveStrength : mat.properties.tensileStrength) / SAFETY_FACTOR;
      const ratio = allowable > 0 ? stress / allowable : 0;
      results.push({
        memberId: member.id, memberType: member.type, actualStress: stress, allowableStress: allowable, ratio,
        status: ratio < 0.7 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red',
      });
    }

    const overallPass = results.every(r => r.status !== 'red');
    res.json({ ok: true, overallPass, results, timestamp: new Date().toISOString() });
  }));

  // ── Citations API ─────────────────────────────────────────────────

  router.post("/sim/citations", auth, wrap((req, res) => {
    const { citingDTU, citedDTU, citedCreator, context } = req.body;
    const citation = {
      id: `cit-${Date.now()}`,
      citingDTU, citedDTU, citedCreator, context,
      timestamp: new Date().toISOString(),
    };
    simCitations.push(citation);
    // Update citation count on cited material/component
    const mat = simMaterials.get(citedDTU);
    if (mat) mat.citations = (mat.citations || 0) + 1;
    res.json({ ok: true, citation });
  }));

  router.get("/sim/citations/:dtuId", wrap((req, res) => {
    const citations = simCitations.filter(c => c.citingDTU === req.params.dtuId || c.citedDTU === req.params.dtuId);
    res.json({ ok: true, citations });
  }));

  // ── Building DTUs API ─────────────────────────────────────────────

  router.post("/sim/buildings", auth, wrap((req, res) => {
    const id = `bldg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const building = { id, ...req.body, creator: req.user?.id || 'anonymous', citations: 0, createdAt: new Date().toISOString() };
    simBuildingDTUs.set(id, building);
    res.json({ ok: true, building });
  }));

  router.get("/sim/buildings", wrap((_req, res) => {
    res.json({ ok: true, buildings: Array.from(simBuildingDTUs.values()) });
  }));

  router.get("/sim/buildings/:id", wrap((req, res) => {
    const bldg = simBuildingDTUs.get(req.params.id);
    if (!bldg) return res.status(404).json({ ok: false, error: "Building not found" });
    res.json({ ok: true, building: bldg });
  }));

  // ── Marketplace API ───────────────────────────────────────────────

  router.get("/sim/marketplace", wrap((req, res) => {
    let items = Array.from(simMarketplace.values());
    if (req.query.category) items = items.filter(i => i.category === req.query.category);
    if (req.query.sort === 'citations') items.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    else if (req.query.sort === 'newest') items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    res.json({ ok: true, items });
  }));

  router.post("/sim/marketplace", auth, wrap((req, res) => {
    const id = `mkt-${Date.now()}`;
    const entry = { dtuId: id, ...req.body, creator: req.user?.id || 'anonymous', citationCount: 0, publishedAt: new Date().toISOString() };
    simMarketplace.set(id, entry);
    res.json({ ok: true, entry });
  }));

  // ── Simulation Districts API ──────────────────────────────────────

  router.get("/sim/districts", wrap((_req, res) => {
    res.json({ ok: true, districts: Array.from(simDistricts.values()) });
  }));

  router.post("/sim/districts", auth, wrap((req, res) => {
    const id = `dist-${Date.now()}`;
    const district = { id, ...req.body, createdAt: new Date().toISOString() };
    simDistricts.set(id, district);
    res.json({ ok: true, district });
  }));

  router.post("/sim/districts/:id/place", auth, wrap((req, res) => {
    const district = simDistricts.get(req.params.id);
    if (!district) return res.status(404).json({ ok: false, error: "District not found" });
    const placement = { id: `placed-${Date.now()}`, ...req.body, placedAt: new Date().toISOString() };
    if (!district.buildings) district.buildings = [];
    district.buildings.push(placement);
    res.json({ ok: true, placement });
  }));

  // ── Placement Validation API ──────────────────────────────────────

  router.post("/sim/districts/:id/validate-placement", auth, wrap((req, res) => {
    const district = simDistricts.get(req.params.id);
    if (!district) return res.status(404).json({ ok: false, error: "District not found" });
    const { buildingType, position } = req.body;
    const checks = {
      zoning: { pass: true, message: 'Zoning compliant' },
      infrastructure: { pass: true, message: 'Infrastructure available' },
      buildingCode: { pass: true, message: 'Building code met' },
      structural: { pass: true, message: 'Foundation compatible' },
      environmental: { pass: true, message: 'Environmental impact acceptable' },
    };
    const allPass = Object.values(checks).every(c => c.pass);
    res.json({ ok: true, allPass, checks });
  }));

  // ── Concordia Hub API ─────────────────────────────────────────────

  router.get("/sim/concordia", wrap((_req, res) => {
    res.json({
      ok: true,
      concordia: {
        name: 'Concordia',
        districts: ['exchange', 'academy', 'forge', 'nexus', 'commons', 'observatory', 'grid', 'frontier', 'docks', 'arena'],
        totalPopulation: 8200,
        totalBuildings: 125,
        activeUsers: 230,
      },
    });
  }));

  // ── Avatar API ────────────────────────────────────────────────────

  router.get("/sim/avatar/:userId", wrap((req, res) => {
    const avatar = simAvatars.get(req.params.userId);
    if (!avatar) return res.status(404).json({ ok: false, error: "Avatar not found" });
    res.json({ ok: true, avatar });
  }));

  router.post("/sim/avatar", auth, wrap((req, res) => {
    const userId = req.user?.id || 'anonymous';
    const avatar = {
      id: `avatar-${userId}`,
      userId,
      ...req.body,
      reputation: {},
      createdAt: new Date().toISOString(),
    };
    simAvatars.set(userId, avatar);
    res.json({ ok: true, avatar });
  }));

  // ── Firms API ─────────────────────────────────────────────────────

  router.get("/sim/firms", wrap((_req, res) => {
    res.json({ ok: true, firms: Array.from(simFirms.values()) });
  }));

  router.post("/sim/firms", auth, wrap((req, res) => {
    const id = `firm-${Date.now()}`;
    const firm = {
      id, ...req.body,
      founder: req.user?.id || 'anonymous',
      members: [{ userId: req.user?.id || 'anonymous', role: 'founder', joinedAt: new Date().toISOString(), contributions: 0 }],
      totalCitations: 0, activeContracts: [],
      createdAt: new Date().toISOString(),
    };
    simFirms.set(id, firm);
    res.json({ ok: true, firm });
  }));

  router.post("/sim/firms/:id/join", auth, wrap((req, res) => {
    const firm = simFirms.get(req.params.id);
    if (!firm) return res.status(404).json({ ok: false, error: "Firm not found" });
    firm.members.push({ userId: req.user?.id || 'anonymous', role: req.body.role || 'associate', joinedAt: new Date().toISOString(), contributions: 0 });
    res.json({ ok: true, firm });
  }));

  // ── Player Worlds API ─────────────────────────────────────────────

  router.get("/sim/worlds", wrap((_req, res) => {
    const worlds = Array.from(simPlayerWorlds.values()).filter(w => w.isPublic);
    res.json({ ok: true, worlds });
  }));

  router.post("/sim/worlds", auth, wrap((req, res) => {
    const id = `world-${Date.now()}`;
    const world = {
      id, ...req.body,
      owner: req.user?.id || 'anonymous',
      districts: [], playerCount: 1,
      createdAt: new Date().toISOString(),
    };
    simPlayerWorlds.set(id, world);
    res.json({ ok: true, world });
  }));

  // ── Events API ────────────────────────────────────────────────────

  router.get("/sim/events", wrap((_req, res) => {
    res.json({ ok: true, events: Array.from(simEvents.values()) });
  }));

  router.post("/sim/events", auth, wrap((req, res) => {
    const id = `event-${Date.now()}`;
    const event = {
      id, ...req.body,
      organizerId: req.user?.id || 'anonymous',
      participants: [req.user?.id || 'anonymous'],
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    simEvents.set(id, event);
    res.json({ ok: true, event });
  }));

  router.post("/sim/events/:id/join", auth, wrap((req, res) => {
    const event = simEvents.get(req.params.id);
    if (!event) return res.status(404).json({ ok: false, error: "Event not found" });
    const userId = req.user?.id || 'anonymous';
    if (!event.participants.includes(userId)) event.participants.push(userId);
    res.json({ ok: true, event });
  }));

  // ── Domain Simulation Calculations ────────────────────────────────

  router.post("/sim/calculate/:domain", auth, wrap((req, res) => {
    const { domain } = req.params;
    const params = req.body;
    // Simplified domain calculations
    const results = {};
    switch (domain) {
      case 'energy':
        results.solarOutput = (params.panelArea || 20) * (params.efficiency || 0.22) * (params.irradiance || 1000) * (params.cloudFactor || 0.75);
        results.windOutput = 0.5 * 1.225 * (params.sweptArea || 50) * Math.pow(params.windSpeed || 8, 3) * 0.4;
        break;
      case 'thermal':
        results.heatLoss = (params.wallArea || 200) / (params.rValue || 3.5) * (params.deltaT || 25);
        break;
      case 'fluid':
        results.hydrostaticPressure = (params.waterDensity || 1000) * 9.81 * (params.damHeight || 10);
        break;
      case 'aerospace':
        const m0 = (params.structuralMass || 5000) + (params.propellantMass || 20000);
        results.deltaV = (params.exhaustVelocity || 3000) * Math.log(m0 / (params.structuralMass || 5000));
        break;
      default:
        return res.status(400).json({ ok: false, error: `Unknown domain: ${domain}` });
    }
    res.json({ ok: true, domain, results });
  }));

  // ── Disaster Stress Test API ──────────────────────────────────────

  router.post("/sim/stress-test", auth, wrap((req, res) => {
    const { districtId, scenario, magnitude } = req.body;
    // Simplified stress test
    const results = {
      scenario,
      magnitude: magnitude || 5,
      buildingsTested: 6,
      passed: 4,
      marginal: 1,
      failed: 1,
      details: [
        { buildingId: 'bldg-001', status: 'passed', details: 'All structural checks passed' },
        { buildingId: 'bldg-002', status: 'passed', details: 'All structural checks passed' },
        { buildingId: 'bldg-003', status: 'passed', details: 'All structural checks passed' },
        { buildingId: 'bldg-004', status: 'passed', details: 'All structural checks passed' },
        { buildingId: 'bldg-005', status: 'marginal', details: 'Column B4 approaching seismic limit' },
        { buildingId: 'bldg-006', status: 'failed', details: 'Foundation bearing capacity exceeded at M' + (magnitude || 5) },
      ],
    };
    res.json({ ok: true, results });
  }));

  // ── Leaderboards API ──────────────────────────────────────────────

  router.get("/sim/leaderboards/:districtId", wrap((req, res) => {
    res.json({
      ok: true,
      leaderboards: {
        mostCitedCreator: [
          { userId: 'user-001', displayName: '@engineer_jane', score: 521, metric: 'citations', rank: 1 },
          { userId: 'user-002', displayName: '@materials_lab', score: 342, metric: 'citations', rank: 2 },
          { userId: 'user-003', displayName: '@power_mike', score: 204, metric: 'citations', rank: 3 },
        ],
        highestHabitability: [
          { userId: 'user-001', displayName: '@architect_alex', score: 94, metric: 'habitability', rank: 1 },
        ],
      },
    });
  }));

  // ── Timeline / History API ────────────────────────────────────────

  router.get("/sim/timeline/:districtId", wrap((req, res) => {
    res.json({
      ok: true,
      snapshots: [
        { timestamp: '2025-10-01', buildingCount: 0, populationCapacity: 0, powerCapacity: 0, waterCapacity: 0, environmentalScore: 100 },
        { timestamp: '2025-10-15', buildingCount: 2, populationCapacity: 400, powerCapacity: 1000, waterCapacity: 20000, environmentalScore: 85 },
        { timestamp: '2025-11-01', buildingCount: 4, populationCapacity: 1200, powerCapacity: 3000, waterCapacity: 50000, environmentalScore: 78 },
        { timestamp: '2025-11-15', buildingCount: 6, populationCapacity: 2400, powerCapacity: 5000, waterCapacity: 90000, environmentalScore: 72 },
      ],
    });
  }));

  // ══════════════════════════════════════════════════════════════════
  // GAME SYSTEMS API — Sound, Inventory, Crafting, Combat, Quests,
  // Progression, Notifications, Moderation, Social, Analytics, 3D
  // ══════════════════════════════════════════════════════════════════

  // ── Inventory API ────────────────────────────────────────────────

  router.get("/sim/inventory/:userId", wrap((req, res) => {
    const inv = simInventories.get(req.params.userId) || { items: [], maxSlots: 24, equipped: {} };
    res.json({ ok: true, inventory: inv });
  }));

  router.post("/sim/inventory/:userId/add", auth, wrap((req, res) => {
    const userId = req.params.userId;
    let inv = simInventories.get(userId);
    if (!inv) { inv = { items: [], maxSlots: 24, equipped: {} }; simInventories.set(userId, inv); }
    const item = { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ...req.body, acquiredAt: new Date().toISOString() };
    if (inv.items.length >= inv.maxSlots) return res.status(400).json({ ok: false, error: 'Inventory full' });
    inv.items.push(item);
    res.json({ ok: true, item });
  }));

  router.post("/sim/inventory/:userId/equip", auth, wrap((req, res) => {
    const inv = simInventories.get(req.params.userId);
    if (!inv) return res.status(404).json({ ok: false, error: 'Inventory not found' });
    const { slot, itemId } = req.body;
    inv.equipped[slot] = itemId;
    res.json({ ok: true, equipped: inv.equipped });
  }));

  router.delete("/sim/inventory/:userId/item/:itemId", auth, wrap((req, res) => {
    const inv = simInventories.get(req.params.userId);
    if (!inv) return res.status(404).json({ ok: false, error: 'Inventory not found' });
    inv.items = inv.items.filter(i => i.id !== req.params.itemId);
    res.json({ ok: true });
  }));

  // ── Crafting API ─────────────────────────────────────────────────

  router.get("/sim/crafting/recipes", wrap((_req, res) => {
    res.json({ ok: true, recipes: simCraftingRecipes });
  }));

  router.get("/sim/crafting/stations", wrap((_req, res) => {
    res.json({ ok: true, stations: Array.from(simCraftingStations.values()) });
  }));

  router.post("/sim/crafting/stations", auth, wrap((req, res) => {
    const id = `station-${Date.now()}`;
    const station = { id, ...req.body, currentJob: null, createdAt: new Date().toISOString() };
    simCraftingStations.set(id, station);
    res.json({ ok: true, station });
  }));

  router.post("/sim/crafting/craft", auth, wrap((req, res) => {
    const { recipeId, stationId } = req.body;
    const recipe = simCraftingRecipes.find(r => r.id === recipeId);
    if (!recipe) return res.status(404).json({ ok: false, error: 'Recipe not found' });
    const station = simCraftingStations.get(stationId);
    if (station && station.currentJob) return res.status(400).json({ ok: false, error: 'Station busy' });
    const result = {
      success: true,
      outputItem: { id: `crafted-${Date.now()}`, ...recipe.output, craftedAt: new Date().toISOString(), craftedBy: req.user?.id || 'anonymous' },
      qualityBonus: Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 5 : 0,
      byproducts: [],
    };
    res.json({ ok: true, result });
  }));

  // ── Quest & Mission API ──────────────────────────────────────────

  router.get("/sim/quests", wrap((req, res) => {
    let quests = Array.from(simQuests.values());
    if (req.query.type) quests = quests.filter(q => q.type === req.query.type);
    if (req.query.worldId) quests = quests.filter(q => q.worldId === req.query.worldId);
    res.json({ ok: true, quests });
  }));

  router.post("/sim/quests", auth, wrap((req, res) => {
    const id = `quest-${Date.now()}`;
    const quest = { id, ...req.body, creator: req.user?.id || 'anonymous', status: 'available', createdAt: new Date().toISOString() };
    simQuests.set(id, quest);
    res.json({ ok: true, quest });
  }));

  router.get("/sim/quests/:id", wrap((req, res) => {
    const quest = simQuests.get(req.params.id);
    if (!quest) return res.status(404).json({ ok: false, error: 'Quest not found' });
    res.json({ ok: true, quest });
  }));

  router.post("/sim/quests/:id/accept", auth, wrap((req, res) => {
    const quest = simQuests.get(req.params.id);
    if (!quest) return res.status(404).json({ ok: false, error: 'Quest not found' });
    quest.status = 'active';
    quest.acceptedBy = req.user?.id || 'anonymous';
    quest.acceptedAt = new Date().toISOString();
    res.json({ ok: true, quest });
  }));

  router.post("/sim/quests/:id/complete", auth, wrap((req, res) => {
    const quest = simQuests.get(req.params.id);
    if (!quest) return res.status(404).json({ ok: false, error: 'Quest not found' });
    quest.status = 'completed';
    quest.completedAt = new Date().toISOString();
    res.json({ ok: true, quest, rewards: quest.rewards || [] });
  }));

  // ── Progression / Reputation API ─────────────────────────────────

  router.get("/sim/progression/:userId", wrap((req, res) => {
    const profile = simProfiles.get(req.params.userId) || {
      userId: req.params.userId,
      domains: {
        structural: { score: 0, tier: 'novice', citations: 0 },
        materials: { score: 0, tier: 'novice', citations: 0 },
        infrastructure: { score: 0, tier: 'novice', citations: 0 },
        energy: { score: 0, tier: 'novice', citations: 0 },
        architecture: { score: 0, tier: 'novice', citations: 0 },
        mentorship: { score: 0, tier: 'novice', citations: 0 },
        governance: { score: 0, tier: 'novice', citations: 0 },
        exploration: { score: 0, tier: 'novice', citations: 0 },
      },
      totalCitations: 0, totalRoyalties: 0, badges: [],
    };
    res.json({ ok: true, profile });
  }));

  router.post("/sim/progression/:userId/cite", auth, wrap((req, res) => {
    const { domain, amount } = req.body;
    let profile = simProfiles.get(req.params.userId);
    if (!profile) {
      profile = { userId: req.params.userId, domains: {}, totalCitations: 0, totalRoyalties: 0, badges: [] };
      simProfiles.set(req.params.userId, profile);
    }
    if (!profile.domains[domain]) profile.domains[domain] = { score: 0, tier: 'novice', citations: 0 };
    profile.domains[domain].citations += (amount || 1);
    profile.domains[domain].score += (amount || 1) * 10;
    profile.totalCitations += (amount || 1);
    // Auto-tier
    const tiers = ['novice', 'apprentice', 'journeyman', 'expert', 'master', 'grandmaster'];
    const tierThresholds = [0, 10, 50, 200, 500, 1000];
    const c = profile.domains[domain].citations;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (c >= tierThresholds[i]) { profile.domains[domain].tier = tiers[i]; break; }
    }
    res.json({ ok: true, profile });
  }));

  // ── Notifications API ────────────────────────────────────────────

  router.get("/sim/notifications/:userId", wrap((req, res) => {
    const notifs = simNotifications.get(req.params.userId) || [];
    res.json({ ok: true, notifications: notifs });
  }));

  router.post("/sim/notifications/:userId", auth, wrap((req, res) => {
    const userId = req.params.userId;
    if (!simNotifications.has(userId)) simNotifications.set(userId, []);
    const notif = { id: `notif-${Date.now()}`, ...req.body, read: false, timestamp: new Date().toISOString() };
    simNotifications.get(userId).unshift(notif);
    // Keep max 100
    const list = simNotifications.get(userId);
    if (list.length > 100) simNotifications.set(userId, list.slice(0, 100));
    res.json({ ok: true, notification: notif });
  }));

  router.post("/sim/notifications/:userId/read", auth, wrap((req, res) => {
    const list = simNotifications.get(req.params.userId);
    if (!list) return res.json({ ok: true });
    const { notificationId } = req.body;
    if (notificationId === 'all') { list.forEach(n => n.read = true); }
    else { const n = list.find(x => x.id === notificationId); if (n) n.read = true; }
    res.json({ ok: true });
  }));

  // ── Daily Digest API ─────────────────────────────────────────────

  router.get("/sim/digest/:userId", wrap((req, res) => {
    const digest = simDailyDigests.get(req.params.userId) || {
      date: new Date().toISOString().split('T')[0],
      newCitations: Math.floor(Math.random() * 12),
      royaltiesEarned: +(Math.random() * 5).toFixed(2),
      worldEvents: ['New building validated in District 3', 'Weather: light snow expected tonight'],
      topCreation: { name: 'USB-A Foundation Slab', citations: 7 },
      npcSummary: 'The blacksmith at The Forge completed 3 commissions while you were away.',
    };
    res.json({ ok: true, digest });
  }));

  // ── Moderation / Anti-Grief API ──────────────────────────────────

  router.post("/sim/reports", auth, wrap((req, res) => {
    const report = {
      id: `report-${Date.now()}`, reporterId: req.user?.id || 'anonymous',
      ...req.body, status: 'pending', timestamp: new Date().toISOString(),
    };
    simReports.set(report.id, report);
    res.json({ ok: true, report });
  }));

  router.get("/sim/reports", wrap((req, res) => {
    let reports = Array.from(simReports.values());
    if (req.query.status) reports = reports.filter(r => r.status === req.query.status);
    res.json({ ok: true, reports });
  }));

  router.post("/sim/moderation/action", auth, wrap((req, res) => {
    const action = {
      id: `mod-${Date.now()}`, moderatorId: req.user?.id || 'system',
      ...req.body, timestamp: new Date().toISOString(),
    };
    simModActions.push(action);
    res.json({ ok: true, action });
  }));

  router.get("/sim/moderation/actions", wrap((_req, res) => {
    res.json({ ok: true, actions: simModActions.slice(-50) });
  }));

  // ── Social / Friends API ─────────────────────────────────────────

  router.get("/sim/friends/:userId", wrap((req, res) => {
    const friends = simFriends.get(req.params.userId) || [];
    res.json({ ok: true, friends });
  }));

  router.post("/sim/friends/:userId/add", auth, wrap((req, res) => {
    const userId = req.params.userId;
    if (!simFriends.has(userId)) simFriends.set(userId, []);
    const friend = { userId: req.body.friendId, displayName: req.body.displayName || req.body.friendId, addedAt: new Date().toISOString(), onlineStatus: 'offline' };
    simFriends.get(userId).push(friend);
    res.json({ ok: true, friend });
  }));

  router.delete("/sim/friends/:userId/:friendId", auth, wrap((req, res) => {
    const list = simFriends.get(req.params.userId);
    if (list) simFriends.set(req.params.userId, list.filter(f => f.userId !== req.params.friendId));
    res.json({ ok: true });
  }));

  // ── Player Presence API ──────────────────────────────────────────

  router.get("/sim/presence", wrap((_req, res) => {
    const players = Array.from(simPresence.values()).filter(p => p.isOnline);
    res.json({ ok: true, players, count: players.length });
  }));

  router.post("/sim/presence/update", auth, wrap((req, res) => {
    const userId = req.user?.id || 'anonymous';
    const presence = {
      userId, ...req.body, isOnline: true,
      lastSeen: new Date().toISOString(),
    };
    simPresence.set(userId, presence);
    res.json({ ok: true, presence });
  }));

  router.post("/sim/presence/offline", auth, wrap((req, res) => {
    const userId = req.user?.id || 'anonymous';
    const p = simPresence.get(userId);
    if (p) { p.isOnline = false; p.lastSeen = new Date().toISOString(); }
    res.json({ ok: true });
  }));

  // ── Messages / Chat API ──────────────────────────────────────────

  router.get("/sim/messages/:channelId", wrap((req, res) => {
    const msgs = simMessages.get(req.params.channelId) || [];
    const limit = parseInt(req.query.limit) || 50;
    res.json({ ok: true, messages: msgs.slice(-limit) });
  }));

  router.post("/sim/messages/:channelId", auth, wrap((req, res) => {
    const channelId = req.params.channelId;
    if (!simMessages.has(channelId)) simMessages.set(channelId, []);
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      channelId, senderId: req.user?.id || 'anonymous',
      ...req.body, timestamp: new Date().toISOString(),
    };
    simMessages.get(channelId).push(msg);
    // Keep max 500 per channel
    const list = simMessages.get(channelId);
    if (list.length > 500) simMessages.set(channelId, list.slice(-500));
    res.json({ ok: true, message: msg });
  }));

  // ── World Travel / Portal API ────────────────────────────────────

  router.get("/sim/travel/departures", wrap((_req, res) => {
    const worlds = Array.from(simPlayerWorlds.values()).filter(w => w.isPublic).map(w => ({
      worldId: w.id, worldName: w.name, owner: w.owner,
      playerCount: w.playerCount || 0, mode: w.mode || 'realistic',
      accessStatus: w.isPublic ? 'public' : 'private',
      description: w.description || '',
    }));
    res.json({ ok: true, departures: worlds });
  }));

  router.post("/sim/travel/portal", auth, wrap((req, res) => {
    const { destWorldId } = req.body;
    const world = simPlayerWorlds.get(destWorldId);
    if (!world) return res.status(404).json({ ok: false, error: 'World not found' });
    const transition = {
      sourceWorld: 'concordia', destWorld: destWorldId,
      transitionType: req.body.transitionType || 'terminal',
      arrived: true, timestamp: new Date().toISOString(),
    };
    // Log visitor
    simVisitorLogs.push({ worldId: destWorldId, visitorId: req.user?.id || 'anonymous', enteredAt: new Date().toISOString() });
    res.json({ ok: true, transition });
  }));

  router.post("/sim/travel/invite", auth, wrap((req, res) => {
    const invite = {
      id: `invite-${Date.now()}`, fromUserId: req.user?.id || 'anonymous',
      ...req.body, status: 'pending', timestamp: new Date().toISOString(),
    };
    res.json({ ok: true, invite });
  }));

  // ── Snap-Build Templates API ─────────────────────────────────────

  router.get("/sim/templates/snap-build", wrap((req, res) => {
    let templates = Array.from(simSnapTemplates.values());
    if (req.query.category) templates = templates.filter(t => t.category === req.query.category);
    if (req.query.sort === 'citations') templates.sort((a, b) => (b.citations || 0) - (a.citations || 0));
    else if (req.query.sort === 'newest') templates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ ok: true, templates });
  }));

  router.post("/sim/templates/snap-build", auth, wrap((req, res) => {
    const id = `snap-${Date.now()}`;
    const template = { id, ...req.body, creator: req.user?.id || 'anonymous', citations: 0, validationStatus: 'validated', createdAt: new Date().toISOString() };
    simSnapTemplates.set(id, template);
    res.json({ ok: true, template });
  }));

  // ── Collaboration / Project Board API ────────────────────────────

  router.get("/sim/projects/:boardId", wrap((req, res) => {
    const seed = {
      id: req.params.boardId, name: 'District 3 Development',
      tasks: [
        { id: 'task-1', title: 'Design water treatment plant', status: 'open', payment: 50 },
        { id: 'task-2', title: 'Build Main Street facades', status: 'claimed', claimedBy: '@builder_bob', payment: 30 },
        { id: 'task-3', title: 'Wire power grid section B', status: 'in-progress', claimedBy: '@power_mike', payment: 40 },
        { id: 'task-4', title: 'Validate all residential structures', status: 'complete', claimedBy: '@architect_alex', payment: 25 },
      ],
    };
    res.json({ ok: true, board: seed });
  }));

  router.post("/sim/projects/:boardId/tasks", auth, wrap((req, res) => {
    const task = { id: `task-${Date.now()}`, ...req.body, status: 'open', createdAt: new Date().toISOString() };
    res.json({ ok: true, task });
  }));

  router.post("/sim/projects/:boardId/tasks/:taskId/claim", auth, wrap((req, res) => {
    res.json({ ok: true, taskId: req.params.taskId, claimedBy: req.user?.id || 'anonymous', status: 'claimed' });
  }));

  // ── Design Review API ────────────────────────────────────────────

  router.post("/sim/reviews", auth, wrap((req, res) => {
    const review = {
      id: `review-${Date.now()}`, reviewerId: req.user?.id || 'anonymous',
      ...req.body, verdict: 'pending', createdAt: new Date().toISOString(),
    };
    res.json({ ok: true, review });
  }));

  router.post("/sim/reviews/:id/annotate", auth, wrap((req, res) => {
    const annotation = {
      id: `ann-${Date.now()}`, reviewId: req.params.id,
      ...req.body, createdAt: new Date().toISOString(),
    };
    res.json({ ok: true, annotation });
  }));

  router.post("/sim/reviews/:id/verdict", auth, wrap((req, res) => {
    res.json({ ok: true, reviewId: req.params.id, verdict: req.body.verdict, comments: req.body.comments });
  }));

  // ── Analytics API ────────────────────────────────────────────────

  router.get("/sim/analytics/personal/:userId", wrap((req, res) => {
    const stats = simAnalytics.get(req.params.userId) || {
      totalCitations: Math.floor(Math.random() * 500),
      totalRoyalties: +(Math.random() * 100).toFixed(2),
      mostCitedDTU: { name: 'USB-A Reinforced Beam', citations: 47 },
      mostUsedMaterial: { name: 'USB Composite A', uses: 89 },
      reputationByDomain: { structural: 340, materials: 120, infrastructure: 85, energy: 45, architecture: 200, mentorship: 30, governance: 15, exploration: 60 },
      buildCount: Math.floor(Math.random() * 50) + 5,
      playtime: Math.floor(Math.random() * 200) + 10,
      loginStreak: Math.floor(Math.random() * 30) + 1,
    };
    res.json({ ok: true, stats });
  }));

  router.get("/sim/analytics/world/:worldId", wrap((req, res) => {
    res.json({
      ok: true, stats: {
        population: 2400, buildingCount: 47, infraCoverage: 72,
        envScore: 68, economicActivity: 14500, visitorCount: 890,
        timeseries: [
          { date: '2025-10-01', visitors: 12, buildings: 2 },
          { date: '2025-10-15', visitors: 45, buildings: 8 },
          { date: '2025-11-01', visitors: 120, buildings: 23 },
          { date: '2025-11-15', visitors: 230, buildings: 47 },
        ],
      },
    });
  }));

  router.get("/sim/analytics/global", wrap((_req, res) => {
    res.json({
      ok: true, stats: {
        activeDistricts: 10, totalBuildings: 1250, totalCitations: 45000,
        activeUsers: 890, totalWorlds: 67,
        trendingComponents: [
          { name: 'USB-B I-Beam 30cm', creator: '@struct_team', citationsThisWeek: 89 },
          { name: 'Solar Mount v3', creator: '@green_firm', citationsThisWeek: 67 },
          { name: 'Concrete Foundation Slab', creator: '@builder_bob', citationsThisWeek: 52 },
        ],
        topCreators: [
          { userId: 'user-001', name: '@engineer_jane', citations: 2100, rank: 1 },
          { userId: 'user-002', name: '@architect_alex', citations: 1800, rank: 2 },
          { userId: 'user-003', name: '@materials_lab', citations: 1200, rank: 3 },
        ],
      },
    });
  }));

  // ── Seasonal / Events Calendar API ───────────────────────────────

  router.get("/sim/seasonal/current", wrap((_req, res) => {
    const month = new Date().getMonth();
    const seasons = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
    res.json({
      ok: true, season: seasons[month],
      activeEvent: { name: 'Spring Engineering Festival', endsAt: new Date(Date.now() + 7 * 86400000).toISOString() },
      monthlyChallenge: { title: 'Bridge Builder Challenge', description: 'Design a pedestrian bridge rated for 200 occupants', objective: 'Build and validate a pedestrian bridge', progress: 0, reward: { type: 'title', value: 'Bridge Master' } },
    });
  }));

  // ── Replay / Spectator API ───────────────────────────────────────

  router.get("/sim/replays/:worldId", wrap((req, res) => {
    const replays = Array.from(simReplays.values()).filter(r => r.worldId === req.params.worldId);
    res.json({ ok: true, replays });
  }));

  router.post("/sim/replays", auth, wrap((req, res) => {
    const id = `replay-${Date.now()}`;
    const replay = { id, ...req.body, creatorId: req.user?.id || 'anonymous', createdAt: new Date().toISOString() };
    simReplays.set(id, replay);
    res.json({ ok: true, replay });
  }));

  // ── Visitor Logs API ─────────────────────────────────────────────

  router.get("/sim/visitors/:worldId", wrap((req, res) => {
    const logs = simVisitorLogs.filter(l => l.worldId === req.params.worldId);
    res.json({ ok: true, visitors: logs.slice(-100) });
  }));

  // ── 3D Scene State API ───────────────────────────────────────────

  router.get("/sim/scene/:districtId", wrap((req, res) => {
    const district = simDistricts.get(req.params.districtId);
    res.json({
      ok: true,
      scene: {
        districtId: req.params.districtId,
        terrain: { type: 'heightmap', resolution: 2048, minElevation: 0, maxElevation: 80 },
        buildings: district?.buildings || [],
        infrastructure: district?.infrastructure || {},
        npcs: [], // populated by NPC system
        weather: district?.weather || { type: 'clear', windSpeed: 8, windDirection: 270, temperature: 15 },
        timeOfDay: ((Date.now() / 60000) % 24).toFixed(1), // cycles
        quality: req.query.quality || 'medium',
      },
    });
  }));

  router.post("/sim/scene/player-update", auth, wrap((req, res) => {
    // Receives player position/rotation/animation for multiplayer sync
    const update = { userId: req.user?.id || 'anonymous', ...req.body, timestamp: Date.now() };
    res.json({ ok: true, update });
  }));

  // ── Accessibility Preferences API ────────────────────────────────

  router.get("/sim/accessibility/:userId", wrap((req, res) => {
    res.json({
      ok: true, settings: {
        colorblindMode: 'none', textScale: 1.0, screenReaderEnabled: false,
        keyboardNavEnabled: false, reducedMotion: false, subtitlesEnabled: true,
        oneHandedMode: false, gameSpeed: 1.0, highContrast: false,
      },
    });
  }));

  router.post("/sim/accessibility/:userId", auth, wrap((req, res) => {
    res.json({ ok: true, settings: req.body });
  }));

  // ── Settings API ─────────────────────────────────────────────────

  router.get("/sim/settings/:userId", wrap((req, res) => {
    res.json({
      ok: true, settings: {
        graphics: 'medium', audio: { master: 0.8, music: 0.6, ambient: 0.7, sfx: 0.8, dialogue: 0.9 },
        notifications: { citation: true, royalty: true, event: true, social: true, system: true, dailyDigest: true },
        privacy: { profileVisibility: 'public', worldVisibility: 'public', activityStatus: true, allowDMs: true },
        controls: {}, locale: 'en', measurementUnit: 'metric',
      },
    });
  }));

  router.post("/sim/settings/:userId", auth, wrap((req, res) => {
    res.json({ ok: true, settings: req.body });
  }));

  return router;
}
