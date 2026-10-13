import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Upsert in chunks
// Nodes   : 4  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Chunk                              code
// UpsertTheChunk                     httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Chunk
//      → UpsertTheChunk
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Upsert in chunks',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockUpsertInChunksWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'f6161fef-3fbe-47ee-aac0-ad5c13060da1',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Upsert in chunks
Groups a long list into chunks of 100 and upserts each chunk in one request.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/lists\``,
    };

    @node({
        id: 'be9b8e19-b05d-4c6e-ae60-82d4a452979e',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: 'd938494d-8049-400c-a65d-5006fa3c7369',
        name: 'Chunk',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 90],
    })
    Chunk = {
        jsCode: `const rows = $input.all().map((i) => i.json);
const out = [];
for (let i = 0; i < rows.length; i += 100) out.push({ json: { rows: rows.slice(i, i + 100) } });
return out;`,
    };

    @node({
        id: '7c40a9a2-0315-4d1c-a2fb-67a4d9a4a964',
        name: 'Upsert the chunk',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpsertTheChunk = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/records',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DB_API_KEY }}",
                },
                {
                    name: 'Prefer',
                    value: 'resolution=merge-duplicates',
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'key' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.rows) }}',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Chunk.in(0));
        this.Chunk.out(0).to(this.UpsertTheChunk.in(0));
    }
}
