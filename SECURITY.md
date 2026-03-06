# Security Policy

## Supported Versions
This is an experimental prototype/research project. No production support is provided.

## Reporting a Vulnerability
Please **do not** open public issues for sensitive vulnerabilities.

Instead, contact the maintainer via a private channel (e-mail or GitHub Security Advisories).
When reporting, include:
- a short description of the issue
- steps to reproduce
- affected files/versions
- impact assessment (what an attacker gains)

## Secrets
Never commit secrets (HMAC keys, private keys, tokens, API keys). Use environment variables or `.env` files and keep them out of Git.
