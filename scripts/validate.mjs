/**
 * Checks every built workflow against n8n's node schemas, and
 * that nothing that looks like a secret has reached a workflow file.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { root } from "./load.mjs";

const files = ["systems", "workflows", "blocks", "shared"].flatMap((d) => fs.globSync(`${d}/**/*.json`, { cwd: root }));
const bin = path.join(root, "node_modules/.bin/n8nac");
const SECRET = /(sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/;

let bad = 0;
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const problems = [];
  if (SECRET.test(text)) problems.push("contains something that looks like a secret");
  if (/"credentials"\s*:/.test(text)) problems.push("carries a credential reference; services are reached through env vars");
  try {
    const out = execFileSync(bin, ["skills", "validate", path.join(root, file)], { encoding: "utf8", stdio: "pipe", env: { ...process.env, N8NAC_TELEMETRY_DISABLED: "1" } });
    if (!/Workflow is valid/.test(out)) problems.push(out.trim().split("\n").slice(-6).join(" | "));
  } catch (e) {
    problems.push(String(e.stdout || e.message).trim().split("\n").slice(-6).join(" | "));
  }
  if (problems.length) {
    bad++;
    console.log(`  ✗  ${file}\n       ${problems.join("\n       ")}`);
  }
}
console.log(`${files.length - bad} of ${files.length} workflows valid`);
process.exit(bad ? 1 : 0);
