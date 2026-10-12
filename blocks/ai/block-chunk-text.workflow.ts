import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Split a document into overlapping chunks
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Chunk                              code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Chunk
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Split a document into overlapping chunks',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockSplitADocumentIntoOverlappingChunksWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'ad11c3c8-722b-4aa6-a2b6-8457d6fe6a86',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · Split a document into overlapping chunks
Cuts long text into chunks that end on sentence boundaries and overlap by whole sentences, ready for embedding or a model's context window.

**Needs:** nothing external
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/ai\``,
    };

    @node({
        id: 'd8c40d0f-3482-448c-a148-58c7d4990a72',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '8eb0eea8-551e-4cc2-ae4a-386a3f731b27',
        name: 'Chunk',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    Chunk = {
        jsCode: `const { text = "", size = 800, overlap = 100, id = "doc" } = $input.first().json;
const sentences = (String(text).replace(/\\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((s) => s.trim());
const chunks = [];
let current = [];
const length = (list) => list.join(" ").length;
for (const s of sentences) {
  if (current.length && length([...current, s]) > size) {
    chunks.push(current.join(" "));
    // Carry whole sentences into the next chunk, never half a word.
    const carry = [];
    for (const prev of [...current].reverse()) { if (length([prev, ...carry]) > overlap) break; carry.unshift(prev); }
    current = carry;
  }
  current.push(s);
}
if (current.length) chunks.push(current.join(" "));
return chunks.map((c, i) => ({ json: { id: id + "#" + i, index: i, of: chunks.length, text: c, chars: c.length } }));`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Chunk.in(0));
    }
}
