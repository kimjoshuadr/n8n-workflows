import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · A model reply you can rely on
// Nodes   : 8  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Ask                                httpRequest                [onError→regular] [retry]
// CheckTheReply                      code
// Good                               if
// TryOnceMore                        if
// Usable                             set
// NotUsable                          set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Ask
//      → CheckTheReply
//        → Good
//          → Usable
//         .out(1) → TryOnceMore
//            → Ask (↩ loop)
//           .out(1) → NotUsable
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · A model reply you can rely on',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockAModelReplyYouCanRelyOnWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '44c2965c-9665-4431-a5a6-fb8153c9e658',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Block · A model reply you can rely on
Asks a model for JSON, checks the reply has the fields you need, asks once more if it does not, and then gives up honestly.

**Needs:** LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/ai\``,
    };

    @node({
        id: '94360127-1344-4382-a350-ab007574aaa7',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '2f1630bb-4649-4948-a2c3-dd5716b04e48',
        name: 'Ask',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Ask = {
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
    { role: "system", content: "[task:guarded] Reply with JSON only." },
    { role: "user", content: $json.prompt }
  ]
}) }}`,
    };

    @node({
        id: '60c14cb6-e19d-4c53-a456-15c40ad60e0c',
        name: 'Check the reply',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
    })
    CheckTheReply = {
        jsCode: `const req = $("When called").first().json;
const required = req.required ?? [];
let data = null;
try { data = JSON.parse($input.first().json.choices[0].message.content); } catch (e) {}
const missing = data ? required.filter((k) => data[k] === undefined || data[k] === null) : required;
return [{ json: { ok: !!data && missing.length === 0, data, missing, attempt: $runIndex + 1, prompt: req.prompt + (missing.length ? "\\n\\nYour last reply was missing: " + missing.join(", ") + ". Reply again with every field." : "") } }];`,
    };

    @node({
        id: '62ce4d4d-8ea1-4996-a96b-a19629d4a546',
        name: 'Good?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 0],
    })
    Good = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'e092e299-e336-436f-a7dd-b43e67067361',
                    leftValue: '={{ $json.ok }}',
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
        id: '8333bf41-bb7b-45b8-aabe-d66f039585f0',
        name: 'Try once more?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [960, -90],
    })
    TryOnceMore = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'bc271eb5-a405-4f47-a679-a08f587bf585',
                    leftValue: '={{ $json.attempt < 2 }}',
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
        id: '035b0b71-4f54-4c1e-a0be-3f2ccaf019af',
        name: 'Usable',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [960, 90],
    })
    Usable = {
        assignments: {
            assignments: [
                {
                    id: 'f55d58f0-3ee2-401c-afcc-b765c4ef6e5e',
                    name: 'ok',
                    value: '={{ true }}',
                    type: 'string',
                },
                {
                    id: 'da4a1e9a-d0e9-4e5a-a3fe-febc9e354a5b',
                    name: 'data',
                    value: '={{ JSON.stringify($json.data) }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '50a2db02-a98f-4aaa-accc-fd3d8cbf1604',
        name: 'Not usable',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1200, 0],
    })
    NotUsable = {
        assignments: {
            assignments: [
                {
                    id: '77d6faa5-71cc-41e1-a872-9da266a1c562',
                    name: 'ok',
                    value: '={{ false }}',
                    type: 'string',
                },
                {
                    id: '7cc3c94a-5b0d-4923-afaa-d6d1b947356f',
                    name: 'missing',
                    value: "={{ $json.missing.join(',') }}",
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
        this.WhenCalled.out(0).to(this.Ask.in(0));
        this.Ask.out(0).to(this.CheckTheReply.in(0));
        this.CheckTheReply.out(0).to(this.Good.in(0));
        this.Good.out(0).to(this.Usable.in(0));
        this.Good.out(1).to(this.TryOnceMore.in(0));
        this.TryOnceMore.out(0).to(this.Ask.in(0));
        this.TryOnceMore.out(1).to(this.NotUsable.in(0));
    }
}
