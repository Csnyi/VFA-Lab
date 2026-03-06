// server.js
//
// VFA-Lab policy gateway
// ----------------------
// Purpose:
//   - serve the demo client
//   - issue / revoke demo visa tokens
//   - verify incoming tokens
//   - route requests to PROD or SANDBOX
//
// High-level flow:
//   Client -> Gateway (/api/*) -> decision middleware -> proxy ->
//            PROD backend or SANDBOX backend
//
// Decision rules (MVP):
//   - valid token    -> PROD
//   - invalid token  -> SANDBOX (or DENY, depending on DEFAULT_ROUTE policy)
//   - missing token  -> DEFAULT_ROUTE decides (sandbox | prod | deny)
//
// Important:
// This is intentionally a demo-friendly gateway, optimized for clarity rather
// than production hardening.

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  issueVisaToken,
  loadRevocations,
  revokeTokenId,
  verifyVisaToken
} from "./policy.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// __dirname equivalent for ES modules.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Static client hosting.
 *
 * Expected structure example:
 *   gateway/
 *     server.js
 *     policy.js
 *     client/
 *       index.html
 *       app.js
 */
app.use("/", express.static(path.join(__dirname, "client")));

// JSON body parsing for /issue and /revoke endpoints.
app.use(express.json());

/**
 * Minimal CORS setup for demo convenience.
 *
 * In a real deployment:
 * - replace "*" with explicit origins
 * - narrow methods and headers
 * - consider credentials rules carefully
 */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Environment configuration.
const PORT = Number(process.env.PORT || 8080);
const HMAC_SECRET = process.env.HMAC_SECRET || "CHANGE_ME_DEV_SECRET";
const REVOCATIONS_PATH = process.env.REVOCATIONS_PATH || "/app/revocations.json";

const UPSTREAM_PROD = process.env.UPSTREAM_PROD || "http://merchant:5000";
const UPSTREAM_SANDBOX = process.env.UPSTREAM_SANDBOX || "http://sandbox:5001";

// Controls behavior when no token is supplied:
//   sandbox -> route to sandbox
//   deny    -> return 403
//   prod    -> allow prod even without token (only for special demo cases)
const DEFAULT_ROUTE = process.env.DEFAULT_ROUTE || "sandbox";

/**
 * Extract a visa token from the incoming request.
 *
 * Preferred format:
 *   Authorization: Bearer <token>
 *
 * Fallback for quick manual testing:
 *   /api/hello?visa=<token>
 *
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function getTokenFromReq(req) {
  const auth = req.headers["authorization"];
  if (auth && typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  if (req.query?.visa && typeof req.query.visa === "string") {
    return req.query.visa;
  }

  return null;
}

/**
 * Simple health endpoint for container checks and quick diagnostics.
 */
app.get("/healthz", (_req, res) => res.json({ ok: true }));

/**
 * Issue a demo visa token.
 *
 * POST /issue
 * body: { ttl_ms?: number }
 *
 * Example:
 *   curl -X POST http://localhost:8080/issue \
 *     -H "Content-Type: application/json" \
 *     -d '{"ttl_ms": 300000}'
 */
app.post("/issue", (req, res) => {
  const ttlMs = Number(req.body?.ttl_ms ?? 5 * 60 * 1000);
  const token = issueVisaToken(HMAC_SECRET, ttlMs);
  res.json({ visaToken: token, ttl_ms: ttlMs });
});

/**
 * Revoke a token by tokenId or by full token string.
 *
 * POST /revoke
 * body: { tokenId?: string, visaToken?: string }
 */
app.post("/revoke", (req, res) => {
  const visaToken = req.body?.visaToken;
  const tokenId = req.body?.tokenId;

  let id = tokenId;
  if (!id && typeof visaToken === "string") {
    const parts = visaToken.split(".");
    if (parts.length >= 2) id = parts[1];
  }

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "Provide tokenId or visaToken"
    });
  }

  const out = revokeTokenId(REVOCATIONS_PATH, id);
  res.json({ ok: true, revoked: id, store: out });
});

/**
 * Policy decision middleware for all protected API routes.
 *
 * This is the heart of the lab:
 *   - read token
 *   - verify token
 *   - compute policy decision
 *   - annotate request with VFA metadata
 *   - continue to the matching proxy
 */
app.use("/api", (req, res, next) => {
  const visaToken = getTokenFromReq(req);
  const revokedSet = loadRevocations(REVOCATIONS_PATH);
  const v = verifyVisaToken(visaToken, HMAC_SECRET, revokedSet);

  let decision = "sandbox";

  if (v.ok) {
    decision = "prod";
  } else if (!visaToken && DEFAULT_ROUTE === "prod") {
    decision = "prod";
  } else if (!visaToken && DEFAULT_ROUTE === "deny") {
    decision = "deny";
  } else if (!visaToken && DEFAULT_ROUTE === "sandbox") {
    decision = "sandbox";
  }

  // Demo-friendly structured log.
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    decision,
    reason: v.reason,
    tokenId: v.tokenId || null
  }));

  if (decision === "deny") {
    return res.status(403).json({
      ok: false,
      error: "Denied by policy",
      reason: v.reason
    });
  }

  // Forward policy metadata downstream so backends can expose it in their
  // responses or logs. This is useful for demos and debugging.
  req.headers["x-vfa-decision"] = decision;
  req.headers["x-vfa-reason"] = v.reason;
  if (v.tokenId) req.headers["x-vfa-token-id"] = v.tokenId;

  // Custom request property used by the next router stage.
  req._vfaDecision = decision;
  next();
});

/**
 * PROD proxy.
 *
 * Note:
 * When mounted at /api, the incoming path received here is already stripped
 * from that prefix by Express. Therefore we re-add "/api" before forwarding.
 */
const proxyProd = createProxyMiddleware({
  target: UPSTREAM_PROD,
  changeOrigin: true,
  logLevel: "silent",
  pathRewrite: (path, req) => "/api" + path,
});

/**
 * SANDBOX proxy.
 */
const proxySandbox = createProxyMiddleware({
  target: UPSTREAM_SANDBOX,
  changeOrigin: true,
  logLevel: "silent",
  pathRewrite: (path, req) => "/api" + path,
});

/**
 * Final router that selects the matching proxy after the policy decision was
 * attached by the middleware above.
 */
app.use("/api", (req, res, next) => {
  const d = req._vfaDecision || "sandbox";
  if (d === "prod") return proxyProd(req, res, next);
  return proxySandbox(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Policy Gateway listening on :${PORT}`);
  console.log(`Upstreams: prod=${UPSTREAM_PROD}, sandbox=${UPSTREAM_SANDBOX}`);
});
