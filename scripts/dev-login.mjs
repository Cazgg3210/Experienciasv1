#!/usr/bin/env node
/**
 * Obtiene una cookie de sesión (Auth.js credentials) para pruebas con curl.
 * Uso:
 *   node scripts/dev-login.mjs http://localhost:3000 ivonne@ivonne-rosa.test Demo2026! > .cookie-owner
 *   curl -s -H "Cookie: $(cat .cookie-owner)" http://localhost:3000/admin/leads
 */
const [, , base = "http://localhost:3000", email = "ivonne@ivonne-rosa.test", password = "Demo2026!"] = process.argv;

function collect(res, jar) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
const header = (jar) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

const jar = new Map();
const csrfRes = await fetch(`${base}/api/auth/csrf`);
collect(csrfRes, jar);
const { csrfToken } = await csrfRes.json();

const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/admin` });
const res = await fetch(`${base}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: header(jar) },
  body,
  redirect: "manual",
});
collect(res, jar);
const session = [...jar.keys()].find((k) => k.includes("session-token"));
if (!session) {
  console.error(`Login fallido para ${email} (status ${res.status}, location ${res.headers.get("location")})`);
  process.exit(1);
}
process.stdout.write(header(jar));
