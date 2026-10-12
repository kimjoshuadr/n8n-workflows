import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Clean text into a URL slug
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Slugify                            code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Slugify
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Clean text into a URL slug',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockCleanTextIntoAUrlSlugWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '7050fceb-60a2-4a83-aeb7-a61a497c43f9',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · Clean text into a URL slug
Turns any title into a safe, readable URL slug, including accented and non-Latin titles.

**Needs:** nothing external
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: '5b63157a-4dde-41a3-a430-e0c9f4206eb7',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: 'b05acf1e-8a58-410c-ae7b-0f17a3fde092',
        name: 'Slugify',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    Slugify = {
        jsCode: `return $input.all().map((item) => {
  const slug = String(item.json.title ?? "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
  return { json: { ...item.json, slug: slug || "untitled-" + Math.abs([...String(item.json.title ?? "")].reduce((h, c) => (h * 31 + c.codePointAt(0)) | 0, 7)).toString(36) } };
});`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Slugify.in(0));
    }
}
