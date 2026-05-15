// RWOTD Push Notification Worker
// Secrets required (set via: npx wrangler secret put <NAME>):
//   VAPID_PUBLIC_KEY   - base64url uncompressed EC public key
//   VAPID_PRIVATE_KEY  - base64url EC private key scalar
//   VAPID_SUBJECT      - e.g. mailto:you@example.com
//   ALLOWED_ORIGIN     - your GitHub Pages URL, e.g. https://youruser.github.io

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ---- Base64url helpers ----

function b64urlToBytes(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function bytesToB64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function strToB64url(str) {
    return bytesToB64url(new TextEncoder().encode(str));
}

// ---- VAPID JWT (ES256) ----

async function importVapidSigningKey(privateKeyB64url, publicKeyB64url) {
    // Public key: 04 || x(32 bytes) || y(32 bytes) in base64url
    const pub = b64urlToBytes(publicKeyB64url);
    const priv = b64urlToBytes(privateKeyB64url);
    const jwk = {
        kty: "EC",
        crv: "P-256",
        d: bytesToB64url(priv),
        x: bytesToB64url(pub.slice(1, 33)),
        y: bytesToB64url(pub.slice(33, 65)),
    };
    return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );
}

async function makeVapidHeaders(endpoint, env) {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const now = Math.floor(Date.now() / 1000);

    const header = strToB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
    const payload = strToB64url(
        JSON.stringify({ aud: audience, exp: now + 43200, sub: env.VAPID_SUBJECT })
    );
    const signingInput = `${header}.${payload}`;

    const key = await importVapidSigningKey(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
    const sig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(signingInput)
    );

    const jwt = `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
    return {
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        TTL: "86400",
    };
}

// ---- Send push (no payload — SW picks the message) ----

async function sendPush(subscription, env) {
    const headers = await makeVapidHeaders(subscription.endpoint, env);
    const resp = await fetch(subscription.endpoint, {
        method: "POST",
        headers: { ...headers, "Content-Length": "0" },
    });
    return resp.status;
}

// ---- Cron handler ----

async function handleScheduled(env) {
    const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const list = await env.SUBS.list({ prefix: "sub:" });
    for (const key of list.keys) {
        const deviceId = key.name.slice(4); // strip "sub:"

        // Skip if word already revealed today
        const lastRevealed = await env.SUBS.get(`rev:${deviceId}`);
        if (lastRevealed === todayUTC) {
            console.log(`Skipping ${deviceId} — already revealed today`);
            continue;
        }

        const raw = await env.SUBS.get(key.name);
        if (!raw) continue;
        let subscription;
        try {
            subscription = JSON.parse(raw);
        } catch {
            continue;
        }
        try {
            const status = await sendPush(subscription, env);
            // 404 / 410 means the subscription is no longer valid
            if (status === 404 || status === 410) {
                await env.SUBS.delete(key.name);
                console.log(`Removed expired subscription: ${key.name} (${status})`);
            } else {
                console.log(`Push sent to ${key.name}: ${status}`);
            }
        } catch (e) {
            console.error(`Push failed for ${key.name}:`, e.message);
        }
    }
}

// ---- Request handler ----

async function handleRequest(request, env) {
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // GET /vapid-public-key — no auth required
    if (request.method === "GET" && url.pathname === "/vapid-public-key") {
        return new Response(
            JSON.stringify({ publicKey: env.VAPID_PUBLIC_KEY }),
            { headers: { ...CORS, "Content-Type": "application/json" } }
        );
    }

    // Only accept write requests from the configured app origin.
    // The browser sets Origin automatically; JS cannot override it on cross-origin requests.
    const origin = request.headers.get("Origin") || "";
    if (origin !== env.ALLOWED_ORIGIN) {
        return new Response("Forbidden", { status: 403, headers: CORS });
    }

    // POST /subscribe
    if (request.method === "POST" && url.pathname === "/subscribe") {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response("Bad request", { status: 400, headers: CORS });
        }
        const { deviceId, subscription } = body;
        if (!deviceId || !subscription || !subscription.endpoint) {
            return new Response("Bad request", { status: 400, headers: CORS });
        }
        await env.SUBS.put(`sub:${deviceId}`, JSON.stringify(subscription));
        return new Response("OK", { headers: CORS });
    }

    // POST /revealed — mark that this device has revealed today's word
    if (request.method === "POST" && url.pathname === "/revealed") {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response("Bad request", { status: 400, headers: CORS });
        }
        const { deviceId } = body;
        if (!deviceId) {
            return new Response("Bad request", { status: 400, headers: CORS });
        }
        const todayUTC = new Date().toISOString().slice(0, 10);
        // TTL 48 h so entries expire automatically
        await env.SUBS.put(`rev:${deviceId}`, todayUTC, { expirationTtl: 172800 });
        return new Response("OK", { headers: CORS });
    }

    // POST /unsubscribe
    if (request.method === "POST" && url.pathname === "/unsubscribe") {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response("Bad request", { status: 400, headers: CORS });
        }
        const { deviceId } = body;
        if (!deviceId) {
            return new Response("Bad request", { status: 400, headers: CORS });
        }
        await env.SUBS.delete(`sub:${deviceId}`);
        return new Response("OK", { headers: CORS });
    }

    return new Response("Not found", { status: 404, headers: CORS });
}

export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    },
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(handleScheduled(env));
    },
};
