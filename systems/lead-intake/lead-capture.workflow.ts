import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Lead intake · Capture and qualify
// Nodes   : 24  |  Connections: 20
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// EnquiryForm                        webhook
// ValidateAndNormalise               code
// Valid                              if
// Reject                             respondToWebhook
// Accept                             respondToWebhook
// SeenToday                          executeWorkflow
// NewEnquiry                         if
// IgnoreTheRepeat                    noOp
// ScoreTheFit                        agent                      [AI] [onError→regular]
// ScoreTheFitGpt                     lmChatOpenAi               [creds] [ai_languageModel]
// ScoreTheFitShape                   outputParserStructured     [ai_outputParser]
// ReadTheVerdict                     code
// SaveTheLead                        supabase                   [creds] [retry]
// WhichPath                          switch
// CreateCrmContact                   hubspot                    [onError→out(1)] [creds] [retry]
// SendBookingLink                    sendGrid                   [creds] [retry]
// TellSales                          executeWorkflow
// ParkForReplay                      executeWorkflow
// SendNurtureEmail                   sendGrid                   [creds] [retry]
// AskAPersonToLook                   executeWorkflow
// SalesMessage                       code
// ReviewMessage                      code
// DeadLetterPayload                  code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// EnquiryForm
//    → ValidateAndNormalise
//      → Valid
//        → Accept
//          → SeenToday
//            → NewEnquiry
//              → ScoreTheFit
//                → ReadTheVerdict
//                  → SaveTheLead
//                    → WhichPath
//                      → CreateCrmContact
//                        → SendBookingLink
//                          → SalesMessage
//                            → TellSales
//                       .out(1) → DeadLetterPayload
//                          → ParkForReplay
//                     .out(1) → SendNurtureEmail
//                     .out(2) → ReviewMessage
//                        → AskAPersonToLook
//             .out(1) → IgnoreTheRepeat
//       .out(1) → Reject
//
// AI CONNECTIONS
// ScoreTheFit.uses({ ai_languageModel: ScoreTheFitGpt, ai_outputParser: ScoreTheFitShape })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Lead intake · Capture and qualify',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class LeadIntakeCaptureAndQualifyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '549c8d4c-ba23-4c76-addc-c83ea6c21eb5',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Lead intake · Capture and qualify
Takes an enquiry from any form, rejects junk, ignores repeats, has a model score the fit, then files it in the CRM and sends the right first reply.

**Platforms:** OpenAI, Supabase, HubSpot, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/lead-intake\``,
    };

    @node({
        id: '127eeb0a-9aa4-4821-a24a-80655ccff3a8',
        webhookId: '5f08c07c-aaaf-48ae-abb5-df5afa14171f',
        name: 'Enquiry form',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 310],
    })
    EnquiryForm = {
        httpMethod: 'POST',
        path: 'lead-intake',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'aa61cc86-3bf7-4447-abea-98977e1e3fbe',
        name: 'Validate and normalise',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 310],
    })
    ValidateAndNormalise = {
        jsCode: `const b = $input.first().json.body ?? {};
const email = String(b.email ?? "").trim().toLowerCase();
const message = String(b.message ?? "").trim();
const errors = [];
if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) errors.push("email");
if (message.length < 10) errors.push("message");
if (b.website) errors.push("honeypot"); // a field people never see and bots always fill
return [{ json: {
  valid: errors.length === 0, errors,
  email, message: message.slice(0, 4000),
  name: String(b.name ?? "").trim() || email.split("@")[0],
  company: String(b.company ?? "").trim() || null,
  source: String(b.source ?? "website"),
  received_at: new Date().toISOString(),
  scope: "lead", key: email + ":" + new Date().toISOString().slice(0, 10),
} }];`,
    };

    @node({
        id: '55e315b0-6a2d-4aee-aa71-2dfb2f7083a9',
        name: 'Valid?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 310],
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
        id: '8c1243a3-8901-49f3-a3bc-6e040c7d1793',
        name: 'Reject',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 220],
    })
    Reject = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: false, errors: $json.errors }) }}',
        options: {
            responseCode: 400,
        },
    };

    @node({
        id: 'f82c68bd-9675-41ea-a438-266d7b203bfc',
        name: 'Accept',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 400],
    })
    Accept = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: true }) }}',
        options: {
            responseCode: 202,
        },
    };

    @node({
        id: 'cb38c108-b6bb-41b0-a7c1-ca12827eb1f1',
        name: 'Seen today?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1040, 310],
    })
    SeenToday = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: '484090ee-2ad1-445d-a35b-fcf6f6c07145',
        name: 'New enquiry?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1300, 310],
    })
    NewEnquiry = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '288983a7-7f6c-402d-adc8-3a9d688acaba',
                    leftValue: '={{ !$json.duplicate }}',
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
        id: 'f9fcfca1-1a5e-4ffa-aae7-9b1ba6b96ec5',
        name: 'Ignore the repeat',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1660, 90],
    })
    IgnoreTheRepeat = {};

    @node({
        id: 'cc820227-ebdb-4dbc-a4cf-ef476f8846d5',
        name: 'Score the fit',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1660, 270],
        onError: 'continueRegularOutput',
    })
    ScoreTheFit = {
        promptType: 'define',
        text: "={{ 'From: ' + $json.name + ($json.company ? ' at ' + $json.company : '') + '\\n\\n' + $json.message }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                '[task:qualify-lead] You qualify inbound enquiries for a services business. Reply with JSON: { score: 0-100, fit: boolean, reason: string, missing: string[] }. Judge only what the message says.',
            maxIterations: 2,
        },
    };

    @node({
        id: 'a3c7396a-3504-4a78-a58e-f2404ff9a4e1',
        name: 'Score the fit · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1560, 490],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    ScoreTheFitGpt = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'gpt-4o-mini',
        },
        options: {
            temperature: 0,
        },
    };

    @node({
        id: 'ca4b0f2a-7e81-464d-a071-f0ad6805dc74',
        name: 'Score the fit · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1760, 490],
    })
    ScoreTheFitShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "score": 70,
  "fit": true,
  "reason": "Why, in one sentence.",
  "missing": [
    "budget"
  ]
}`,
    };

    @node({
        id: 'f70ba5b3-c2fa-4477-a6df-1e4807e155a8',
        name: 'Read the verdict',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2020, 310],
    })
    ReadTheVerdict = {
        jsCode: `const before = $("New enquiry?").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : {"score":null,"fit":null,"reason":"Model reply could not be read"}), parse_error: !ok } });
}
return out;`,
    };

    @node({
        id: '1fd176ed-891d-42d2-a506-e7f5fafff42a',
        name: 'Save the lead',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2280, 310],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheLead = {
        resource: 'row',
        operation: 'create',
        tableId: 'leads',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: '={{ $json.email }}',
                },
                {
                    fieldId: 'name',
                    fieldValue: '={{ $json.name }}',
                },
                {
                    fieldId: 'company',
                    fieldValue: '={{ $json.company }}',
                },
                {
                    fieldId: 'message',
                    fieldValue: '={{ $json.message }}',
                },
                {
                    fieldId: 'source',
                    fieldValue: '={{ $json.source }}',
                },
                {
                    fieldId: 'score',
                    fieldValue: '={{ $json.score }}',
                },
                {
                    fieldId: 'fit',
                    fieldValue: '={{ $json.fit }}',
                },
                {
                    fieldId: 'reason',
                    fieldValue: '={{ $json.reason }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ $json.fit === true ? 'qualified' : $json.fit === false ? 'nurture' : 'review' }}",
                },
                {
                    fieldId: 'follow_ups',
                    fieldValue: '={{ 0 }}',
                },
                {
                    fieldId: 'booked',
                    fieldValue: '={{ false }}',
                },
                {
                    fieldId: 'received_at',
                    fieldValue: '={{ $json.received_at }}',
                },
            ],
        },
    };

    @node({
        id: '96387c07-809f-4736-ab50-800416ac1815',
        name: 'Which path?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [2540, 310],
    })
    WhichPath = {
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
                                id: 'f31c1791-8e33-42a2-aaaf-628217d41dbf',
                                leftValue: "={{ $('Read the verdict').first().json.fit === true }}",
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
                    outputKey: 'qualified',
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
                                id: '83363f52-94f1-4c02-ae95-d300a8f99015',
                                leftValue: "={{ $('Read the verdict').first().json.fit === false }}",
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
                    outputKey: 'nurture',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: 'a1550c62-a3e9-4c64-a632-b5d902f9843d',
        name: 'Create CRM contact',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [2800, 130],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateCrmContact = {
        authentication: 'appToken',
        resource: 'contact',
        operation: 'upsert',
        email: "={{ $('Read the verdict').first().json.email }}",
        additionalFields: {
            firstName: "={{ $('Read the verdict').first().json.name }}",
            companyName: "={{ $('Read the verdict').first().json.company ?? '' }}",
            lifeCycleStage: "={{ 'salesqualifiedlead' }}",
        },
        options: {},
    };

    @node({
        id: '5860cb02-4698-49cf-a6d1-8e9d7882a9c5',
        name: 'Send booking link',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [3060, 130],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendBookingLink = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('Read the verdict').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-booking-link' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'name',
                    value: "={{ $('Read the verdict').first().json.name }}",
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: '609f23f9-3710-4f7e-a58a-80b926d98383',
        name: 'Tell sales',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3580, 310],
    })
    TellSales = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '663c54de-75b2-4efd-a828-c21ef7eb72ad',
        name: 'Park for replay',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3320, 220],
    })
    ParkForReplay = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:dead-letter__',
        },
        options: {},
    };

    @node({
        id: '7580ab32-bf68-492d-a401-ba882e17b120',
        name: 'Send nurture email',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [2800, 310],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendNurtureEmail = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('Read the verdict').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-nurture-1' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'name',
                    value: "={{ $('Read the verdict').first().json.name }}",
                },
                {
                    key: 'missing',
                    value: "={{ $('Read the verdict').first().json.missing }}",
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: '82b17333-2b87-4b3a-a6ed-71285d9719ec',
        name: 'Ask a person to look',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3060, 310],
    })
    AskAPersonToLook = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'e9629457-ca9d-4e21-a1be-87326bccf3ea',
        name: 'Sales message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3320, 400],
    })
    SalesMessage = {
        jsCode: `const l = $("Read the verdict").first().json;
return [{ json: { text: "New qualified lead: " + l.name + (l.company ? " (" + l.company + ")" : "") + ", score " + l.score + ". " + l.reason, level: "info" } }];`,
    };

    @node({
        id: 'e031261a-9abb-4162-ac2c-f04818bcb876',
        name: 'Review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2800, 490],
    })
    ReviewMessage = {
        jsCode: `const l = $("Read the verdict").first().json;
return [{ json: { text: "A lead needs a human look (" + l.email + "): " + l.reason, level: "warn" } }];`,
    };

    @node({
        id: 'a1de55a1-b747-41a0-a585-6af424e56e24',
        name: 'Dead letter payload',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3060, 490],
    })
    DeadLetterPayload = {
        jsCode: `const l = $("Read the verdict").first().json;
return [{ json: { source: "lead-capture", reason: "CRM contact could not be created", payload: l } }];`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.EnquiryForm.out(0).to(this.ValidateAndNormalise.in(0));
        this.ValidateAndNormalise.out(0).to(this.Valid.in(0));
        this.Valid.out(0).to(this.Accept.in(0));
        this.Valid.out(1).to(this.Reject.in(0));
        this.Accept.out(0).to(this.SeenToday.in(0));
        this.SeenToday.out(0).to(this.NewEnquiry.in(0));
        this.NewEnquiry.out(0).to(this.ScoreTheFit.in(0));
        this.NewEnquiry.out(1).to(this.IgnoreTheRepeat.in(0));
        this.ScoreTheFit.out(0).to(this.ReadTheVerdict.in(0));
        this.ReadTheVerdict.out(0).to(this.SaveTheLead.in(0));
        this.SaveTheLead.out(0).to(this.WhichPath.in(0));
        this.WhichPath.out(0).to(this.CreateCrmContact.in(0));
        this.WhichPath.out(1).to(this.SendNurtureEmail.in(0));
        this.WhichPath.out(2).to(this.ReviewMessage.in(0));
        this.CreateCrmContact.out(0).to(this.SendBookingLink.in(0));
        this.CreateCrmContact.out(1).to(this.DeadLetterPayload.in(0));
        this.SendBookingLink.out(0).to(this.SalesMessage.in(0));
        this.SalesMessage.out(0).to(this.TellSales.in(0));
        this.DeadLetterPayload.out(0).to(this.ParkForReplay.in(0));
        this.ReviewMessage.out(0).to(this.AskAPersonToLook.in(0));

        this.ScoreTheFit.uses({
            ai_languageModel: this.ScoreTheFitGpt.output,
            ai_outputParser: this.ScoreTheFitShape.output,
        });
    }
}
