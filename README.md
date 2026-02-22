# VFA-Lab — Virtual Flow Agreement Demo

> A minimal policy-driven trust gateway demo with cryptographic visa tokens.

![Docker](https://img.shields.io/badge/docker-ready-blue)
![Compose](https://img.shields.io/badge/compose-v2-blue)
![Status](https://img.shields.io/badge/status-prototype-orange)
![License](https://img.shields.io/badge/license-Apache--2.0-green)

Minimal, end-to-end demonstration of a **policy-driven trust gateway** that routes traffic based on a signed visa token.

This lab shows how an application-layer decision engine can dynamically route requests between **sandbox** and **production** backends using cryptographic proof.

---

## What this demo demonstrates

* Policy-driven routing at the gateway
* Signed visa token verification
* Automatic downgrade to sandbox
* Token revocation
* Zero-trust style access control
* Developer-friendly observability

---

## Architecture

```
Client → Gateway (VFA decision) → Merchant (PROD)
                               ↘ Sandbox (LIMITED)
```

### Components

| Service  | Role                            |
| -------- | ------------------------------- |
| gateway  | Decision engine + reverse proxy |
| merchant | Production backend              |
| sandbox  | Limited backend                 |
| client   | Demo UI                         |

---

## Requirements

- Docker Engine 24+
- Docker Compose V2
- curl (optional)
- jq (optional, for pretty output)

## Quick start

### 1. Build and start

```bash
docker compose up -d --build
```

### 2. Open the demo client

If using the simple static server:

```bash
cd client
python3 -m http.server 9898
```

Open:

```
http://localhost:9898
```

---

## Services and ports

| Service           | URL                   |
| ----------------- | --------------------- |
| Gateway           | http://localhost:8080 |
| Merchant (direct) | http://localhost:5000 |
| Sandbox (direct)  | http://localhost:5001 |
| Client (static)   | http://localhost:9898 |

---

## Basic flow

### Without token

```
GET /api/hello
→ routed to SANDBOX
```

### With valid token

```
POST /issue → visaToken
GET /api/hello (Authorization: Bearer …)
→ routed to PROD
```

---

## Token lifecycle

### Issue token

```bash
curl -X POST http://localhost:8080/issue \
  -H "Content-Type: application/json" \
  -d '{"ttl_ms":60000}'
```

### Use token

```bash
curl http://localhost:8080/api/hello \
  -H "Authorization: Bearer <visaToken>"
```

### Revoke token

```bash
curl -X POST http://localhost:8080/revoke \
  -H "Content-Type: application/json" \
  -d '{"visaToken":"<visaToken>"}'
```

---

## Policy configuration

Gateway behavior is controlled via environment variables.

### DEFAULT_ROUTE

Controls behavior when no token is present.

| Value   | Behavior                 |
| ------- | ------------------------ |
| sandbox | default → limited access |
| prod    | allow full access        |
| deny    | block request            |

Example in `docker-compose.yml`:

```yaml
DEFAULT_ROUTE=sandbox
```

---

## Decision logic

The gateway evaluates:

1. Token present?
2. Signature valid?
3. Token revoked?
4. Token expired?

Then routes:

```
valid token → PROD
invalid/missing → SANDBOX (or DENY by policy)
```

---

## Observability

Gateway logs include:

* timestamp
* path
* decision
* reason
* token id

Example:

```json
{
  "decision": "sandbox",
  "reason": "missing_token"
}
```

---

## Useful test commands

### Sandbox (no token)

```bash
curl http://localhost:8080/api/hello
```

### With token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/issue \
  -H "Content-Type: application/json" \
  -d '{"ttl_ms":60000}' | jq -r .visaToken)

curl http://localhost:8080/api/hello \
  -H "Authorization: Bearer $TOKEN"
```

---

## Demo limitations (by design)

This is an MVP lab environment.

Not included (yet):

* audience binding
* device binding
* nonce / replay protection
* distributed revocation
* key rotation

---

## Possible next steps

* scope-based routing
* risk scoring
* ECDSA tokens
* mTLS upstream
* distributed revocation list
* hardware-backed keys

---

## License

Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright 2026 Sandor Csicsai

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---

## About

VFA (Virtual Flow Agreement) explores a **policy-driven trust layer** that can operate between clients and services without modifying the application protocol itself.

---

## Security note

This repository is a demonstration environment.

Do NOT use the shared HMAC secret in production.

Production deployments MUST implement:

- secure key storage
- key rotation
- audience binding
- replay protection
- proper authentication hardening

---

**FlowAccord concept demo**

##  Demo

![VFA Demo](docs/images/demo.png)