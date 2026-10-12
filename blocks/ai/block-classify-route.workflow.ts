import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Classify, then route
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Classify                           httpRequest                [onError→regular] [retry]
// ReadTheLabel                       code
// ByLabel                            switch
// Billing                            set
// Technical                          set
// General                            set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Classify
//      → ReadTheLabel
//        → ByLabel
//          → Billing
//         .out(1) → Technical
//         .out(2) → General
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Classify, then route',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockClassifyThenRouteWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '0cbd329a-c0fa-42f0-a594-7e0bafe377d6',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -480],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · Classify, then route
Has a model put a message into one of a fixed set of labels and routes on it, with a default route for anything unexpected.

**Needs:** LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/ai\``,
    };

    @node({
        id: '55e34645-22f0-419b-aaae-bf4cd106cc60',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '7f5afb55-e7b6-4364-a31c-89186973d9b6',
        name: 'Classify',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Classify = {
        method: 'POST',
        url: '={{ $env.LLM_BASE_URL }}/chat/completions',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.LLM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ JSON.stringify({
  model: $env.LLM_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "[task:classify] Classify the message. Reply with JSON: { label: 'billing'|'technical'|'general' }." },
    { role: "user", content: $json.text }
  ]
}) }}`,
    };

    @node({
        id: '55b3c9c1-edd0-44bc-aabc-e42c6e07ab91',
        name: 'Read the label',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
    })
    ReadTheLabel = {
        jsCode: `let label = "general";
try { const l = JSON.parse($input.first().json.choices[0].message.content).label; if (["billing", "technical", "general"].includes(l)) label = l; } catch (e) {}
return [{ json: { ...$("When called").first().json, label } }];`,
    };

    @node({
        id: 'f8981aeb-fba8-4c36-a952-56bc2e49eca2',
        name: 'By label',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [720, 0],
    })
    ByLabel = {
        rules: {
            values: [
                {
                    conditions: {
                        options: {
                            caseSensitive: true,
                            leftValue: '',
                            typeValidation: 'loose',
                            version: 2,
                        },
                        conditions: [
                            {
                                id: '0e6105f4-b33e-46a8-aeb9-d4a1141be834',
                                leftValue: "={{ $json.label === 'billing' }}",
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
                    renameOutput: true,
                    outputKey: 'billing',
                },
                {
                    conditions: {
                        options: {
                            caseSensitive: true,
                            leftValue: '',
                            typeValidation: 'loose',
                            version: 2,
                        },
                        conditions: [
                            {
                                id: 'f20e3083-9257-483e-a433-4b8d6c3edb2b',
                                leftValue: "={{ $json.label === 'technical' }}",
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
                    renameOutput: true,
                    outputKey: 'technical',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '9449d4c0-015e-44f3-a69b-ec20bc010ba5',
        name: 'Billing',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [960, -180],
    })
    Billing = {
        assignments: {
            assignments: [
                {
                    id: '02f577c3-4721-4b84-a30b-907bea6a50e9',
                    name: 'queue',
                    value: "={{ 'billing' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'aeb0c474-4a07-40d3-ac1b-7ec6bce85c62',
        name: 'Technical',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [960, 0],
    })
    Technical = {
        assignments: {
            assignments: [
                {
                    id: '7bfd5522-444c-4a06-a50c-dd458770f153',
                    name: 'queue',
                    value: "={{ 'engineering' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '0ba726e6-de4d-4b0c-a784-4973ac803bf4',
        name: 'General',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [960, 180],
    })
    General = {
        assignments: {
            assignments: [
                {
                    id: '26e11ffd-8224-4f5d-a5c2-d87a0ccc8503',
                    name: 'queue',
                    value: "={{ 'support' }}",
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
        this.WhenCalled.out(0).to(this.Classify.in(0));
        this.Classify.out(0).to(this.ReadTheLabel.in(0));
        this.ReadTheLabel.out(0).to(this.ByLabel.in(0));
        this.ByLabel.out(0).to(this.Billing.in(0));
        this.ByLabel.out(1).to(this.Technical.in(0));
        this.ByLabel.out(2).to(this.General.in(0));
    }
}
