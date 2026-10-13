import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Retry with growing waits
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Begin                              set
// Try_                               httpRequest                [onError→out(1)]
// Worked                             set
// Again                              code
// AttemptsLeft                       if
// BackOff                            wait
// GaveUp                             set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Begin
//      → Try_
//        → Worked
//       .out(1) → Again
//          → AttemptsLeft
//            → BackOff
//              → Try_ (↩ loop)
//           .out(1) → GaveUp
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Retry with growing waits',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockRetryWithGrowingWaitsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '34dea2df-0ab1-4b70-a8ac-24a09f6d2a18',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Retry with growing waits
Calls an address up to four times, waiting longer each time, and reports clearly whether it finally worked.

**Platforms:** none, this is logic only
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/reliability\``,
    };

    @node({
        id: 'c524340f-bc14-4db8-a123-97eff6b962e4',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '569708b4-c93f-4fc8-a8a1-d06a965f239c',
        name: 'Begin',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [260, 180],
    })
    Begin = {
        assignments: {
            assignments: [
                {
                    id: 'f2dfff98-e961-45c1-aa07-b8a7b3fa7ae9',
                    name: 'url',
                    value: '={{ $json.url }}',
                    type: 'string',
                },
                {
                    id: '278f0b2d-1256-46f5-a2b3-70c309c7e453',
                    name: 'payload',
                    value: '={{ JSON.stringify($json.payload ?? {}) }}',
                    type: 'string',
                },
                {
                    id: '7a693ed8-e014-4b83-ab26-fae1c5d20d1a',
                    name: 'attempt',
                    value: '={{ 1 }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '3cc0b145-84f2-40a8-a6c0-2017b12a23de',
        name: 'Try',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 180],
        onError: 'continueErrorOutput',
    })
    Try_ = {
        method: 'POST',
        url: '={{ $json.url }}',
        options: {
            timeout: 15000,
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify(JSON.parse($json.payload)) }}',
    };

    @node({
        id: '0e387f0a-d9fb-472d-ac51-aeed0248d14c',
        name: 'Worked',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 90],
    })
    Worked = {
        assignments: {
            assignments: [
                {
                    id: 'ce05eb7e-217c-455d-a958-079615048771',
                    name: 'ok',
                    value: '={{ true }}',
                    type: 'string',
                },
                {
                    id: '8640279f-29a6-4574-ae9d-6050a176461c',
                    name: 'attempts',
                    value: "={{ $('Again?').isExecuted ? $('Again?').last().json.attempt : 1 }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '1d5f0688-07b8-4ecd-a0ba-851817c3f923',
        name: 'Again?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 270],
    })
    Again = {
        jsCode: `const prev = $("Begin").first().json;
const attempt = $runIndex + 2;
return [{ json: { url: prev.url, payload: prev.payload, attempt, give_up: attempt > 4, wait_seconds: Math.min(2 ** (attempt - 1), 30) } }];`,
    };

    @node({
        id: 'b530af44-cdf7-42ff-a3e9-e5f9eb2f2070',
        name: 'Attempts left?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    AttemptsLeft = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '468ddceb-ac8a-43c4-a028-32cf22d7bc55',
                    leftValue: '={{ !$json.give_up }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'a6bd8d77-c15a-4bfd-a13f-66a7d53458d4',
        webhookId: '26c1b109-5d67-46ed-a7cd-099d9a078077',
        name: 'Back off',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [1300, 90],
    })
    BackOff = {
        amount: 2,
        unit: 'seconds',
    };

    @node({
        id: 'cc232b8c-c5d2-4e8b-a6b6-c481bc556fee',
        name: 'Gave up',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1300, 270],
    })
    GaveUp = {
        assignments: {
            assignments: [
                {
                    id: '2b4d8a86-1e25-49f8-a5a5-bc1633254161',
                    name: 'ok',
                    value: '={{ false }}',
                    type: 'string',
                },
                {
                    id: '4dfd2692-2648-4fba-a128-b2db388eea60',
                    name: 'attempts',
                    value: '={{ 4 }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Begin.in(0));
        this.Begin.out(0).to(this.Try_.in(0));
        this.Try_.out(0).to(this.Worked.in(0));
        this.Try_.out(1).to(this.Again.in(0));
        this.Again.out(0).to(this.AttemptsLeft.in(0));
        this.AttemptsLeft.out(0).to(this.BackOff.in(0));
        this.AttemptsLeft.out(1).to(this.GaveUp.in(0));
        this.BackOff.out(0).to(this.Try_.in(0));
    }
}
