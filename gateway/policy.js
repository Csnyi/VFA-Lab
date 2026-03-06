// policy.js
//
// VFA-Lab policy/token helper module
// ----------------------------------
// This module contains the minimal token logic used by the gateway:
//
//   - visa token issuing
//   - visa token verification
//   - revocation list loading / update
//
// Token format (MVP):
//   v1.<token_id>.<exp_ms>.<sig_b64url>
//
// Signature:
//   HMAC_SHA256( "<token_id>.<exp_ms>", HMAC_SECRET )
//
// Notes:
// - This is intentionally small and readable for demonstration purposes.
// - HMAC is acceptable for an MVP demo where issuer and verifier are the
//   same trust domain. A future version may switch to asymmetric signing
//   (for example ECDSA/Ed25519) if issuance and verification need to be
//   separated more cleanly.

import crypto from "crypto";
import fs from "fs";

/**
 * Convert bytes to base64url.
 *
 * Why base64url?
 * - safe in headers, JSON and URLs
 * - avoids '+' and '/' characters
 * - avoids '=' padding
 *
 * @param {Buffer|Uint8Array|string} buf
 * @returns {string}
 */
function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Convert a base64url string back to Buffer.
 *
 * Node's Buffer understands normal base64, so we:
 *   1) restore padding
 *   2) replace URL-safe characters
 *
 * @param {string} s
 * @returns {Buffer}
 */
function b64urlToBuf(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

/**
 * Load the revocation store from JSON file.
 *
 * Expected file shape:
 * {
 *   "revoked_token_ids": ["uuid-1", "uuid-2", ...]
 * }
 *
 * If the file is missing or invalid, we return an empty Set so the gateway
 * can still run in a demo environment.
 *
 * @param {string} path
 * @returns {Set<string>}
 */
export function loadRevocations(path) {
  try {
    const raw = fs.readFileSync(path, "utf-8");
    const obj = JSON.parse(raw);
    return new Set(obj.revoked_token_ids || []);
  } catch {
    return new Set();
  }
}

/**
 * Revoke a token ID by persisting it into the revocation JSON file.
 *
 * This implementation rewrites the whole file, which is fine for a small
 * laboratory demo. In production you would normally store revocations in a
 * database, cache, or append-safe event log.
 *
 * @param {string} path
 * @param {string} tokenId
 * @returns {{revoked_token_ids: string[]}}
 */
export function revokeTokenId(path, tokenId) {
  const set = loadRevocations(path);
  set.add(tokenId);
  const out = { revoked_token_ids: [...set] };
  fs.writeFileSync(path, JSON.stringify(out, null, 2), "utf-8");
  return out;
}

/**
 * Verify a visa token.
 *
 * Returned object shape:
 * {
 *   ok: boolean,
 *   reason: string,
 *   tokenId?: string,
 *   expMs?: number
 * }
 *
 * Verification steps:
 *   1) token exists
 *   2) token format is correct
 *   3) fields are parseable
 *   4) token not expired
 *   5) token not revoked
 *   6) HMAC signature matches
 *
 * @param {string|null|undefined} visaToken
 * @param {string|Buffer} secret
 * @param {Set<string>} revokedSet
 * @returns {{ok: boolean, reason: string, tokenId?: string|null, expMs?: number}}
 */
export function verifyVisaToken(visaToken, secret, revokedSet) {
  if (!visaToken || typeof visaToken !== "string") {
    return { ok: false, reason: "missing_token" };
  }

  const parts = visaToken.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    return { ok: false, reason: "bad_format" };
  }

  const tokenId = parts[1];
  const expMs = Number(parts[2]);
  const sig = parts[3];

  if (!tokenId || !Number.isFinite(expMs) || !sig) {
    return { ok: false, reason: "bad_fields" };
  }

  const now = Date.now();
  if (now > expMs) {
    return { ok: false, reason: "expired", tokenId, expMs };
  }

  if (revokedSet && revokedSet.has(tokenId)) {
    return { ok: false, reason: "revoked", tokenId, expMs };
  }

  // The message that was originally signed by the issuer.
  const msg = `${tokenId}.${expMs}`;
  const mac = crypto.createHmac("sha256", secret).update(msg).digest();
  const expected = b64url(mac);

  // Constant-time comparison helps avoid timing leaks.
  // This is still only an MVP, but using timingSafeEqual is a good habit.
  const a = b64urlToBuf(sig);
  const b = b64urlToBuf(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_sig", tokenId, expMs };
  }

  return { ok: true, reason: "ok", tokenId, expMs };
}

/**
 * Issue a short-lived visa token.
 *
 * @param {string|Buffer} secret
 * @param {number} ttlMs
 * @returns {string}
 */
export function issueVisaToken(secret, ttlMs = 5 * 60 * 1000) {
  const tokenId = crypto.randomUUID();
  const expMs = Date.now() + ttlMs;
  const msg = `${tokenId}.${expMs}`;
  const mac = crypto.createHmac("sha256", secret).update(msg).digest();
  const sig = b64url(mac);
  return `v1.${tokenId}.${expMs}.${sig}`;
}
