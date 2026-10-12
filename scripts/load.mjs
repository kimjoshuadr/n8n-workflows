/** Every definition in the library, in a stable order. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const root = path.resolve(import.meta.dirname, "..");

/** `fresh` re-evaluates the definitions, so dates written relative to "now" are current. */
export async function loadAll({ fresh = false } = {}) {
  const dir = path.join(root, "definitions");
  const defs = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href + (fresh ? `?t=${Date.now()}` : ""));
    for (const d of mod.default) defs.push({ ...d, definedIn: `definitions/${file}` });
  }
  const seen = new Set();
  for (const d of defs) {
    if (seen.has(d.id)) throw new Error(`duplicate workflow id: ${d.id}`);
    seen.add(d.id);
  }
  return defs;
}

/** The ids of the library workflows this one calls, including its error handler. */
export const refsOf = (def) => [...new Set(JSON.stringify(def.json).match(/__WF:([a-z0-9-]+)__/g)?.map((s) => s.slice(5, -2)) ?? [])];
