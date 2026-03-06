"""
sand_app.py
-----------

Minimal Flask backend representing the SANDBOX environment in VFA-Lab.

Role in the demo
================
This service is the safer / limited upstream that the gateway can route to when:
- the token is missing
- the token is invalid
- policy defaults prefer sandbox access

Its purpose is to show graceful degradation:
instead of giving full business access, the system can return a restricted,
lower-risk response.

The file name is temporarily renamed for differentiation, as noted by the user.
It can later be restored to its original preferred name.
"""

import os
from flask import Flask, request, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "5001"))


@app.get("/api/hello")
def hello():
    """
    Lightweight diagnostic endpoint for sandbox routing.

    Returns:
        JSON showing:
        - that the request landed in SANDBOX
        - a hint about valid token usage
        - VFA routing metadata forwarded by the gateway
    """
    return jsonify({
        "env": "SANDBOX",
        "message": "Limited access: sandbox response",
        "hint": "Provide a valid visaToken to reach PROD",
        "x_vfa_decision": request.headers.get("x-vfa-decision"),
        "x_vfa_reason": request.headers.get("x-vfa-reason"),
    })


@app.get("/api/data")
def data():
    """
    Example limited data endpoint.

    Compared to the PROD version this response intentionally exposes less value.
    This helps demonstrate policy-based downgrade:
    invalid or absent trust evidence still gets a controlled response instead
    of a hard crash or unintended full access.
    """
    return jsonify({
        "env": "SANDBOX",
        "data": {
            "customer_level": "guest",
            "discount": 0,
            "features": ["A"]
        },
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
