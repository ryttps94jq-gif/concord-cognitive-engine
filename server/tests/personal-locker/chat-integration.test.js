// server/tests/personal-locker/chat-integration.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateLockerSalt, deriveLockerKey, encryptBlob } from "../../lib/personal-locker/crypto.js";
import { fetchPersonalSubstrate } from "../../lib/chat-context-pipeline.js";

async function makeLockerKey() {
  const salt = generateLockerSalt();
  return { key: await deriveLockerKey("testpass", "user-test", salt), salt };
}

function makeEncryptedRow(userId, lockerKey, payload, lensHint = "research") {
  const plain = Buffer.from(JSON.stringify(payload));
  const { iv, ciphertext, authTag } = encryptBlob(plain, lockerKey);
  return { id: `pdtu_test_${Math.random().toString(36).slice(2)}`, user_id: userId, lens_domain: lensHint, content_type: "document", title: payload.title, iv, encrypted_content: ciphertext, auth_tag: authTag, created_at: new Date().toISOString() };
}

function makeMockDb(rows) {
  return {
    prepare: (sql) => ({
      all: () => rows,
      get: () => rows[0] || null,
      run: () => {},
    }),
  };
}

describe("fetchPersonalSubstrate", () => {
  it("returns empty array when locker key is null", () => {
    const result = fetchPersonalSubstrate("user-1", null, "test query", {});
    assert.deepEqual(result, []);
  });

  it("returns empty array when userId is null", async () => {
    const { key } = await makeLockerKey();
    const result = fetchPersonalSubstrate(null, key, "test query", {});
    assert.deepEqual(result, []);
  });

  it("returns empty array when db is null", async () => {
    const { key } = await makeLockerKey();
    const result = fetchPersonalSubstrate("user-1", key, "test query", null);
    assert.deepEqual(result, []);
  });

  it("decrypts and returns personal DTUs matching query", async () => {
    const userId = "user-test";
    const { key } = await makeLockerKey();

    const payload = {
      id: "pdtu_abc",
      title: "Machine Learning Research Notes",
      analysis: { summary: "neural network deep learning research paper notes", tags: ["machine", "learning"], extractedText: "neural networks are the foundation" },
    };

    const row = makeEncryptedRow(userId, key, payload, "research");
    const db = makeMockDb([row]);

    const results = fetchPersonalSubstrate(userId, key, "machine learning research", db);
    assert.ok(results.length > 0, "Should return at least one result");
    assert.equal(results[0].title, "Machine Learning Research Notes");
    assert.equal(results[0].scope, "personal");
  });

  it("does not return DTUs for a different user's query context", async () => {
    const user1 = "user-one";
    const user2 = "user-two";
    const { key: key1 } = await makeLockerKey();
    const { key: key2 } = await makeLockerKey();

    const payload = { id: "pdtu_private", title: "Private Notes", analysis: { summary: "private sensitive data", tags: [], extractedText: "" } };
    const row = makeEncryptedRow(user1, key1, payload);
    const db = makeMockDb([row]);

    // User 2's key cannot decrypt user 1's DTU — should return empty or skip
    const results = fetchPersonalSubstrate(user2, key2, "private sensitive", db);
    // Either empty (all rows failed decryption) or results contain no user1 data
    for (const r of results) {
      assert.notEqual(r.title, "Private Notes");
    }
  });

  it("returns at most 5 results", async () => {
    const userId = "user-test";
    const { key } = await makeLockerKey();

    const rows = Array.from({ length: 10 }, (_, i) => makeEncryptedRow(userId, key, {
      id: `pdtu_${i}`,
      title: `Note ${i}`,
      analysis: { summary: "research data analysis study", tags: ["research"], extractedText: "research" },
    }));

    const db = makeMockDb(rows);
    const results = fetchPersonalSubstrate(userId, key, "research", db);
    assert.ok(results.length <= 5, `Expected ≤5 results, got ${results.length}`);
  });
});
