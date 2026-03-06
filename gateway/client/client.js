// gateway/client.js

function getBase() {
    return document.getElementById("baseUrl").value.trim();
}

function getToken() {
    return document.getElementById("token").value.trim();
}

function setOutput(obj) {
    document.getElementById("output").textContent =
        JSON.stringify(obj, null, 2);
}

async function apiFetch(path, options = {}) {
    const base = getBase();
    const token = getToken();

    options.headers = options.headers || {};
    if (token) {
        options.headers["Authorization"] = "Bearer " + token;
    }

    const res = await fetch(base + path, options);
    const text = await res.text();

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text, status: res.status };
    }
}

async function issueToken() {
    const base = getBase();
    const res = await fetch(base + "/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl_ms: 300000 })
    });

    const data = await res.json();
    if (data.visaToken) {
        document.getElementById("token").value = data.visaToken;
    }
    setOutput(data);
}

async function revokeToken() {
    const base = getBase();
    const token = getToken();

    if (!token) {
        alert("Nincs token!");
        return;
    }

    const res = await fetch(base + "/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visaToken: token })
    });

    const data = await res.json();
    setOutput(data);
}

async function callHello() {
    const data = await apiFetch("/api/hello");
    setOutput(data);
}

async function callData() {
    const data = await apiFetch("/api/data");
    setOutput(data);
}