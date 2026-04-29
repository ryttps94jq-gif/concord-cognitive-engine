// server/tests/agentic/worktree.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createWorktree,
  getWorktree,
  recordOperation,
  commitWorktree,
  listWorktrees,
  archiveWorktree,
} from "../../lib/agentic/worktree.js";

describe("Worktree", () => {
  it("createWorktree returns a worktree with expected shape", () => {
    const wt = createWorktree("emergent-wt-1");
    assert.equal(wt.emergentId, "emergent-wt-1");
    assert.ok(typeof wt.branch === "string" && wt.branch.length > 0);
    assert.ok(wt.branch.includes("emergent-wt-1"));
    assert.deepEqual(wt.operations, []);
    assert.equal(wt.status, "open");
    assert.ok(typeof wt.dtuPrefix === "string");
    assert.ok(typeof wt.createdAt === "number");
  });

  it("getWorktree retrieves by emergentId + branch", () => {
    const wt = createWorktree("emergent-wt-2");
    const found = getWorktree("emergent-wt-2", wt.branch);
    assert.ok(found !== null);
    assert.equal(found.branch, wt.branch);
  });

  it("getWorktree returns null for unknown branch", () => {
    const result = getWorktree("emergent-wt-2", "emergent/fake/work-0000-000000");
    assert.equal(result, null);
  });

  it("recordOperation appends to worktree operations", () => {
    const wt = createWorktree("emergent-wt-3");
    recordOperation("emergent-wt-3", wt.branch, {
      type: "create_dtu",
      payload: { id: `${wt.dtuPrefix}test`, title: "Test DTU" },
    });
    const updated = getWorktree("emergent-wt-3", wt.branch);
    assert.equal(updated.operations.length, 1);
    assert.equal(updated.operations[0].type, "create_dtu");
    assert.ok(typeof updated.operations[0].timestamp === "number");
  });

  it("recordOperation throws for closed worktree", async () => {
    const wt = createWorktree("emergent-wt-4");
    await commitWorktree("emergent-wt-4", wt.branch);
    assert.throws(
      () => recordOperation("emergent-wt-4", wt.branch, { type: "annotate", payload: {} }),
      /not open/
    );
  });

  it("commitWorktree returns merged:true for empty operations", async () => {
    const wt = createWorktree("emergent-wt-5");
    const result = await commitWorktree("emergent-wt-5", wt.branch);
    assert.equal(result.merged, true);
    const after = getWorktree("emergent-wt-5", wt.branch);
    assert.equal(after.status, "merged");
  });

  it("commitWorktree blocks delete_dtu on non-worktree DTUs", async () => {
    const wt = createWorktree("emergent-wt-6");
    recordOperation("emergent-wt-6", wt.branch, {
      type: "delete_dtu",
      payload: { id: "public-dtu-abc" }, // NOT prefixed with wt.dtuPrefix
    });
    const result = await commitWorktree("emergent-wt-6", wt.branch);
    assert.equal(result.merged, false);
    assert.ok(result.violations?.length > 0);
    const after = getWorktree("emergent-wt-6", wt.branch);
    assert.equal(after.status, "rejected");
  });

  it("commitWorktree returns merged:false for unknown branch", async () => {
    const result = await commitWorktree("emergent-wt-7", "emergent/fake/work-0000-000000");
    assert.equal(result.merged, false);
    assert.ok(result.reason);
  });

  it("listWorktrees returns all open worktrees for an emergent", () => {
    createWorktree("emergent-wt-list");
    createWorktree("emergent-wt-list");
    const list = listWorktrees("emergent-wt-list");
    assert.ok(list.length >= 2);
    assert.ok(list.every(wt => wt.emergentId === "emergent-wt-list"));
  });

  it("archiveWorktree removes the worktree from registry", () => {
    const wt = createWorktree("emergent-wt-archive");
    archiveWorktree("emergent-wt-archive", wt.branch);
    const found = getWorktree("emergent-wt-archive", wt.branch);
    assert.equal(found, null);
  });
});
