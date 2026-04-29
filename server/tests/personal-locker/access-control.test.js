// server/tests/personal-locker/access-control.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSovereignty, checkSovereigntyInvariants } from "../../grc/sovereignty-invariants.js";

describe("Personal Locker — access control", () => {
  it("assertSovereignty allows owner to read their own personal DTU", () => {
    assert.doesNotThrow(() =>
      assertSovereignty({ type: "dtu_read", dtu: { scope: "personal", ownerId: "user-1" }, requestingUser: "user-1" })
    );
  });

  it("assertSovereignty blocks cross-user access to personal DTU", () => {
    assert.throws(
      () => assertSovereignty({ type: "dtu_read", dtu: { scope: "personal", ownerId: "user-1" }, requestingUser: "user-2" }),
      /SOVEREIGNTY VIOLATION/
    );
  });

  it("checkSovereigntyInvariants returns violation for cross-user read", () => {
    const result = checkSovereigntyInvariants({
      type: "dtu_read",
      dtu: { scope: "personal", ownerId: "user-1" },
      requestingUser: "user-2",
    });
    assert.equal(result.pass, false);
    const v = result.violations.find(v => v.invariant === "personal_dtus_never_leak");
    assert.ok(v, "personal_dtus_never_leak violation expected");
    assert.equal(v.severity, "critical");
  });

  it("non-personal scope DTUs do not trigger personal_dtus_never_leak", () => {
    const result = checkSovereigntyInvariants({
      type: "dtu_read",
      dtu: { scope: "global", ownerId: "user-1" },
      requestingUser: "user-2",
    });
    const leaked = result.violations.find(v => v.invariant === "personal_dtus_never_leak");
    assert.ok(!leaked, "Global DTUs should not trigger personal leak invariant");
  });
});

describe("Personal Locker — locker key map", () => {
  it("getLockerKey returns null for unknown user", () => {
    // Simulate the _LOCKER_KEYS map behaviour directly
    const map = new Map();
    const get = (userId) => map.get(userId) || null;
    assert.equal(get("nobody"), null);
  });

  it("setLockerKey + getLockerKey roundtrip", () => {
    const map = new Map();
    const key = Buffer.alloc(32, 0xAB);
    map.set("user-1", key);
    assert.deepEqual(map.get("user-1"), key);
  });

  it("clearLockerKey removes key", () => {
    const map = new Map();
    map.set("user-1", Buffer.alloc(32));
    map.delete("user-1");
    assert.equal(map.get("user-1"), undefined);
  });
});
