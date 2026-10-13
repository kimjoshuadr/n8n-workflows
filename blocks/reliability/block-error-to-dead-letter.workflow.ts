import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Failed call to dead letter
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Write                              httpRequest                [onError→out(1)] [retry]
// Written                            set
// Wrap                               code
// ParkIt                             executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Write
//      → Written
//     .out(1) → Wrap
//        → ParkIt
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Failed call to dead letter',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockFailedCallToDeadLetterWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b843b00e-d3c8-4e7f-a7fa-58f6506f91b8',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Failed call to dead letter
The pattern for any write that must not be lost: try, and if it still fails after retries, park the payload.

**Platforms:** none, this is logic only
**Settings:** CRM_API_KEY, CRM_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/reliability\``,
    };

    @node({
        id: 'f926bffd-0efb-47d3-a188-8e3e832bf0aa',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '8994304c-1331-49ba-a684-cb91f6605386',
        name: 'Write',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Write = {
        method: 'POST',
        url: '={{ $env.CRM_BASE_URL }}/records',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CRM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json) }}',
    };

    @node({
        id: 'c680c7f1-b0b3-4157-aa36-c6641f2ae8da',
        name: 'Written',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [520, 90],
    })
    Written = {
        assignments: {
            assignments: [
                {
                    id: 'ef638737-2cb8-4035-a720-a485e8da0920',
                    name: 'written',
                    value: '={{ true }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'de58dd76-675d-41bf-a078-0e3a638df254',
        name: 'Wrap',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 270],
    })
    Wrap = {
        jsCode: 'return [{ json: { source: "block-error-to-dead-letter", reason: "CRM write failed after retries", payload: $("When called").first().json } }];',
    };

    @node({
        id: '488d432c-1910-4073-adf6-37c6fc4262d1',
        name: 'Park it',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [780, 180],
    })
    ParkIt = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:dead-letter__',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Write.in(0));
        this.Write.out(0).to(this.Written.in(0));
        this.Write.out(1).to(this.Wrap.in(0));
        this.Wrap.out(0).to(this.ParkIt.in(0));
    }
}
