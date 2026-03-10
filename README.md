# VFA-Lab — Virtual Flow Agreement Demo

> A policy-driven trust gateway that routes requests using cryptographic visa tokens.

## Related repositories

Implementation and demonstration projects:

- **VFA-MVP** – wallet / merchant reference implementation → https://github.com/Csnyi/VFA-MVP
- **VFA-Lab** — architecture sandbox and gateway routing demo
- **VFA-cloud-PoC** — cloud operation PoC (deployment scenario) → https://github.com/Csnyi/VFA-cloud-PoC
- **VFA-Spec** - protocol specification → https://github.com/Csnyi/VFA-Spec

![Docker](https://img.shields.io/badge/docker-ready-blue)
![Compose](https://img.shields.io/badge/compose-v2-blue)
![Status](https://img.shields.io/badge/status-prototype-orange)
![License](https://img.shields.io/badge/license-Apache--2.0-green)

⚠ Experimental research prototype  
⚠ Not production ready

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

```mermaid
flowchart TB

  subgraph Client
    U["User"]
    W["Identity Wallet"]
  end

  subgraph Gateway
    G["VFA Gateway"]
    P["Policy Engine"]
  end

  subgraph Services
    PROD["Production Service"]
    SB["Sandbox Service"]
  end

  U -->|"intent"| W
  W -->|"VFA visa token"| G
  U -->|"HTTPS request + token"| G

  G --> P

  P -->|"valid"| PROD
  P -->|"invalid / missing"| SB

  PROD -->|"response"| U
  SB -->|"limited response"| U
```

### TLS Handshake with VFA Extension (Concept)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant W as Identity Wallet
    participant G as VFA Gateway
    participant S as Backend Service

    Note over C,W: Intent preparation
    C->>W: Request visa token (scope, ttl)
    W-->>C: Signed VFA visa token

    Note over C,G: TLS handshake with VFA extension
    C->>G: ClientHello + vfa_token
    G->>G: Verify token signature & policy

    alt Valid token
        G-->>C: ServerHello + VFA accepted
        Note over C,G: Secure session established
        C->>G: HTTPS request
        G->>S: Route to production backend
        S-->>C: Response
    else Invalid or missing token
        G-->>C: ServerHello (sandbox policy)
        C->>G: HTTPS request
        G->>S: Route to sandbox backend
        S-->>C: Limited response
    end
```

VFA introduces an optional handshake extension where a **cryptographically signed visa token** can be presented during connection establishment.

The gateway evaluates the token and decides whether the request should be routed to **production services** or **sandbox environments**.

This approach enables **policy-driven trust decisions before application logic is executed.**

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

The demo client is served by the gateway.

Once the gateway is running, open:

```
http://localhost:8080
```

The client files are located in:

```
gateway/client/
```

The gateway exposes them via:

```javascript
app.use("/", express.static(path.join(__dirname, "client")));
```

### Expected result

After starting the stack you should be able to:

1. Open the demo UI  
   http://localhost:8080

2. Issue a visa token

3. Call the API with and without the token and observe routing decisions.

## Services and ports

| Service           | URL                   |
| ----------------- | --------------------- |
| Gateway + Client  | http://localhost:8080 |
| Merchant (direct) | http://localhost:5000 |
| Sandbox (direct)  | http://localhost:5001 |

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

This repository is a **demonstration environment**.

The implementation included here is intended only to illustrate the **VFA policy decision concept** and **must not be used in production systems**.

### Demo secret

The project uses a **shared HMAC secret** for demonstration purposes.

This mechanism is intentionally simplified and does **not** represent a production-grade security design.

### Production requirements

Any real deployment MUST implement:

* secure key storage
* key rotation
* audience binding
* replay protection
* proper authentication hardening

For further details and recommended production practices see
[SECURITY.md](docs/SECURITY.md)

---

**FlowAccord concept demo**

## Demo

request token
![VFA Demo Token](docs/images/demo_token.png)
api/hello
![VFA Demo Hello](docs/images/demo_hello.png)
api/data
![VFA Demo Data](docs/images/demo_data.png)
revocation
![VFA Demo Revoked](docs/images/demo_revoke.png)

## System-level architecture (VFA-MVP + vfa-lab together)

```mermaid
flowchart LR
  %% Actors
  U["User / Client<br/>Browser / App / CLI"] -->|HTTPS request| G

  %% Policy plane
  subgraph P["VFA Policy Plane (L3.5 overlay)"]
    G["Policy Gateway<br/>Decision: prod / sandbox / deny"]
    R[("Revocation Store<br/>JSON/SQLite")]
    G <-->|read/update| R
  end

  %% Upstreams
  G -->|prod route| M["Merchant API (PROD)<br/>Business endpoints"]
  G -->|sandbox route| S["Sandbox API<br/>Limited / safe responses"]

  %% Identity plane
  subgraph I["VFA Identity Plane (MVP)"]
    W["Wallet UI / Wallet Service<br/>issue & manage visaToken"]
    V["Token Verify Logic<br/>(HMAC now, ECDSA later)"]
    W -->|issue token| U
    G -->|verify token| V
  end

  %% Notes
  U -. optional token .-> G
```

## Request-level process (what happens with a request)

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant G as Policy Gateway (L3.5)
  participant R as Revocation Store
  participant M as Merchant (PROD)
  participant S as Sandbox

  C->>G: HTTP(S) request /api/* (optional: Bearer visaToken)
  G->>R: Load revocations (tokenId)
  alt Token valid & not revoked
    G->>M: Proxy request (decision=prod)
    M-->>G: Response (full)
    G-->>C: Response
  else Missing/invalid/revoked token
    alt DEFAULT_ROUTE = deny
      G-->>C: 403 Denied by policy
    else DEFAULT_ROUTE = sandbox
      G->>S: Proxy request (decision=sandbox)
      S-->>G: Response (limited)
      G-->>C: Response
    end
  end
```

## Layer diagram (where L3.5 sits)

```mermaid
flowchart TB
  Title["Kommunikációs stack (mentális modell)"]

  subgraph Stack
    direction TB
    L2["L2: Link (Ethernet/Wi-Fi)"]
    L3["L3: IP routing"]
    L35["L3.5: VFA Policy Overlay<br/>(decision plane, optional)"]
    L4["L4: TCP"]
    L5["L5: TLS"]
    L7["L7: Application (HTTP/API)"]
  end

  Title --> L2
  L2 --> L3 --> L4 --> L5 --> L7
  L35 -. influences .-> L5
  L35 -. routes .-> L7
```
