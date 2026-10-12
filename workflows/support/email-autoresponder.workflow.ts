import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support · Inbox triage and first reply
// Nodes   : 11  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// EmailReceived                      webhook
// ReadTheEmail                       code
// FromAPerson                        if
// ArchiveIt                          httpRequest                [retry]
// WhatIsItAsking                     httpRequest                [onError→regular] [retry]
// ReadTheIntent                      code
// AFixedAnswerQuestion               if
// SendTheStandardReply               httpRequest                [retry]
// LabelAsAnswered                    httpRequest                [retry]
// LeaveForAPerson                    httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// EmailReceived
//    → ReadTheEmail
//      → FromAPerson
//        → WhatIsItAsking
//          → ReadTheIntent
//            → AFixedAnswerQuestion
//              → SendTheStandardReply
//                → LabelAsAnswered
//             .out(1) → LeaveForAPerson
//       .out(1) → ArchiveIt
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Support · Inbox triage and first reply',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SupportInboxTriageAndFirstReplyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '39f6a91a-0e41-485a-a8f0-540fb093d5c7',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Support · Inbox triage and first reply
Sorts the shared inbox: answers the handful of questions that have a fixed answer, files newsletters and receipts, and leaves everything else for a person.

**Needs:** EMAIL_API_KEY, EMAIL_BASE_URL, HELPDESK_API_KEY, HELPDESK_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/support\``,
    };

    @node({
        id: '3f7b9eab-f73c-4bae-a39a-5fb5bb509649',
        webhookId: 'a973a74e-8779-4a7d-a978-d37891cf2e2b',
        name: 'Email received',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    EmailReceived = {
        httpMethod: 'POST',
        path: 'email-received',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '3fffe216-4bbc-4ff0-ab69-6419df3bf306',
        name: 'Read the email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    ReadTheEmail = {
        jsCode: `const m = $input.first().json.body ?? {};
const from = String(m.from ?? "").toLowerCase();
const auto = /no-?reply|mailer-daemon|notifications?@|newsletter/.test(from) || !!m.headers?.["auto-submitted"] || !!m.headers?.["list-unsubscribe"];
return [{ json: { id: String(m.id), from, subject: String(m.subject ?? ""), text: String(m.text ?? "").slice(0, 3000), auto } }];`,
    };

    @node({
        id: '881bc208-f9ee-4cd0-ae33-179c2b3f916c',
        name: 'From a person?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [480, 0],
    })
    FromAPerson = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd04ba8d9-2748-4dd8-aa5a-affb78d49ee8',
                    leftValue: '={{ !$json.auto }}',
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
        id: '95e0eb93-a0f2-4785-a029-af48ba64748d',
        name: 'Archive it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ArchiveIt = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/messages/archive',
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
        jsonBody: "={{ JSON.stringify({ id: $json.id, label: 'automated' }) }}",
    };

    @node({
        id: 'f16bc1e7-80cf-4fd6-a52f-2c1331b1a456',
        name: 'What is it asking?',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WhatIsItAsking = {
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
    { role: "system", content: "[task:classify-intent] Classify this email. Reply with JSON: { intent: 'opening_hours'|'pricing'|'reset_password'|'other', confident: boolean }. Use 'other' unless the email is plainly and only asking that one thing." },
    { role: "user", content: $json.subject + '\\n\\n' + $json.text }
  ]
}) }}`,
    };

    @node({
        id: '76dd5537-8f50-436d-afee-cb0960475ee5',
        name: 'Read the intent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [960, 0],
    })
    ReadTheIntent = {
        jsCode: `const before = $("From a person?").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"intent":"other","confident":false};
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
        id: '0dbffd99-c923-4469-a808-a283219c1739',
        name: 'A fixed-answer question?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1200, 0],
    })
    AFixedAnswerQuestion = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6bc90c78-4bd2-483e-a808-fa7d208ed0b7',
                    leftValue:
                        "={{ $json.confident === true && ['opening_hours', 'pricing', 'reset_password'].includes($json.intent) }}",
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
        id: 'cb18c537-3f8a-4656-adde-32ca7e1ea845',
        name: 'Send the standard reply',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheStandardReply = {
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
            "={{ JSON.stringify({ to: $json.from, subject: 'Re: ' + $json.subject, template: 'faq-' + $json.intent, in_reply_to: $json.id }) }}",
    };

    @node({
        id: '61936198-2dd8-47cb-aa85-04c3879a8f47',
        name: 'Label as answered',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1680, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LabelAsAnswered = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/messages/label',
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
            "={{ JSON.stringify({ id: $('A fixed-answer question?').first().json.id, label: 'auto-answered' }) }}",
    };

    @node({
        id: 'd2ffd372-0eb1-4b45-aae4-858e0bf68533',
        name: 'Leave for a person',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LeaveForAPerson = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/tickets',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.HELPDESK_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ subject: $json.subject, from: $json.from, body: $json.text, source: 'email' }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.EmailReceived.out(0).to(this.ReadTheEmail.in(0));
        this.ReadTheEmail.out(0).to(this.FromAPerson.in(0));
        this.FromAPerson.out(0).to(this.WhatIsItAsking.in(0));
        this.FromAPerson.out(1).to(this.ArchiveIt.in(0));
        this.WhatIsItAsking.out(0).to(this.ReadTheIntent.in(0));
        this.ReadTheIntent.out(0).to(this.AFixedAnswerQuestion.in(0));
        this.AFixedAnswerQuestion.out(0).to(this.SendTheStandardReply.in(0));
        this.AFixedAnswerQuestion.out(1).to(this.LeaveForAPerson.in(0));
        this.SendTheStandardReply.out(0).to(this.LabelAsAnswered.in(0));
    }
}
