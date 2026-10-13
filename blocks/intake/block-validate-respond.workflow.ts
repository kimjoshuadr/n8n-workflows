import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Validate and answer with field errors
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Submitted                          webhook
// CheckTheFields                     code
// Valid                              if
// Accepted                           respondToWebhook
// FieldErrors                        respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Submitted
//    → CheckTheFields
//      → Valid
//        → Accepted
//       .out(1) → FieldErrors
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Validate and answer with field errors',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockValidateAndAnswerWithFieldErrorsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b052e856-0c08-4e89-afbc-cfc69872af79',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Validate and answer with field errors
Checks a payload against simple rules and answers with exactly which fields were wrong, so the form can show it.

**Platforms:** none, this is logic only
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/intake\``,
    };

    @node({
        id: 'a22a6b5c-3fa2-4b9b-a448-d581475e0233',
        webhookId: 'afb4a648-5bf0-40dc-a0df-90259b086281',
        name: 'Submitted',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    Submitted = {
        httpMethod: 'POST',
        path: 'block-validate',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'c548a1ea-6522-400e-a1fd-010b91401e49',
        name: 'Check the fields',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    CheckTheFields = {
        jsCode: `const v = $input.first().json.body ?? {};
const errors = {};
if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(String(v.email ?? ""))) errors.email = "Enter a valid email address";
if (String(v.name ?? "").trim().length < 2) errors.name = "Enter your name";
if (v.phone && !/^\\+?[0-9 ()-]{7,20}$/.test(String(v.phone))) errors.phone = "Enter a valid phone number";
return [{ json: { valid: Object.keys(errors).length === 0, errors } }];`,
    };

    @node({
        id: '7b856a40-290d-4ae8-a098-0511a8a5c6e7',
        name: 'Valid?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
    })
    Valid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '8ba548b6-353c-474e-a581-189fba03a955',
                    leftValue: '={{ $json.valid }}',
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
        id: '109b75e3-637b-45e5-a075-b00913761e78',
        name: 'Accepted',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 90],
    })
    Accepted = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'cca6c7be-894e-4b91-ad0e-104610355658',
        name: 'Field errors',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 270],
    })
    FieldErrors = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: false, errors: $json.errors }) }}',
        options: {
            responseCode: 422,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Submitted.out(0).to(this.CheckTheFields.in(0));
        this.CheckTheFields.out(0).to(this.Valid.in(0));
        this.Valid.out(0).to(this.Accepted.in(0));
        this.Valid.out(1).to(this.FieldErrors.in(0));
    }
}
