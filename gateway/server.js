import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  issueVisaToken,
  loadRevocations,
  revokeTokenId,
  verifyVisaToken
} from "./policy.js";

const app = express();
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ha a gateway mappán belül van a client mappa, pl. gateway/client/index.html
app.use("/", express.static(path.join(__dirname, "client")));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // vagy: "http://localhost:9898"
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = Number(process.env.PORT || 8080);
const HMAC_SECRET = (process.env.HMAC_SECRET || "CHANGE_ME_DEV_SECRET");
const REVOCATIONS_PATH = process.env.REVOCATIONS_PATH || "/app/revocations.json";

const UPSTREAM_PROD = process.env.UPSTREAM_PROD || "http://merchant:5000";
const UPSTREAM_SANDBOX = process.env.UPSTREAM_SANDBOX || "http://sandbox:5001";
const DEFAULT_ROUTE = (process.env.DEFAULT_ROUTE || "sandbox"); // sandbox|deny|prod

function getTokenFromReq(req) {
  // Prefer header: Authorization: Bearer <token>
  const auth = req.headers["authorization"];
  if (auth && typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  // Fallback query: ?visa=...
  if (req.query?.visa && typeof req.query.visa === "string") return req.query.visa;
  return null;
}

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/issue", (req, res) => {
  const ttlMs = Number(req.body?.ttl_ms ?? 5 * 60 * 1000);
  const token = issueVisaToken(HMAC_SECRET, ttlMs);
  res.json({ visaToken: token, ttl_ms: ttlMs });
});

app.post("/revoke", (req, res) => {
  const visaToken = req.body?.visaToken;
  const tokenId = req.body?.tokenId;

  let id = tokenId;
  if (!id && typeof visaToken === "string") {
    const parts = visaToken.split(".");
    if (parts.length >= 2) id = parts[1];
  }
  if (!id) return res.status(400).json({ ok: false, error: "Provide tokenId or visaToken" });

  const out = revokeTokenId(REVOCATIONS_PATH, id);
  res.json({ ok: true, revoked: id, store: out });
});

// Decision middleware for /api/*
app.use("/api", (req, res, next) => {
  const visaToken = getTokenFromReq(req);
  const revokedSet = loadRevocations(REVOCATIONS_PATH);
  const v = verifyVisaToken(visaToken, HMAC_SECRET, revokedSet);

  // decision
  let decision = "sandbox";
  if (v.ok) decision = "prod";
  else if (!visaToken && DEFAULT_ROUTE === "prod") decision = "prod";
  else if (!visaToken && DEFAULT_ROUTE === "deny") decision = "deny";
  else if (!visaToken && DEFAULT_ROUTE === "sandbox") decision = "sandbox";

  // log - demo friendly
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    decision,
    reason: v.reason,
    tokenId: v.tokenId || null
  }));

  if (decision === "deny") {
    return res.status(403).json({ ok: false, error: "Denied by policy", reason: v.reason });
  }

  // attach policy headers downstream (optional, nice for demo)
  req.headers["x-vfa-decision"] = decision;
  req.headers["x-vfa-reason"] = v.reason;
  if (v.tokenId) req.headers["x-vfa-token-id"] = v.tokenId;

  // stash for router
  req._vfaDecision = decision;
  next();
});

// Two proxies (keep /api prefix)
const proxyProd = createProxyMiddleware({
  target: UPSTREAM_PROD,
  changeOrigin: true,
  logLevel: "silent",
  pathRewrite: (path, req) => "/api" + path, // path itt már "/hello"
});

const proxySandbox = createProxyMiddleware({
  target: UPSTREAM_SANDBOX,
  changeOrigin: true,
  logLevel: "silent",
  pathRewrite: (path, req) => "/api" + path,
});

app.use("/api", (req, res, next) => {
  const d = req._vfaDecision || "sandbox";
  if (d === "prod") return proxyProd(req, res, next);
  return proxySandbox(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Policy Gateway listening on :${PORT}`);
  console.log(`Upstreams: prod=${UPSTREAM_PROD}, sandbox=${UPSTREAM_SANDBOX}`);
});