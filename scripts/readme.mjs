/**
 * The files written from the whole library at once: the front README, the
 * Supabase schema and the environment example. Called by `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { root } from "./load.mjs";
import { PLATFORMS } from "../lib/platforms.mjs";
import { UNIQUE } from "../lib/schema.mjs";

const iconFile = (id) => (fs.existsSync(path.join(root, "assets/platforms", `${id}.svg`)) ? `${id}.svg` : `${id}.png`);

/** A platform's mark and name, as it is shown in every README. `up` is the path back to the repository root. */
export const mark = (id, up = "") => `<img src="${up}assets/platforms/${iconFile(id)}" width="16" height="16" alt=""> ${PLATFORMS[id].name}`;
export const marks = (ids, up = "") => (ids.length ? ids.map((id) => mark(id, up)).join(" &nbsp;·&nbsp; ") : "none, logic only");

const GROUPS = [
  ["Sales and marketing", ["hubspot", "calendly", "typeform", "mailchimp", "clearbit", "serpapi", "linkedin", "x", "facebook", "wordpress"]],
  ["Support and community", ["zendesk", "gmail", "discord"]],
  ["Messaging", ["slack", "sendgrid", "twilio"]],
  ["Commerce and finance", ["shopify", "stripe", "quickbooks"]],
  ["Operations and data", ["supabase", "googleCalendar", "googleDrive", "googleSheets", "bamboohr", "posthog"]],
  ["AI", ["anthropic", "openai", "pinecone", "elevenlabs"]],
];

const title = (s) => s[0].toUpperCase() + s.slice(1);

export function writeReadme(doc) {
  const { workflows, systems, tested } = doc;
  const tests = workflows.reduce((n, w) => n + w.tests.length, 0);
  const tier = (t) => workflows.filter((w) => w.tier === t);
  const ofSystem = (s) => workflows.filter((w) => w.system === s.id);
  const platformsOf = (list) => Object.keys(PLATFORMS).filter((p) => list.some((w) => w.platforms.includes(p)));
  const ai = systems.filter((s) => s.id.startsWith("ai-"));
  const rest = systems.filter((s) => !s.id.startsWith("ai-"));
  const used = Object.keys(PLATFORMS).filter((p) => doc.platforms[p].workflows > 0);
  const out = [];
  const p = (...lines) => out.push(...lines, "");

  p("# n8n workflows, built to stay up");
  p("[![Test](https://github.com/kimjoshuadr/n8n-workflows/actions/workflows/test.yml/badge.svg)](https://github.com/kimjoshuadr/n8n-workflows/actions/workflows/test.yml)");
  p(`${workflows.length} n8n workflows on ${used.length} named platforms, written as code and run against a real n8n: ${ai.length} multi-agent AI systems of ${Math.min(...ai.flatMap((s) => ofSystem(s).map((w) => w.nodeCount)))} to ${Math.max(...ai.flatMap((s) => ofSystem(s).map((w) => w.nodeCount)))} nodes each, ${rest.length} more complete systems, ${tier("production").length} single-purpose production workflows and ${tier("block").length} building blocks.`);
  p(`Most workflow collections show the path where everything works. These are written for the other days: the webhook that arrives twice, the API that is down, the model that replies with something unreadable, the schedule that silently stops. **${tests} such behaviours are tested**, each by importing the workflow into n8n, sending it input and checking what it actually did.`);
  p("> **What these are.** Reference builds, written for this library and run on test data. They are not copies of any client's system, and no client data is in this repository.");

  p("## The platforms");
  p("One named platform per job, used the same way in every workflow. Each step that touches a platform is that platform's own n8n node with its own credential, so the canvas shows its logo and the README of every workflow lists exactly what it connects to.");
  for (const [group, ids] of GROUPS) {
    p(`**${group}**`);
    p(...ids.filter((id) => used.includes(id)).map((id) => `- ${mark(id)}: ${PLATFORMS[id].job}. ${doc.platforms[id].workflows} ${doc.platforms[id].workflows === 1 ? "workflow" : "workflows"}.`));
  }

  p("## AI systems");
  p("Each is one canvas: several agents with their own tools, memory and knowledge base, checked by code and by a second model before anything reaches a customer. Claude does the reasoning and writing, OpenAI the classification and embeddings, Pinecone holds the knowledge base and ElevenLabs the voice.");
  for (const s of ai) {
    const list = ofSystem(s);
    p(`### [${s.name}](${s.folder})`);
    p(s.line + " " + s.outcome);
    p(`- **Size:** ${list.reduce((n, w) => n + w.nodeCount, 0)} nodes, ${list.reduce((n, w) => n + w.tests.length, 0)} tested behaviours`, `- **Platforms:** ${marks(platformsOf(list))}`);
  }

  p("## Systems");
  for (const s of rest) {
    const list = ofSystem(s);
    p(`### [${s.name}](${s.folder})`);
    p(s.line);
    p(`- **Size:** ${list.length} workflows, ${list.reduce((n, w) => n + w.nodeCount, 0)} nodes, ${list.reduce((n, w) => n + w.tests.length, 0)} tested behaviours`, `- **Platforms:** ${marks(platformsOf(list))}`);
  }
  p("Each folder has a README with a diagram of every workflow, how it runs step by step, the platforms it touches and the behaviours it is tested for.");

  const listing = (heading, list, strip) => {
    p(`## ${heading}`);
    for (const [folder, group] of Map.groupBy(list, (w) => w.folder)) {
      p(`**[${title(folder.split("/").pop())}](${folder})**`);
      p(...group.map((w) => `- ${w.name.replace(strip, "")}: ${w.platforms.length ? w.platforms.map((id) => PLATFORMS[id].name).join(", ") : "logic only"}`));
    }
  };
  listing("Production workflows", tier("production"), /^[^·]+· /);
  listing("Building blocks", tier("block"), /^Block · /);

  p("## What \"built to stay up\" means here");
  p("Every workflow follows the same rules, and the tests hold them to it.");
  p(
    "- **Handled once.** Anything triggered from outside claims an idempotency key in Supabase before it acts. A repeated delivery changes nothing.",
    "- **Failures have somewhere to go.** Calls to a platform retry three times. Writes that must not be lost take a failure branch into a dead-letter queue, which is replayed on a timer.",
    "- **One alert, not a thousand.** Every workflow names the same error handler, which alerts in Slack once per distinct error per hour. Alerts fall back to email when Slack is down.",
    "- **A model is never trusted with the outcome.** Model replies must arrive in a declared shape and are read defensively. Arithmetic, duplicate checks and policy rules are done in code. When a model is unavailable or unsure, the work goes to a person; nothing is deleted, refunded or published on a guess.",
    "- **State lives in Supabase.** No workflow sleeps for days. Follow-ups, reminders and escalations are short scheduled runs that read where things stand.",
    "- **Silence is checked too.** Scheduled workflows check in, and a monitor alerts when one stops.",
    "- **No secrets in the repository.** Every platform is reached through an n8n credential that you create in your own instance. The files hold a placeholder where the credential goes.",
  );

  p("## Use them");
  p("**Import one by hand.** Take the `.json` next to any workflow and import it in n8n. Import [`shared/`](shared) first, then replace each `__WF:name__` placeholder with the id of that workflow in your instance, and choose your own credential on each platform node.");
  p("**Or install with the script**, which does both for you:");
  p("```sh", "npm ci", "N8N_URL=https://your-n8n.example.com N8N_API_KEY=... npm run install-workflows -- ai-sales-team", "```");
  p("It installs the system you name and everything it calls, in order, inactive. Where your instance already has a credential of the type a node needs, the node is pointed at it; the script lists the credential types that are still missing. Leave the name off to install the whole library.");
  p("**Then create the tables.** [`schema.sql`](schema.sql) holds the Supabase tables the workflows keep their state in, with the unique constraints that make a repeated run safe.");
  p("A few workflows also read a service that is the business's own and has no node: a supplier's stock feed, a backup report. Those addresses are environment variables, listed in [`.env.example`](.env.example).");

  p("## Run the tests");
  p("You need Docker and Node 22.");
  p("```sh", "npm ci", "npm run stack:up     # a throwaway n8n and a stand-in for every platform", `npm test             # all ${tests} cases`, 'npm test -- refund   # only workflows whose id contains "refund"', "npm run stack:down", "```");
  p(`Nothing in a workflow is changed for testing. The stack answers on each platform's real hostname, so the Slack node believes it is talking to Slack and the agents believe they are talking to Claude and OpenAI. The runner imports each workflow, sends the case's input, waits for the execution and checks which nodes ran, what each platform received and what Supabase holds afterwards. Model replies are scripted per case, and any platform can be made to fail a set number of times, which is how the retry, fallback and dead-letter paths are exercised.${tested ? ` Last full run: **${tested.passed} passed, ${tested.failed} failed on n8n ${tested.n8n}** ([\`test-results.json\`](test-results.json)).` : ""}`);

  p("## How it is written");
  p("Workflows are defined in [`definitions/`](definitions) with a small vocabulary ([`lib/wf.mjs`](lib/wf.mjs) for logic, [`lib/nodes.mjs`](lib/nodes.mjs) for platforms and agents): name the nodes, then the wiring. The definition also holds the step-by-step explanation and the test cases, so the three cannot drift apart.");
  p("`npm run build` turns the definitions into:");
  p("- `<id>.json`, the importable workflow", "- `<id>.workflow.ts`, the same workflow as a TypeScript file", "- a README per folder, with Mermaid diagrams", "- [`catalog.json`](catalog.json), the whole library as data", "- this README, [`schema.sql`](schema.sql) and [`.env.example`](.env.example)");
  p("`npm run validate` checks every workflow against n8n's node schemas and scans for anything that looks like a secret. CI runs build, validate and the full test suite on every push.");
  p("Platform names and logos belong to their owners and are shown only to say what each workflow connects to.");
  p("## Licence");
  out.push("MIT.", "");
  fs.writeFileSync(path.join(root, "README.md"), out.join("\n"));
}

const TYPE = (col) => (/(_at|^at|^last_seen|^due|^expires)$/.test(col) ? "timestamptz" : /^(payload|data|meta|context|facts|items|lines|answers)$/.test(col) ? "jsonb" : /^(count|attempts|amount|total|score|qty|quantity|max_gap_minutes)$/.test(col) || /_(count|cents|minutes)$/.test(col) ? "numeric" : "text");

/** Every table and column a Supabase node reads or writes, as a schema to start from. */
export function writeSchema(defs) {
  const tables = new Map();
  const add = (table, col) => {
    if (!tables.has(table)) tables.set(table, new Set());
    if (col && col !== "id" && col !== "created_at") tables.get(table).add(col);
  };
  for (const def of defs) {
    for (const n of def.json.nodes) {
      if (n.type === "n8n-nodes-base.supabase") {
        add(n.parameters.tableId);
        for (const f of n.parameters.fieldsUi?.fieldValues ?? []) add(n.parameters.tableId, f.fieldId);
        for (const c of n.parameters.filters?.conditions ?? []) add(n.parameters.tableId, c.keyName);
      }
      const rest = /supabase\.co\/rest\/v1\/([a-z_]+)/.exec(n.parameters?.url ?? "");
      if (rest) {
        add(rest[1]);
        for (const m of (n.parameters.jsonBody ?? "").matchAll(/[{,]\s*([a-z_]+):/g)) add(rest[1], m[1]);
      }
    }
  }
  const out = ["-- The Supabase tables the workflows keep their state in.", "-- Written by `npm run build` from the columns the workflows read and write.", "-- Column types are a starting point: tighten them to your data.", ""];
  for (const [table, cols] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
    const unique = UNIQUE[table];
    if (unique) cols.add(unique);
    out.push(`create table if not exists ${table} (`, ["  id uuid primary key default gen_random_uuid()", ...[...cols].sort().map((c) => `  ${c} ${TYPE(c)}${c === unique ? " not null unique" : ""}`), "  created_at timestamptz not null default now()"].join(",\n"), ");", "");
  }
  fs.writeFileSync(path.join(root, "schema.sql"), out.join("\n"));
}

const ENV = {
  SUPPLIER_BASE_URL: ["https://YOUR-SUPPLIER/api", "http://mocks:4010/supplier"],
  SUPPLIER_API_KEY: ["", "test-key"],
  BACKUP_BASE_URL: ["https://YOUR-BACKUP-SERVICE/api", "http://mocks:4010/backup"],
  BACKUP_API_KEY: ["", "test-key"],
  SHOP_API_KEY: ["", "test-key"],
};

/** The few services that have no node are reached by address; everything else is an n8n credential. */
export function writeEnv(defs) {
  const used = [...new Set(defs.flatMap((d) => d.env))].sort();
  for (const name of used) if (!ENV[name]) throw new Error(`${name} is read by a workflow but has no entry in scripts/readme.mjs`);
  const head = "# Platforms are reached through n8n credentials, not through this file.\n# These are the addresses of services that are the business's own.\n";
  fs.writeFileSync(path.join(root, ".env.example"), head + used.map((n) => `${n}=${ENV[n][0]}`).join("\n") + "\n");
  fs.writeFileSync(path.join(root, ".env.test"), "# Written by `npm run build`: the same names, pointed at the test stack.\n" + used.map((n) => `${n}=${ENV[n][1]}`).join("\n") + "\n");
}
