// server/tests/personal-locker/encryption.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateLockerSalt, deriveLockerKey, encryptBlob, decryptBlob } from "../../lib/personal-locker/crypto.js";

describe("Personal Locker — encryption", () => {
  it("generateLockerSalt returns 64-char hex string", () => {
    const salt = generateLockerSalt();
    assert.equal(typeof salt, "string");
    assert.equal(salt.length, 64);
    assert.match(salt, /^[0-9a-f]+$/);
  });

  it("deriveLockerKey returns 32-byte Buffer", async () => {
    const salt = generateLockerSalt();
    const key = await deriveLockerKey("correcthorsebatterystaple", "user-abc", salt);
    assert.ok(Buffer.isBuffer(key));
    assert.equal(key.length, 32);
  });

  it("same inputs produce same key", async () => {
    const salt = generateLockerSalt();
    const k1 = await deriveLockerKey("password", "uid", salt);
    const k2 = await deriveLockerKey("password", "uid", salt);
    assert.deepEqual(k1, k2);
  });

  it("different passwords produce different keys", async () => {
    const salt = generateLockerSalt();
    const k1 = await deriveLockerKey("password1", "uid", salt);
    const k2 = await deriveLockerKey("password2", "uid", salt);
    assert.notDeepEqual(k1, k2);
  });

  it("encryptBlob + decryptBlob roundtrip preserves plaintext", async () => {
    const salt = generateLockerSalt();
    const key = await deriveLockerKey("testpass", "user-1", salt);
    const plaintext = Buffer.from(JSON.stringify({ hello: "world", num: 42 }));
    const blob = encryptBlob(plaintext, key);
    const decrypted = decryptBlob(blob, key);
    assert.deepEqual(decrypted, plaintext);
  });

  it("ciphertext is not plaintext", async () => {
    const salt = generateLockerSalt();
    const key = await deriveLockerKey("testpass", "user-1", salt);
    const plaintext = Buffer.from("secret data");
    const { ciphertext } = encryptBlob(plaintext, key);
    assert.notDeepEqual(ciphertext, plaintext);
    assert.ok(!ciphertext.toString().includes("secret data"));
  });

  it("decryptBlob throws with wrong key", async () => {
    const salt = generateLockerSalt();
    const key1 = await deriveLockerKey("password", "user-1", salt);
    const key2 = await deriveLockerKey("different", "user-1", salt);
    const blob = encryptBlob(Buffer.from("secret"), key1);
    assert.throws(() => decryptBlob(blob, key2));
  });

  it("decryptBlob throws with tampered ciphertext", async () => {
    const salt = generateLockerSalt();
    const key = await deriveLockerKey("password", "user-1", salt);
    const blob = encryptBlob(Buffer.from("secret"), key);
    blob.ciphertext[0] ^= 0xff; // corrupt one byte
    assert.throws(() => decryptBlob(blob, key));
  });

  it("each encryption produces a unique IV", async () => {
    const salt = generateLockerSalt();
    const key = await deriveLockerKey("password", "user-1", salt);
    const plaintext = Buffer.from("same plaintext");
    const b1 = encryptBlob(plaintext, key);
    const b2 = encryptBlob(plaintext, key);
    assert.notDeepEqual(b1.iv, b2.iv);
    assert.notDeepEqual(b1.ciphertext, b2.ciphertext);
  });
});
