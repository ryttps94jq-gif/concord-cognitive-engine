// server/lib/personal-locker/crypto.js
// Per-user AES-256-GCM encryption for personal DTU locker.
// Key derivation uses Node's built-in crypto.scrypt — no extra dependencies.
// The derived key is never stored; it exists only in the _LOCKER_KEYS session map.

import crypto from "node:crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

/**
 * Generate a new random locker salt for a user (stored in users.locker_salt).
 * @returns {string} 64-char hex string
 */
export function generateLockerSalt() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Derive a 32-byte AES key from the user's plaintext password + their salt.
 * Only call this at login time while the plaintext password is available.
 * @param {string} plaintextPassword
 * @param {string} userId
 * @param {string} lockerSalt - hex string from users.locker_salt
 * @returns {Promise<Buffer>}
 */
export function deriveLockerKey(plaintextPassword, userId, lockerSalt) {
  return new Promise((resolve, reject) => {
    const secret = `${plaintextPassword}:${userId}`;
    const salt = Buffer.from(lockerSalt, "hex");
    crypto.scrypt(secret, salt, KEY_LEN, SCRYPT_PARAMS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/**
 * Encrypt a Buffer with AES-256-GCM.
 * @param {Buffer} plaintext
 * @param {Buffer} key - 32-byte key from deriveLockerKey
 * @returns {{ iv: Buffer, ciphertext: Buffer, authTag: Buffer }}
 */
export function encryptBlob(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, ciphertext, authTag };
}

/**
 * Decrypt an AES-256-GCM encrypted blob.
 * Throws if the auth tag doesn't match (tamper detection).
 * @param {{ iv: Buffer, ciphertext: Buffer, authTag: Buffer }} blob
 * @param {Buffer} key
 * @returns {Buffer}
 */
export function decryptBlob({ iv, ciphertext, authTag }, key) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(authTag));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
}

/**
 * Safe JSON reviver that blocks prototype pollution attempts.
 * Use with JSON.parse on any locker-encrypted data.
 */
export const SAFE_REVIVER = (k, v) => (k === "__proto__" || k === "constructor") ? undefined : v;
