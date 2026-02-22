import os
from flask import Flask, request, jsonify

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "5001"))

@app.get("/api/hello")
def hello():
    return jsonify({
        "env": "SANDBOX",
        "message": "Limited access: sandbox response",
        "hint": "Provide a valid visaToken to reach PROD",
        "x_vfa_decision": request.headers.get("x-vfa-decision"),
        "x_vfa_reason": request.headers.get("x-vfa-reason"),
    })

@app.get("/api/data")
def data():
    return jsonify({
        "env": "SANDBOX",
        "data": {"customer_level": "guest", "discount": 0, "features": ["A"]},
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)