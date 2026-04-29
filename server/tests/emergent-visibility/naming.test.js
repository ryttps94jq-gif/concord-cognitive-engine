// server/tests/emergent-visibility/naming.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNameValid, isNameUnique, cleanNameResponse, NAME_RULES } from "../../emergent/name-validation.js";
import { nameEmergent, persistEmergentName, loadEmergentIdentity } from "../../emergent/naming.js";

// ── Mock DB ───────────────────────────────────────────────────────────────────

function makeMockDb(existingNames = []) {
  const rows = new Map(); // emergent_id → row
  return {
    prepare: (sql) => ({
      get: (...args) => {
        if (sql.includes("LOWER(given_name)")) {
          const name = args[0]?.toLowerCase();
          for (const r of rows.values()) {
            if (r.given_name?.toLowerCase() === name) return r;
          }
          return null;
        }
        if (sql.includes("WHERE emergent_id")) {
          return rows.get(args[0]) || null;
        }
        return null;
      },
      run: (...args) => {
        if (sql.includes("INSERT INTO emergent_identity") || sql.includes("ON CONFLICT")) {
          rows.set(args[0], {
            emergent_id: args[0],
            given_name: args[1],
            naming_origin: args[2],
            naming_metadata: args[3],
            identity_locked: 1,
          });
        }
      },
      all: () => [...rows.values()],
    }),
    _rows: rows,
  };
}

// Pre-seed some existing names
function makeSeededDb(names) {
  const db = makeMockDb();
  for (const [id, name] of names) {
    db._rows.set(id, { emergent_id: id, given_name: name, identity_locked: 1 });
  }
  return db;
}

// ── Name validation ───────────────────────────────────────────────────────────

describe("Name validation", () => {
  it("accepts valid names", () => {
    assert.equal(isNameValid("Aria"), true);
    assert.equal(isNameValid("Vel-ion"), true);
    assert.equal(isNameValid("Cor Ael"), true);
    assert.equal(isNameValid("E7"), true);
  });

  it("rejects empty and null", () => {
    assert.equal(isNameValid(""), false);
    assert.equal(isNameValid(null), false);
    assert.equal(isNameValid(undefined), false);
  });

  it("rejects names too short", () => {
    assert.equal(isNameValid("A"), false);
  });

  it("rejects names too long", () => {
    assert.equal(isNameValid("A".repeat(31)), false);
  });

  it("rejects reserved names", () => {
    assert.equal(isNameValid("admin"), false);
    assert.equal(isNameValid("SYSTEM"), false);
    assert.equal(isNameValid("Concord"), false);
    assert.equal(isNameValid("cipher"), false);
  });

  it("rejects names with forbidden chars", () => {
    assert.equal(isNameValid("Na<script>me"), false);
    assert.equal(isNameValid("Na@me"), false);
  });

  it("isNameUnique returns true when no db", () => {
    assert.equal(isNameUnique("Aria", null), true);
  });

  it("isNameUnique returns false for duplicate (case-insensitive)", () => {
    const db = makeSeededDb([["e1", "Aria"]]);
    assert.equal(isNameUnique("aria", db), false);
    assert.equal(isNameUnique("ARIA", db), false);
  });

  it("isNameUnique returns true for new name", () => {
    const db = makeSeededDb([["e1", "Aria"]]);
    assert.equal(isNameUnique("Velion", db), true);
  });
});

// ── Name cleaning ─────────────────────────────────────────────────────────────

describe("Name cleaning", () => {
  it("strips quotes", () => {
    assert.equal(cleanNameResponse('"Aria"'), "Aria");
    assert.equal(cleanNameResponse("'Velion'"), "Velion");
  });

  it("strips trailing punctuation", () => {
    assert.equal(cleanNameResponse("Aria."), "Aria");
    assert.equal(cleanNameResponse("Aria!"), "Aria");
  });

  it("trims whitespace", () => {
    assert.equal(cleanNameResponse("  Aria  "), "Aria");
  });

  it("collapses internal whitespace", () => {
    assert.equal(cleanNameResponse("Vel  Ion"), "Vel Ion");
  });

  it("truncates to 30 chars", () => {
    const long = "A".repeat(50);
    assert.ok(cleanNameResponse(long).length <= 30);
  });

  it("returns empty string for null/empty", () => {
    assert.equal(cleanNameResponse(""), "");
    assert.equal(cleanNameResponse(null), "");
  });
});

// ── Naming ────────────────────────────────────────────────────────────────────

describe("nameEmergent", () => {
  it("returns a name and method for a basic emergent", async () => {
    const db = makeMockDb();
    const { name, method } = await nameEmergent({ id: "e-test-1", role: "synthesizer" }, db);
    assert.ok(typeof name === "string" && name.length >= 2, `Expected valid name, got '${name}'`);
    assert.ok(typeof method === "string");
  });

  it("returns 'locked' method for identity-locked emergent with existing name", async () => {
    const db = makeMockDb();
    const { name, method } = await nameEmergent({ id: "e-test-2", given_name: "Aria", identity_locked: true }, db);
    assert.equal(method, "locked");
    assert.equal(name, "Aria");
  });

  it("produces unique names for different emergents", async () => {
    const db = makeMockDb();
    const { name: n1 } = await nameEmergent({ id: "e-unique-1" }, db);
    db._rows.set("e-unique-1", { emergent_id: "e-unique-1", given_name: n1, identity_locked: 1 });
    const { name: n2 } = await nameEmergent({ id: "e-unique-2" }, db);
    assert.notEqual(n1, n2);
  });

  it("produces valid names (pass isNameValid)", async () => {
    const db = makeMockDb();
    const { name } = await nameEmergent({ id: "e-valid-1" }, db);
    assert.ok(isNameValid(name), `Name '${name}' should be valid`);
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe("persistEmergentName + loadEmergentIdentity", () => {
  it("persists and loads identity", () => {
    const db = makeMockDb();
    persistEmergentName("e-persist-1", "Aria", "birth_context", db);
    const loaded = loadEmergentIdentity("e-persist-1", db);
    assert.ok(loaded !== null);
    assert.equal(loaded.given_name, "Aria");
    assert.equal(loaded.naming_origin, "birth_context");
  });

  it("returns null for unknown emergent", () => {
    const db = makeMockDb();
    const loaded = loadEmergentIdentity("e-unknown", db);
    assert.equal(loaded, null);
  });

  it("returns null when db is null", () => {
    const loaded = loadEmergentIdentity("e-test", null);
    assert.equal(loaded, null);
  });
});
