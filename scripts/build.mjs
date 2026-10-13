/**
 * Builds everything that is generated from the definitions:
 *
 *   <folder>/<id>.json          importable n8n workflow
 *   <folder>/<id>.workflow.ts   the same workflow as a TypeScript file
 *   <folder>/README.md          what each workflow does, its diagram and its tests
 *   catalog.json                the whole library as data
 *   README.md, schema.sql, .env.example
 *
 * Run it after changing a definition. CI fails if the result differs from what
 * is committed.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadAll, refsOf, root } from "./load.mjs";
import { SYSTEMS, TIERS } from "./systems.mjs";
import { PLATFORMS } from "../lib/platforms.mjs";
import { marks, writeReadme, writeSchema, writeEnv } from "./readme.mjs";

const defs = await loadAll();
const byFolder = Map.groupBy(defs, (d) => d.folder);
const results = fs.existsSync(path.join(root, "test-results.json")) ? JSON.parse(fs.readFileSync(path.join(root, "test-results.json"), "utf8")) : null;

for (const dir of ["production", "systems", "workflows", "blocks", "shared"]) fs.rmSync(path.join(root, dir), { recursive: true, force: true });

const mermaidId = (name) => "n" + [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
const SHAPE = { trigger: ["([", "])"], branch: ["{", "}"], http: ["[/", "/]"], call: ["[[", "]]"], respond: ["([", "])"], fail: ["((", "))"] };
function mermaid(def) {
  const lines = ["flowchart LR"];
  for (const n of def.graph.nodes) {
    const [open, close] = SHAPE[n.kind] ?? (n.kind === "agent" ? ["[[", "]]"] : n.kind === "part" ? ["(", ")"] : ["[", "]"]);
    lines.push(`  ${mermaidId(n.id)}${open}"${n.id.replace(/"/g, "'")}"${close}`);
  }
  for (const e of def.graph.edges) {
    const from = def.graph.nodes.find((n) => n.id === e.from);
    if (e.part) { lines.push(`  ${mermaidId(e.from)} -.-> ${mermaidId(e.to)}`); continue; }
    const label = from.kind === "branch" && def.graph.edges.filter((x) => x.from === e.from).length > 1 ? (from.id.endsWith("?") ? (e.out === 0 ? "|yes|" : "|no|") : "") : from.kind === "http" && e.out === 1 ? "|failed|" : from.kind === "loop" ? (e.out === 0 ? "|done|" : "|each|") : "";
    lines.push(`  ${mermaidId(e.from)} -->${label} ${mermaidId(e.to)}`);
  }
  return lines.join("\n");
}

const TRIGGER = { formTrigger: "Form", webhook: "Webhook", scheduleTrigger: "Schedule", manualTrigger: "Manual run", executeWorkflowTrigger: "Called by another workflow", errorTrigger: "A failure in any workflow" };

const startsFrom = (def) =>
  [...new Set(def.graph.nodes.filter((g) => g.kind === "trigger").map((g) => (g.platform ? `${PLATFORMS[g.platform].name} event` : (TRIGGER[def.json.nodes.find((n) => n.name === g.id).type.split(".").pop()] ?? "Trigger"))))].join(", ");

function section(def, level = "##") {
  const out = [`${level} ${def.name}`, "", def.summary, ""];
  const up = "../".repeat(def.folder.split("/").length);
  out.push(
    `- **Starts from:** ${startsFrom(def)}`,
    `- **Platforms:** ${marks(def.platforms, up)}`,
    `- **Nodes:** ${def.nodeCount}`,
    `- **Calls:** ${refsOf(def).map((r) => `\`${r}\``).join(", ") || "nothing"}`,
    `- **Files:** [\`${def.id}.json\`](${def.id}.json) · [\`${def.id}.workflow.ts\`](${def.id}.workflow.ts)`,
    "",
  );
  out.push("```mermaid", mermaid(def), "```", "");
  if (def.story?.length) {
    out.push("**How it runs**", "");
    def.story.forEach((s, i) => out.push(`${i + 1}. **${s.title}.** ${s.copy}`));
    out.push("");
  }
  out.push("**Tested behaviour**", "");
  for (const t of def.tests) out.push(`- ${t.name}`);
  out.push("");
  return out.join("\n");
}

/** What could not be taken from a canvas, said once per folder. */
const NOTES = {
  "production/newsletter-research": "The ten source rows were too small to read in the screenshot: three are built as forum feeds and seven as blogs, and where the canvas drops an item with a Filter node inside the loop, this build uses an If node so the loop is handed back.",
  "production/newsletter-drafting": "The canvas was photographed in pieces and its model nodes were out of frame: Gemini and Groq are the models named on the blog workflow from the same team.",
  "production/community-provisioning": "The canvas has three sections, kept here. Its nodes could not all be read from the screenshot, so the steps inside each section follow the written description of the workflow.",
  "production/revenue-support-agents": "The two tracks and six agents are the original's. The canvas was too small to read node by node, so the steps between the agents follow the written description; sending through Gmail and alerting in Slack are this build's choices.",
  "production/operations": "The node the bulk creator read its rows from could not be identified in the screenshot; here they come from a Google Sheet.",
};

const catalog = [];
for (const [folder, list] of byFolder) {
  const dir = path.join(root, folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const def of list) fs.writeFileSync(path.join(dir, `${def.id}.json`), JSON.stringify(def.json, null, 2) + "\n");

  const system = SYSTEMS.find((s) => s.folder === folder);
  const title = system ? system.name : folder.split("/").map((p) => p[0].toUpperCase() + p.slice(1)).join(" · ");
  const head = [`# ${title}`, ""];
  if (system) head.push(`**${system.line}**`, "", `**The problem.** ${system.problem}`, "", `**What this does about it.** ${system.outcome}`, "", `${list.length === 1 ? `One canvas of ${list[0].nodeCount} nodes` : `${list.length} workflows`}, ${list.reduce((n, d) => n + d.tests.length, 0)} tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.`, "");
  else head.push(`${list.length} workflows. Each one is tested against a real n8n; the cases are listed under it.`, "");
  if (list.some((d) => d.source === "production")) head.push("> **Built and run in production, rebuilt here on test data.** Node names, order, branches and loops follow the original canvas. What is inside each node was written again for this library, and every name that belonged to the business is a placeholder." + (NOTES[folder] ? " " + NOTES[folder] : ""), "");
  fs.writeFileSync(path.join(dir, "README.md"), head.join("\n") + "\n" + list.map((d) => section(d)).join("\n"));

  for (const def of list) {
    catalog.push({
      id: def.id,
      name: def.name,
      tier: def.tier,
      system: def.system ?? null,
      category: def.category,
      kind: def.kind ?? null,
      summary: def.summary,
      source: def.source ?? "reference",
      trigger: def.trigger,
      platforms: def.platforms,
      env: def.env,
      calls: refsOf(def),
      folder,
      nodeCount: def.nodeCount,
      tests: def.tests.map((t) => t.name),
      story: def.story ?? [],
      graph: def.graph,
    });
  }
}

// TypeScript sources. One process per folder.
const bin = path.join(root, "node_modules/.bin/n8nac");
for (const folder of byFolder.keys()) {
  execFileSync(bin, ["convert-batch", path.join(root, folder), "--format", "typescript", "-f"], { stdio: "pipe", env: { ...process.env, N8NAC_TELEMETRY_DISABLED: "1" } });
}

const order = { flagship: 0, production: 1, block: 2 };
catalog.sort((a, b) => order[a.tier] - order[b.tier] || SYSTEMS.findIndex((s) => s.id === a.system) - SYSTEMS.findIndex((s) => s.id === b.system) || 0);
const doc = {
  repo: "https://github.com/kimjoshuadr/n8n-workflows",
  tested: results ? { n8n: results.n8n, passed: results.passed, failed: results.failed } : null,
  tiers: TIERS,
  platforms: Object.fromEntries(Object.entries(PLATFORMS).map(([id, p]) => [id, { name: p.name, job: p.job, icon: fs.existsSync(path.join(root, "assets/platforms", `${id}.svg`)) ? `${id}.svg` : `${id}.png`, workflows: catalog.filter((w) => w.platforms.includes(id)).length }])),
  systems: SYSTEMS.map((s) => ({ ...s, workflows: catalog.filter((w) => w.system === s.id).map((w) => w.id) })),
  workflows: catalog,
};
fs.writeFileSync(path.join(root, "catalog.json"), JSON.stringify(doc, null, 2) + "\n");
writeReadme(doc);
writeSchema(defs);
writeEnv(defs);

console.log(`built ${catalog.length} workflows in ${byFolder.size} folders`);
