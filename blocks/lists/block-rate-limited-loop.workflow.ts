import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Loop that respects a rate limit
// Nodes   : 6  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// FiveAtATime                        splitInBatches
// Send                               httpRequest                [onError→regular] [retry]
// Pause                              wait
// Finished                           noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → FiveAtATime
//      → Finished
//     .out(1) → Send
//        → Pause
//          → FiveAtATime (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Loop that respects a rate limit',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockLoopThatRespectsARateLimitWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b5402a59-60e1-4978-a3f1-e8eca0003ca8',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Loop that respects a rate limit
Sends items in small batches with a pause between them, for APIs that reject bursts.

**Platforms:** none, this is logic only
**Settings:** EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/lists\``,
    };

    @node({
        id: '29456fd6-d221-4bb3-a076-4c05cb3aac4f',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '241695c6-bc46-49b3-adde-0ba3ec902d0d',
        name: 'Five at a time',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [260, 180],
    })
    FiveAtATime = {
        batchSize: 5,
        options: {},
    };

    @node({
        id: '946085ab-8480-4676-a553-0615fceaff09',
        name: 'Send',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Send = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/emails',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.EMAIL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ to: $json.email, template: 'bulk' }) }}",
    };

    @node({
        id: '93335136-9f17-4f45-aa3d-b25a22c7abf8',
        webhookId: '5f71707a-a3ff-48b2-a307-f22c47256f16',
        name: 'Pause',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [780, 180],
    })
    Pause = {
        amount: 2,
        unit: 'seconds',
    };

    @node({
        id: 'bc05a9f0-2ccd-4316-a02d-828fa7eb4020',
        name: 'Finished',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [520, 270],
    })
    Finished = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.FiveAtATime.in(0));
        this.FiveAtATime.out(0).to(this.Finished.in(0));
        this.FiveAtATime.out(1).to(this.Send.in(0));
        this.Send.out(0).to(this.Pause.in(0));
        this.Pause.out(0).to(this.FiveAtATime.in(0));
    }
}
