/**
 * Installs the library into an n8n instance, in dependency order, filling in
 * each reference to another workflow with the id it was given.
 *
 *   N8N_URL=https://n8n.example.com N8N_API_KEY=... node scripts/install.mjs
 *   ... node scripts/install.mjs lead-intake        only that system and what it calls
 *
 * Workflows are created inactive and prefixed nowhere: review them, set the
 * environment variables listed in .env.example, then publish the ones you want.
 */
import { loadAll, refsOf } from "./load.mjs";

const { N8N_URL, N8N_API_KEY } = process.env;
if (!N8N_URL || !N8N_API_KEY) {
  console.error("Set N8N_URL and N8N_API_KEY.");
  process.exit(1);
}
const api = async (method, p, body) => {
  const res = await fetch(`${N8N_URL.replace(/\/$/, "")}/api/v1${p}`, { method, headers: { "X-N8N-API-KEY": N8N_API_KEY, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

const all = await loadAll();
const want = process.argv[2];
const picked = new Map();
const add = (def) => {
  if (picked.has(def.id)) return;
  picked.set(def.id, def);
  for (const r of refsOf(def)) add(all.find((d) => d.id === r));
};
all.filter((d) => !want || d.id === want || d.system === want || d.folder.endsWith(want)).forEach(add);
if (!picked.size) {
  console.error(`Nothing matches "${want}".`);
  process.exit(1);
}

const existing = new Map();
for (let cursor; ; ) {
  const page = await api("GET", `/workflows?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
  for (const w of page.data) existing.set(w.name, w.id);
  if (!(cursor = page.nextCursor)) break;
}

const ids = {};
const pending = [...picked.values()];
while (pending.length) {
  const ready = pending.filter((d) => refsOf(d).every((r) => r in ids));
  if (!ready.length) throw new Error("circular reference between workflows");
  for (const def of ready) {
    if (existing.has(def.json.name)) {
      ids[def.id] = existing.get(def.json.name);
      console.log(`  =  ${def.json.name} (already there, left alone)`);
    } else {
      const body = JSON.parse(JSON.stringify(def.json).replace(/__WF:([a-z0-9-]+)__/g, (_, id) => ids[id]));
      ids[def.id] = (await api("POST", "/workflows", body)).id;
      console.log(`  +  ${def.json.name}`);
    }
    pending.splice(pending.indexOf(def), 1);
  }
}
console.log(`\n${picked.size} workflows are in place. They are inactive until you publish them.`);
