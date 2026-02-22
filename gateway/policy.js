// v1.<token_id>.<exp_ms>.<sig_b64url>
// sig = HMAC_SHA256( token_id + "." + exp_ms , HMAC_SECRET )

import crypto from "crypto";
import fs from "fs";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlToBuf(s) {
  // pad
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function loadRevocations(path) {
  try {
    const raw = fs.readFileSync(path, "utf-8");
    const obj = JSON.parse(raw);
    return new Set(obj.revoked_token_ids || []);
  } catch {
    return new Set();
  }
}

export function revokeTokenId(path, tokenId) {
  const set = loadRevocations(path);
  set.add(tokenId);
  const out = { revoked_token_ids: [...set] };
  fs.writeFileSync(path, JSON.stringify(out, null, 2), "utf-8");
  return out;
}

export function verifyVisaToken(visaToken, secret, revokedSet) {
  // returns { ok, reason, tokenId, expMs }
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

  const msg = `${tokenId}.${expMs}`;
  const mac = crypto.createHmac("sha256", secret).update(msg).digest();
  const expected = b64url(mac);

  // constant-time compare
  const a = b64urlToBuf(sig);
  const b = b64urlToBuf(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_sig", tokenId, expMs };
  }

  return { ok: true, reason: "ok", tokenId, expMs };
}

export function issueVisaToken(secret, ttlMs = 5 * 60 * 1000) {
  const tokenId = crypto.randomUUID();
  const expMs = Date.now() + ttlMs;
  const msg = `${tokenId}.${expMs}`;
  const mac = crypto.createHmac("sha256", secret).update(msg).digest();
  const sig = b64url(mac);
  return `v1.${tokenId}.${expMs}.${sig}`;
}