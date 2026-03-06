"""
merchant/app.py
------------

Minimal Flask backend representing the PROD merchant environment in VFA-Lab.

Role in the demo
================
This service simulates the "real" upstream backend that should only be reached
when the gateway accepts a valid visa token.

Typical flow:
    client -> gateway -> policy verification -> PROD merchant backend

Why keep it simple?
===================
The point of this file is not business complexity, but visibility:
- easy to read
- easy to test
- easy to compare with the sandbox app

The file name is temporarily renamed for differentiation, as noted by the user.
It can later be restored to its original preferred name.
"""

import os
from flask import Flask, request, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "5000"))


@app.get("/api/hello")
def hello():
    """
    Lightweight diagnostic endpoint.

    Returns:
        JSON showing:
        - that we reached the PROD environment
        - a human-readable message
        - VFA headers forwarded by the gateway

    Useful for:
        - confirming routing decisions
        - checking whether a valid token reached PROD
        - demo screenshots / terminal validation
    """
    return jsonify({
        "env": "PROD_MERCHANT",
        "message": "Full access: merchant backend response",
        "x_vfa_decision": request.headers.get("x-vfa-decision"),
        "x_vfa_reason": request.headers.get("x-vfa-reason"),
        "x_vfa_token_id": request.headers.get("x-vfa-token-id"),
    })


@app.get("/api/data")
def data():
    """
    Example protected data endpoint.

    In the lab this represents richer business data than the sandbox version.
    The exact payload is intentionally small, but it demonstrates the core
    concept: successful policy verification unlocks a higher-trust response.
    """
    return jsonify({
        "env": "PROD_MERCHANT",
        "data": {
            "customer_level": "gold",
            "discount": 15,
            "features": ["A", "B", "C"]
        },
    })


if __name__ == "__main__":
    # Debug mode is intentionally not forced here.
    # The container or launcher can decide how to run the app.
    app.run(host="0.0.0.0", port=PORT)
