/** Talking to the throwaway n8n the tests run on: sign-in, API calls, credentials. */
import fs from "node:fs";
import path from "node:path";
import { root } from "./load.mjs";
import { PLATFORMS } from "../lib/platforms.mjs";

export const N8N = process.env.N8N_URL ?? "http://localhost:5679";
export const MOCKS = process.env.MOCKS_URL ?? "http://localhost:4010";
// The owner of an instance that exists only for these tests. Not a secret.
const OWNER = { email: "test@example.com", firstName: "Test", lastName: "Runner", password: "Testrunner123" };
const keyFile = path.join(root, ".n8n-test-key");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** n8n answers its health check before its API is up; wait for the API itself. */
async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${N8N}/rest/settings`);
      if (res.ok && /json/.test(res.headers.get("content-type") ?? "")) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`n8n at ${N8N} did not become ready in two minutes`);
}

/** Platforms whose n8n node is published by the platform itself and installed as a package. */
const PACKAGES = ["@apify/n8n-nodes-apify"];

async function signIn() {
  const json = { "content-type": "application/json" };
  let res = await fetch(`${N8N}/rest/login`, { method: "POST", headers: json, body: JSON.stringify({ emailOrLdapLoginId: OWNER.email, password: OWNER.password }) });
  if (!res.ok) res = await fetch(`${N8N}/rest/owner/setup`, { method: "POST", headers: json, body: JSON.stringify(OWNER) });
  if (!res.ok) throw new Error(`cannot sign in to the test n8n: ${res.status} ${await res.text()}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function ensurePackages(cookie) {
  const have = ((await (await fetch(`${N8N}/rest/community-packages`, { headers: { cookie } })).json()).data ?? []).map((p) => p.packageName);
  for (const name of PACKAGES.filter((p) => !have.includes(p))) {
    const res = await fetch(`${N8N}/rest/community-packages`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error(`cannot install ${name}: ${res.status} ${await res.text()}`);
  }
}

let KEY;
export async function connect() {
  await ready();
  const json = { "content-type": "application/json" };
  const packagesFile = path.join(root, ".n8n-test-packages");
  const saved = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, "utf8").trim() : null;
  const works = saved && (await fetch(`${N8N}/api/v1/workflows?limit=1`, { headers: { "X-N8N-API-KEY": saved } })).status === 200;
  const installed = works && fs.existsSync(packagesFile) && fs.readFileSync(packagesFile, "utf8") === `${saved}:${PACKAGES.join(",")}`;
  // Signing in is rate-limited, so it happens only when there is something to set up.
  if (installed) return (KEY = saved);
  const cookie = await signIn();
  await ensurePackages(cookie);
  if (works) KEY = saved;
  else {
    const scopes = (await (await fetch(`${N8N}/rest/api-keys/scopes`, { headers: { cookie } })).json()).data;
    const made = await fetch(`${N8N}/rest/api-keys`, { method: "POST", headers: { ...json, cookie }, body: JSON.stringify({ label: `tests-${Date.now()}`, scopes, expiresAt: null }) });
    if (!made.ok) throw new Error(`cannot create an API key: ${made.status} ${await made.text()}`);
    KEY = (await made.json()).data.rawApiKey;
    fs.writeFileSync(keyFile, KEY);
  }
  fs.writeFileSync(packagesFile, `${KEY}:${PACKAGES.join(",")}`);
  return KEY;
}

export async function n8n(method, p, body) {
  const res = await fetch(`${N8N}/api/v1${p}`, { method, headers: { "X-N8N-API-KEY": KEY, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

export const mock = async (p, body) =>
  (await fetch(`${MOCKS}${p}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();

/**
 * One credential per platform, made with throwaway data. Returns platform -> id.
 * They are remembered between runs, keyed to the API key they were made with.
 */
export async function ensureCredentials() {
  const file = path.join(root, ".n8n-test-creds.json");
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved.key === KEY && Object.keys(PLATFORMS).every((p) => !PLATFORMS[p].credential || saved.ids[p])) return saved.ids;
  }
  const ids = {};
  for (const [id, p] of Object.entries(PLATFORMS)) {
    if (!p.credential) continue;
    try {
      ids[id] = (await n8n("POST", "/credentials", { name: p.credentialName ?? p.name, type: p.credential, data: p.test })).id;
    } catch (e) {
      throw new Error(`credential for ${p.name} (${p.credential}) was refused: ${e.message}`);
    }
  }
  fs.writeFileSync(file, JSON.stringify({ key: KEY, ids }));
  return ids;
}

/** Fills workflow and credential placeholders with the ids this instance gave them. */
export const fill = (json, workflows, credentials) =>
  JSON.parse(
    JSON.stringify(json)
      .replace(/__WF:([a-z0-9-]+)__/g, (_, id) => workflows[id] ?? `MISSING_${id}`)
      .replace(/__CRED:([A-Za-z0-9]+)__/g, (_, id) => credentials[id] ?? `MISSING_${id}`),
  );
