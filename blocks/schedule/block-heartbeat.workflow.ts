import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Check in with the heartbeat monitor
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// CheckIn                            httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → CheckIn
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Check in with the heartbeat monitor',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockCheckInWithTheHeartbeatMonitorWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '15f28b4f-f2be-4b3f-aaab-d5275e239a15',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · Check in with the heartbeat monitor
The two nodes a scheduled workflow adds so the heartbeat monitor can tell when it stops running.

**Needs:** DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/schedule\``,
    };

    @node({
        id: '0d5e14a1-4a8a-4110-a3f8-9061685c8175',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '25f69045-c3d2-4b4a-a5bc-5407849851d3',
        name: 'Check in',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CheckIn = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/heartbeats',
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
                    value: "={{ 'name' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ name: $json.name, last_seen: $now.toISO(), max_gap_minutes: $json.max_gap_minutes ?? 90 }) }}',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.CheckIn.in(0));
    }
}
