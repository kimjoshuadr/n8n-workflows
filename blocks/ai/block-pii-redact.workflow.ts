import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Mask personal data before a model sees it
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Redact                             code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Redact
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Mask personal data before a model sees it',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockMaskPersonalDataBeforeAModelSeesItWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '322c9637-512b-4e5b-af04-1961df1be534',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · Mask personal data before a model sees it
Replaces emails, phone numbers and card numbers with placeholders, and hands back the map to restore them afterwards.

**Needs:** nothing external
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/ai\``,
    };

    @node({
        id: '333de384-e0f8-4a0f-a8aa-7c5f7dbb79f2',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '65d9d932-6242-47ac-a993-46fc80c6fa8a',
        name: 'Redact',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    Redact = {
        jsCode: `return $input.all().map((item) => {
  const map = {};
  let n = 0;
  const swap = (kind) => (match) => { const token = "[" + kind + "_" + ++n + "]"; map[token] = match; return token; };
  const text = String(item.json.text ?? "")
    .replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, swap("EMAIL"))
    .replace(/\\b(?:\\d[ -]?){13,19}\\b/g, swap("CARD"))
    .replace(/\\+?\\d[\\d ()-]{7,}\\d/g, swap("PHONE"));
  return { json: { text, map, redactions: n } };
});`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Redact.in(0));
    }
}
