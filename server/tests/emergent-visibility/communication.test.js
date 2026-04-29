// server/tests/emergent-visibility/communication.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initiateCommunication, listCommunications } from "../../emergent/communication.js";

function makeMockDb() {
  const commsRows = [];
  const taskRows = [];
  return {
    prepare: (sql) => ({
      run: (...args) => {
        if (sql.includes("emergent_communications")) commsRows.push(args);
        if (sql.includes("emergent_tasks")) taskRows.push(args);
        if (sql.includes("UPDATE emergent_communications")) {
          // no-op for mock
        }
      },
      all: (...args) => {
        if (sql.includes("emergent_communications")) {
          return commsRows
            .filter(r => r[1] === args[0] || r[2] === args[0])
            .map(r => ({
              id: r[0], from_emergent_id: r[1], to_emergent_id: r[2],
              intent: r[3], context: r[4], initiated_at: r[5], status: r[6],
              from_name: null, to_name: null,
            }));
        }
        return [];
      },
    }),
    _commsRows: commsRows,
    _taskRows: taskRows,
  };
}

describe("initiateCommunication", () => {
  it("persists communication to db", () => {
    const db = makeMockDb();
    const from = { id: "e1", given_name: "Aria" };
    const to = { id: "e2", given_name: "Velion" };
    initiateCommunication({ from, to, intent: "Hello from Aria", context: {}, db, realtimeEmit: null });
    assert.ok(db._commsRows.length > 0, "Expected comm row to be inserted");
  });

  it("queues a task for the recipient", () => {
    const db = makeMockDb();
    const from = { id: "e1", given_name: "Aria" };
    const to = { id: "e2", given_name: "Velion" };
    initiateCommunication({ from, to, intent: "Test message", context: {}, db, realtimeEmit: null });
    assert.ok(db._taskRows.length > 0, "Expected task row to be inserted");
    // Task should be for the recipient (emergent_id is second positional arg)
    const taskRow = db._taskRows[0];
    assert.equal(taskRow[1], "e2"); // emergent_id = to.id
    // task_data JSON should reference the from emergent
    const taskData = JSON.parse(taskRow[2]);
    assert.equal(taskData.from_id, "e1");
    assert.ok(taskData.message_id?.startsWith("comm_"));
  });

  it("returns an exchange object with expected shape", () => {
    const db = makeMockDb();
    const from = { id: "e1", given_name: "Aria" };
    const to = { id: "e2", given_name: "Velion" };
    const result = initiateCommunication({ from, to, intent: "Hi", db, realtimeEmit: null });
    assert.ok(result.id.startsWith("comm_"));
    assert.equal(result.from_emergent_id, "e1");
    assert.equal(result.to_emergent_id, "e2");
    assert.equal(result.status, "pending");
    assert.ok(typeof result.initiated_at === "number");
  });

  it("calls realtimeEmit with communication event", () => {
    let emitted = null;
    const realtimeEmit = (event, payload) => { emitted = { event, payload }; };
    const db = makeMockDb();
    initiateCommunication({ from: { id: "e1", given_name: "Aria" }, to: { id: "e2", given_name: "Vel" }, intent: "Hi", db, realtimeEmit });
    assert.ok(emitted !== null);
    assert.equal(emitted.event, "emergent:activity");
    assert.equal(emitted.payload.type, "communication");
  });

  it("does not throw when db is null", () => {
    assert.doesNotThrow(() => {
      initiateCommunication({ from: { id: "e1" }, to: { id: "e2" }, intent: "Hi", db: null, realtimeEmit: null });
    });
  });
});

describe("listCommunications", () => {
  it("returns empty array when emergentId is null", () => {
    assert.deepEqual(listCommunications(null, makeMockDb()), []);
  });

  it("returns empty array when db is null", () => {
    assert.deepEqual(listCommunications("e1", null), []);
  });
});
