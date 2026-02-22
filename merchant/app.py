import os
from flask import Flask, request, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "5000"))

@app.get("/api/hello")
def hello():
    return jsonify({
        "env": "PROD_MERCHANT",
        "message": "Full access: merchant backend response",
        "x_vfa_decision": request.headers.get("x-vfa-decision"),
        "x_vfa_reason": request.headers.get("x-vfa-reason"),
        "x_vfa_token_id": request.headers.get("x-vfa-token-id"),
    })

@app.get("/api/data")
def data():
    return jsonify({
        "env": "PROD_MERCHANT",
        "data": {"customer_level": "gold", "discount": 15, "features": ["A", "B", "C"]},
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)