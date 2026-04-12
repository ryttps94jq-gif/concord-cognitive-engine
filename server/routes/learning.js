/**
 * Learning Routes — HTTP surface for the Concord Educational Engine.
 *
 * This file hosts endpoints for the Credential Genome (System 7) and
 * the Education Economics (System 10). All handlers are total: they
 * never throw. On error they respond with { ok: false, error: ... }.
 *
 * External dependencies (royaltyCascade, walletService) are loaded
 * via dynamic import inside handlers so the module is importable even
 * when the surrounding economy is not wired.
 */

import express from "express";
import { createCredentialGenome } from "../lib/credential-genome.js";
import { createEducationEconomics, EDUCATION_RATES } from "../lib/education-economics.js";

// Module-level singletons so the in-memory ledger and credential store
// persist across requests within a single process.
let _economics = null;
let _credentials = null;

async function loadRoyaltyCascade() {
  try {
    const mod = await import("../economy/royalty-cascade.js");
    return (mod && (mod.royaltyCascade || mod.default || mod)) || null;
  } catch (_err) {
    return null;
  }
}

async function loadWalletService() {
  try {
    const mod = await import("../economy/coin-service.js");
    if (!mod) return null;
    const wallet = {};
    if (typeof mod.mintCoins === "function") {
      wallet.credit = async (uid, amt, m) => mod.mintCoins(uid, amt, m);
    }
    if (typeof mod.burnCoins === "function") {
      wallet.debit = async (uid, amt, m) => mod.burnCoins(uid, amt, m);
    }
    if (typeof mod.getBalance === "function") {
      wallet.balance = async (uid) => mod.getBalance(uid);
    }
    return Object.keys(wallet).length ? wallet : null;
  } catch (_err) {
    return null;
  }
}

async function getEconomics() {
  if (_economics) return _economics;
  const [royaltyCascade, walletService] = await Promise.all([
    loadRoyaltyCascade(),
    loadWalletService(),
  ]);
  _economics = createEducationEconomics({
    db: globalThis.concordDb || null,
    royaltyCascade,
    walletService,
  });
  return _economics;
}

function getCredentials() {
  if (_credentials) return _credentials;
  const dtuStore = globalThis.dtuStore || null;
  const knowledgeGenome =
    (globalThis.knowledgeGenome && typeof globalThis.knowledgeGenome === "function")
      ? globalThis.knowledgeGenome
      : async (_studentId) => ({});
  _credentials = createCredentialGenome({
    dtuStore,
    knowledgeGenome,
    db: globalThis.concordDb || null,
  });
  return _credentials;
}

function getCallerId(req) {
  if (!req) return "anonymous";
  return (
    (req.user && (req.user.id || req.user.userId)) ||
    req.headers["x-user-id"] ||
    req.query.studentId ||
    (req.body && req.body.studentId) ||
    "anonymous"
  );
}

export default function createLearningRouter() {
  const router = express.Router();

  // ------------------------------------------------------------------
  // GET /api/learning/credential/:studentId/:domain
  // Generate a credential (charges credentialGeneration).
  // ------------------------------------------------------------------
  router.get("/credential/:studentId/:domain", async (req, res) => {
    try {
      const { studentId, domain } = req.params;
      const creds = getCredentials();
      const economics = await getEconomics();

      // Charge generation cost (0 if free)
      let charge = null;
      try {
        charge = await economics.chargeCredentialGeneration(studentId);
      } catch (_err) {
        charge = { ok: false, error: "charge_failed" };
      }

      const credential = await creds.generateCredential(studentId, domain);
      return res.json({ ok: true, credential, charge });
    } catch (err) {
      return res.json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/learning/credential/verify
  // Body: { studentId, domain, credential }
  // ------------------------------------------------------------------
  router.post("/credential/verify", async (req, res) => {
    try {
      const body = req.body || {};
      const { studentId, domain, credential } = body;
      if (!credential) {
        return res.json({ ok: false, error: "credential_required" });
      }
      const creds = getCredentials();
      const result = await creds.verify(
        studentId || credential.studentId,
        domain || credential.domain,
        credential,
      );
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/learning/verify/:studentId/:domain
  // Companion read-only verification URL referenced by generated credentials.
  // ------------------------------------------------------------------
  router.get("/verify/:studentId/:domain", async (req, res) => {
    try {
      const { studentId, domain } = req.params;
      const creds = getCredentials();
      const list = await creds.listCredentials(studentId);
      const latest = (list || []).filter((c) => c.domain === domain).pop() || null;
      if (!latest) {
        return res.json({ ok: false, error: "no_credentials_found" });
      }
      const result = await creds.verify(studentId, domain, latest);
      return res.json({ ok: true, credential: latest, ...result });
    } catch (err) {
      return res.json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/learning/earnings/me
  // Returns education earnings for the calling user.
  // ------------------------------------------------------------------
  router.get("/earnings/me", async (req, res) => {
    try {
      const studentId = getCallerId(req);
      const since = req.query.since ? Number(req.query.since) : 0;
      const economics = await getEconomics();
      const earnings = await economics.getStudentEarnings(studentId, { since });
      return res.json(earnings);
    } catch (err) {
      return res.json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/learning/leaderboard
  // ?domain=...&timeframe=day|week|month|year|all
  // ------------------------------------------------------------------
  router.get("/leaderboard", async (req, res) => {
    try {
      const domain = req.query.domain ? String(req.query.domain) : undefined;
      const timeframe = req.query.timeframe ? String(req.query.timeframe) : "month";
      const economics = await getEconomics();
      const board = await economics.getLeaderboard({ domain, timeframe });
      return res.json(board);
    } catch (err) {
      return res.json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/learning/rates
  // Public rate card for the education economy.
  // ------------------------------------------------------------------
  router.get("/rates", async (_req, res) => {
    try {
      return res.json({ ok: true, rates: EDUCATION_RATES });
    } catch (err) {
      return res.json({ ok: false, error: String((err && err.message) || err) });
    }
  });

  return router;
}
