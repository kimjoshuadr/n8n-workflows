import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Remove duplicates by key
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Dedupe                             code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Dedupe
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Remove duplicates by key',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockRemoveDuplicatesByKeyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'bf9b9d5f-1f68-4ddd-a99f-cface78f59d8',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · Remove duplicates by key
Keeps the first of each item sharing a key, after normalising it, so 'A@B.co ' and 'a@b.co' count as one.

**Needs:** nothing external
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/lists\``,
    };

    @node({
        id: '4d049c42-e445-4984-a4a3-5ddd95c6eef5',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '6b31badf-295d-40d1-a620-97f91112f0c9',
        name: 'Dedupe',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    Dedupe = {
        jsCode: `const seen = new Set();
const out = [];
for (const item of $input.all()) {
  const key = String(item.json.email ?? item.json.key ?? "").trim().toLowerCase();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  out.push({ json: { ...item.json, email: item.json.email ? key : undefined } });
}
return out;`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Dedupe.in(0));
    }
}
