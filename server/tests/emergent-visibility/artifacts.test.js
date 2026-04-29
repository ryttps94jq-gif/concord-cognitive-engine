// server/tests/emergent-visibility/artifacts.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldProduceArtifact,
  classifyArtifactType,
  createAttributedArtifact,
  listEmergentArtifacts,
} from "../../emergent/artifacts.js";

function makeMockDb() {
  const rows = [];
  return {
    prepare: (sql) => ({
      run: (...args) => rows.push({ sql, args }),
      all: (...args) => rows.filter(r => r.args?.[0] === args[0]).map(r => ({
        id: r.args[0], emergent_id: r.args[1], observation: r.args[2],
        context: r.args[3], related_dtu_ids: r.args[4], created_at: r.args[5],
      })),
    }),
    _rows: rows,
  };
}

describe("shouldProduceArtifact", () => {
  it("synthesis tasks always produce artifacts", () => {
    assert.equal(shouldProduceArtifact({ task_type: "synthesis" }, {}), true);
  });

  it("governance tasks always produce artifacts", () => {
    assert.equal(shouldProduceArtifact({ task_type: "governance" }, {}), true);
  });

  it("dream produces artifact only when novelty > 0.5", () => {
    assert.equal(shouldProduceArtifact({ task_type: "dream" }, { metadata: { novelty: 0.8 } }), true);
    assert.equal(shouldProduceArtifact({ task_type: "dream" }, { metadata: { novelty: 0.3 } }), false);
    assert.equal(shouldProduceArtifact({ task_type: "dream" }, {}), false);
  });

  it("observation produces artifact only when significance > 0.7", () => {
    assert.equal(shouldProduceArtifact({ task_type: "observation" }, { metadata: { significance: 0.9 } }), true);
    assert.equal(shouldProduceArtifact({ task_type: "observation" }, { metadata: { significance: 0.5 } }), false);
  });

  it("communication produces artifact when consequential", () => {
    assert.equal(shouldProduceArtifact({ task_type: "communication" }, { metadata: { consequential: true } }), true);
    assert.equal(shouldProduceArtifact({ task_type: "communication" }, {}), false);
  });

  it("unknown task type does not produce artifact", () => {
    assert.equal(shouldProduceArtifact({ task_type: "unknown" }, {}), false);
  });
});

describe("classifyArtifactType", () => {
  it("maps task types to artifact types", () => {
    assert.equal(classifyArtifactType({ task_type: "synthesis" }), "synthesis_dtu");
    assert.equal(classifyArtifactType({ task_type: "governance" }), "deliberation_dtu");
    assert.equal(classifyArtifactType({ task_type: "dream" }), "dream_dtu");
    assert.equal(classifyArtifactType({ task_type: "observation" }), "observation_dtu");
    assert.equal(classifyArtifactType({ task_type: "communication" }), "message_dtu");
    assert.equal(classifyArtifactType({ task_type: "unknown" }), "emergent_dtu");
  });
});

describe("createAttributedArtifact", () => {
  it("returns null when db is null", () => {
    const result = createAttributedArtifact({ id: "e1", given_name: "Aria" }, { id: "t1", task_type: "synthesis", task_data: {} }, { finalText: "test" }, null);
    assert.equal(result, null);
  });

  it("creates artifact with expected shape", () => {
    const db = makeMockDb();
    const emergent = { id: "e1", given_name: "Aria", dominantLens: "research" };
    const task = { id: "t1", task_type: "synthesis", task_data: { lens: "research", sourceDTUs: ["dtu1"] } };
    const result = { finalText: "A new synthesis.", brainUsed: "subconscious" };

    const artifact = createAttributedArtifact(emergent, task, result, db);
    assert.ok(artifact !== null);
    assert.ok(artifact.id.startsWith("edtu_"));
    assert.equal(artifact.creator_emergent_id, "e1");
    assert.equal(artifact.created_by, "Aria");
    assert.equal(artifact.type, "synthesis_dtu");
    assert.equal(artifact.tier, "shadow");
    assert.equal(artifact.lens, "research");
  });
});

describe("listEmergentArtifacts", () => {
  it("returns empty array when emergentId is null", () => {
    assert.deepEqual(listEmergentArtifacts(null, makeMockDb()), []);
  });

  it("returns empty array when db is null", () => {
    assert.deepEqual(listEmergentArtifacts("e1", null), []);
  });
});
