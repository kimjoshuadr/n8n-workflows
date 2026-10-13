import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Lead intake · Capture and qualify
// Nodes   : 22  |  Connections: 20
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
// ScoreTheFit                        httpRequest                [onError→regular] [retry]
// ReadTheVerdict                     code
// SaveTheLead                        httpRequest                [retry]
// WhichPath                          switch
// CreateCrmContact                   httpRequest                [onError→out(1)] [retry]
// SendBookingLink                    httpRequest                [retry]
// TellSales                          executeWorkflow
// ParkForReplay                      executeWorkflow
// SendNurtureEmail                   httpRequest                [retry]
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

**Platforms:** none, this is logic only
**Settings:** CRM_API_KEY, CRM_BASE_URL, DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/lead-intake\``,
    };

    @node({
        id: '127eeb0a-9aa4-4821-a24a-80655ccff3a8',
        webhookId: '5f08c07c-aaaf-48ae-abb5-df5afa14171f',
        name: 'Enquiry form',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 270],
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
        position: [260, 270],
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
        position: [520, 270],
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
        position: [780, 180],
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
        position: [780, 360],
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
        position: [1040, 270],
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
        position: [1300, 270],
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
        position: [1560, 180],
    })
    IgnoreTheRepeat = {};

    @node({
        id: 'cc820227-ebdb-4dbc-a4cf-ef476f8846d5',
        name: 'Score the fit',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 360],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScoreTheFit = {
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
    { role: "system", content: "[task:qualify-lead] You qualify inbound enquiries for a services business. Reply with JSON: { score: 0-100, fit: boolean, reason: string, missing: string[] }. Judge only what the message says." },
    { role: "user", content: 'From: ' + $json.name + ($json.company ? ' at ' + $json.company : '') + '\\n\\n' + $json.message }
  ]
}) }}`,
    };

    @node({
        id: 'f70ba5b3-c2fa-4477-a6df-1e4807e155a8',
        name: 'Read the verdict',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 270],
    })
    ReadTheVerdict = {
        jsCode: `const before = $("New enquiry?").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"score":null,"fit":null,"reason":"Model reply could not be read"};
  let parse_error = false;
  try {
    reply = JSON.parse(item.json.choices[0].message.content);
  } catch (e) {
    parse_error = true;
  }
  out.push({ json: { ...(before[i]?.json ?? {}), ...reply, parse_error } });
}
return out;`,
    };

    @node({
        id: '1fd176ed-891d-42d2-a506-e7f5fafff42a',
        name: 'Save the lead',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2080, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheLead = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/leads',
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
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ email: $json.email, name: $json.name, company: $json.company, message: $json.message, source: $json.source, score: $json.score, fit: $json.fit, reason: $json.reason, status: $json.fit === true ? 'qualified' : $json.fit === false ? 'nurture' : 'review', follow_ups: 0, booked: false, received_at: $json.received_at }) }}",
    };

    @node({
        id: '96387c07-809f-4736-ab50-800416ac1815',
        name: 'Which path?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [2340, 270],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2600, 90],
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateCrmContact = {
        method: 'POST',
        url: '={{ $env.CRM_BASE_URL }}/crm/v3/objects/contacts',
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
        jsonBody:
            "={{ JSON.stringify({ properties: { email: $('Read the verdict').first().json.email, firstname: $('Read the verdict').first().json.name, company: $('Read the verdict').first().json.company, lead_score: $('Read the verdict').first().json.score, lifecyclestage: 'salesqualifiedlead' } }) }}",
    };

    @node({
        id: '5860cb02-4698-49cf-a6d1-8e9d7882a9c5',
        name: 'Send booking link',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2860, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendBookingLink = {
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
        jsonBody:
            "={{ JSON.stringify({ to: $('Read the verdict').first().json.email, subject: 'Thanks, ' + $('Read the verdict').first().json.name + '. Pick a time', template: 'booking-link', data: { name: $('Read the verdict').first().json.name } }) }}",
    };

    @node({
        id: '609f23f9-3710-4f7e-a58a-80b926d98383',
        name: 'Tell sales',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3380, 270],
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
        position: [3120, 180],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2600, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendNurtureEmail = {
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
        jsonBody:
            "={{ JSON.stringify({ to: $('Read the verdict').first().json.email, subject: 'Thanks for getting in touch', template: 'nurture-1', data: { name: $('Read the verdict').first().json.name, missing: $('Read the verdict').first().json.missing } }) }}",
    };

    @node({
        id: '82b17333-2b87-4b3a-a6ed-71285d9719ec',
        name: 'Ask a person to look',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2860, 270],
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
        position: [3120, 360],
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
        position: [2600, 450],
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
        position: [2860, 450],
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
    }
}
