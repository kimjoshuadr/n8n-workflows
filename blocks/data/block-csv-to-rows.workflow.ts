import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · CSV text to rows
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Parse                              code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Parse
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · CSV text to rows',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockCsvTextToRowsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '34855172-e6ca-47ca-a4d1-7d1ce09f62c3',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · CSV text to rows
Parses CSV text properly, including quoted commas and blank lines, into one item per row.

**Needs:** nothing external
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: '19f91a05-4d91-48d9-ae9f-bb0b97a2d092',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '3153f988-044b-41a2-ab72-7a1c9aaaacee',
        name: 'Parse',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    Parse = {
        jsCode: `const text = String($input.first().json.csv ?? "").replace(/^\\uFEFF/, "");
const rows = [];
let row = [], cell = "", quoted = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
  else if (c === '"') quoted = true;
  else if (c === ",") { row.push(cell); cell = ""; }
  else if (c === "\\n" || c === "\\r") { if (c === "\\r" && text[i + 1] === "\\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
  else cell += c;
}
if (cell.length || row.length) { row.push(cell); rows.push(row); }
const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
if (!header) return [];
return body.map((r) => ({ json: Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])) }));`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Parse.in(0));
    }
}
