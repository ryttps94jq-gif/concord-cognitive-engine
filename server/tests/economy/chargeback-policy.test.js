/**
 * Tests for the chargeback reserve policy.
 *
 * Covers:
 *   - allocateFromFee: routes 25% to chargebackReserve
 *   - payChargeback: succeeds when reserve sufficient
 *   - payChargeback: returns error when reserve insufficient
 *   - handleChargeback: covers chargeback from reserve
 *   - handleChargeback: flags for manual review when insufficient
 *
 * Run: node --test server/tests/economy/chargeback-policy.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import { initReservesSchema, allocateFromFee, payChargeback, getReserveBalance } from "../../economy/reserves.js";
import { handleChargeback, flagChargebackForManualReview } from "../../economy/chargeback-handler.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a fresh in-memory SQLite database with all required tables.
 */
function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  // audit_log table (required by economyAudit inside chargeback-handler)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      timestamp   TEXT NOT NULL,
      category    TEXT,
      action      TEXT NOT NULL,
      user_id     TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      request_id  TEXT,
      path        TEXT,
      method      TEXT,
      status_code INTEGER,
      details     TEXT
    );
  `);

  // purchases table (required by handleChargeback)
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id                        TEXT PRIMARY KEY,
      purchase_id               TEXT,
      buyer_id                  TEXT,
      seller_id                 TEXT,
      listing_id                TEXT,
      listing_type              TEXT,
      license_type              TEXT,
      amount                    REAL,
      source                    TEXT,
      status                    TEXT NOT NULL DEFAULT 'CREATED',
      ref_id                    TEXT,
      stripe_session_id         TEXT,
      stripe_payment_intent_id  TEXT,
      metadata_json             TEXT,
      created_at                TEXT NOT NULL,
      updated_at                TEXT NOT NULL
    );
  `);

  // Init the reserves schema
  initReservesSchema(db);

  return db;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("allocateFromFee", () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("routes exactly 25% to chargebackReserve and 75% to operatingReserve", () => {
    const result = allocateFromFee(db, {
      feeAmount:  100,   // $100 in Concord Coins
      sourceTxId: "tx_test_001",
      requestId:  "req_001",
      ip:         "127.0.0.1",
    });

    assert.ok(result.ok, "allocateFromFee should return ok");
    assert.strictEqual(result.chargebackAllocation, 25,   "25% to chargeback");
    assert.strictEqual(result.operatingAllocation,  75,   "75% to operating");

    const balance = getReserveBalance(db);
    assert.strictEqual(balance.chargebackReserve, 25, "chargebackReserve balance = 25");
    assert.strictEqual(balance.operatingReserve,  75, "operatingReserve balance = 75");
  });

  it("returns ok:true with zero allocations for a zero fee", () => {
    const result = allocateFromFee(db, { feeAmount: 0, sourceTxId: "tx_zero" });
    assert.ok(result.ok);
    assert.strictEqual(result.chargebackAllocation, 0);
    assert.strictEqual(result.operatingAllocation,  0);
  });

  it("accumulates correctly across multiple allocations", () => {
    allocateFromFee(db, { feeAmount: 40, sourceTxId: "tx_a" });
    allocateFromFee(db, { feeAmount: 60, sourceTxId: "tx_b" });

    const balance = getReserveBalance(db);
    assert.strictEqual(balance.chargebackReserve, 25,  "25% of 100 total");
    assert.strictEqual(balance.operatingReserve,  75,  "75% of 100 total");
  });
});

describe("payChargeback", () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    // Pre-fund the reserve with $500
    allocateFromFee(db, { feeAmount: 2000, sourceTxId: "tx_fund" }); // 25% of 2000 = $500
  });

  it("succeeds and debits chargebackReserve when funds are sufficient", () => {
    const balanceBefore = getReserveBalance(db).chargebackReserve;

    const result = payChargeback(db, {
      chargebackAmount: 100,
      sourceTxId:       "dispute_001",
      requestId:        "req_cb_001",
      ip:               "10.0.0.1",
    });

    assert.ok(result.ok, "payChargeback should succeed");
    assert.strictEqual(result.error, undefined, "no error on success");

    const balanceAfter = getReserveBalance(db).chargebackReserve;
    assert.strictEqual(balanceAfter, balanceBefore - 100, "balance reduced by chargeback amount");
  });

  it("returns ok:false with error when reserve is insufficient", () => {
    const result = payChargeback(db, {
      chargebackAmount: 99999,  // far more than the $500 reserve
      sourceTxId:       "dispute_big",
    });

    assert.strictEqual(result.ok,    false,                  "should fail");
    assert.strictEqual(result.error, "insufficient_reserve", "error code is insufficient_reserve");

    // Balance must be unchanged
    const balance = getReserveBalance(db).chargebackReserve;
    assert.strictEqual(balance, 500, "balance unchanged on failure");
  });
});

describe("handleChargeback", () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
  });

  it("returns no_purchase_found when payment_intent_id does not match any purchase", async () => {
    const result = await handleChargeback(db, {
      chargebackAmountCents: 5000,
      stripeDisputeId:       "dp_not_found",
      paymentIntentId:       "pi_unknown",
      requestId:             "req_001",
      ip:                    "1.2.3.4",
    });

    assert.ok(result.ok);
    assert.strictEqual(result.action, "no_purchase_found");
  });

  it("covers chargeback from reserve and marks purchase as charged_back", async () => {
    // Pre-fund the reserve ($1,000)
    allocateFromFee(db, { feeAmount: 4000, sourceTxId: "tx_fund" }); // 25% = $1000

    // Insert a purchase with a known payment_intent_id
    const now = new Date().toISOString().replace("T", " ").replace("Z", "");
    db.prepare(`
      INSERT INTO purchases
        (id, purchase_id, buyer_id, seller_id, amount, source, status,
         stripe_payment_intent_id, created_at, updated_at)
      VALUES ('pur_01', 'pur_01', 'user_buyer', 'user_seller', 50, 'marketplace', 'FULFILLED',
              'pi_stripe_test_001', ?, ?)
    `).run(now, now);

    const result = await handleChargeback(db, {
      chargebackAmountCents: 5000,          // $50 in cents
      stripeDisputeId:       "dp_cover_01",
      paymentIntentId:       "pi_stripe_test_001",
      requestId:             "req_cover",
      ip:                    "5.6.7.8",
    });

    assert.ok(result.ok);
    assert.strictEqual(result.action, "covered_by_reserve");

    // Purchase status updated
    const purchase = db.prepare("SELECT status FROM purchases WHERE id = 'pur_01'").get();
    assert.strictEqual(purchase.status, "charged_back");

    // Reserve reduced by $50
    const balance = getReserveBalance(db).chargebackReserve;
    assert.strictEqual(balance, 950, "reserve reduced by $50");
  });

  it("flags for manual review when reserve is insufficient", async () => {
    // Do NOT pre-fund the reserve — it remains at $0

    const now = new Date().toISOString().replace("T", " ").replace("Z", "");
    db.prepare(`
      INSERT INTO purchases
        (id, purchase_id, buyer_id, seller_id, amount, source, status,
         stripe_payment_intent_id, created_at, updated_at)
      VALUES ('pur_02', 'pur_02', 'user_b', 'user_s', 200, 'marketplace', 'FULFILLED',
              'pi_stripe_test_002', ?, ?)
    `).run(now, now);

    const result = await handleChargeback(db, {
      chargebackAmountCents: 20000,         // $200 in cents — exceeds $0 reserve
      stripeDisputeId:       "dp_manual_01",
      paymentIntentId:       "pi_stripe_test_002",
      requestId:             "req_manual",
      ip:                    "9.9.9.9",
    });

    assert.ok(result.ok);
    assert.strictEqual(result.action, "flagged_for_manual_review");

    // An audit entry should have been written
    const auditRow = db.prepare(
      "SELECT action FROM audit_log WHERE action = 'chargeback_manual_review_required' LIMIT 1"
    ).get();
    assert.ok(auditRow, "audit entry should exist");
  });

  it("looks up purchase by metadata_json LIKE when stripe_payment_intent_id column is absent", async () => {
    // Create a DB without the stripe_payment_intent_id column
    const dbNoCol = new Database(":memory:");
    dbNoCol.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, category TEXT,
        action TEXT NOT NULL, user_id TEXT, ip_address TEXT, user_agent TEXT,
        request_id TEXT, path TEXT, method TEXT, status_code INTEGER, details TEXT
      );
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY, purchase_id TEXT, buyer_id TEXT, seller_id TEXT,
        amount REAL, source TEXT, status TEXT NOT NULL DEFAULT 'CREATED',
        ref_id TEXT, stripe_session_id TEXT, metadata_json TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
    initReservesSchema(dbNoCol);
    // Pre-fund
    allocateFromFee(dbNoCol, { feeAmount: 4000, sourceTxId: "tx_fund_nc" });

    const now = new Date().toISOString().replace("T", " ").replace("Z", "");
    dbNoCol.prepare(`
      INSERT INTO purchases (id, purchase_id, buyer_id, seller_id, amount, source, status,
        metadata_json, created_at, updated_at)
      VALUES ('pur_nc_01', 'pur_nc_01', 'user_b', 'user_s', 30, 'marketplace', 'FULFILLED',
              '{"stripePaymentIntentId":"pi_meta_test_001"}', ?, ?)
    `).run(now, now);

    const result = await handleChargeback(dbNoCol, {
      chargebackAmountCents: 3000,
      stripeDisputeId:       "dp_meta_01",
      paymentIntentId:       "pi_meta_test_001",
      requestId:             "req_meta",
      ip:                    "2.2.2.2",
    });

    assert.ok(result.ok);
    assert.strictEqual(result.action, "covered_by_reserve");
  });
});
