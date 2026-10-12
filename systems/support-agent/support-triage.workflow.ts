import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support agent · Ticket triage
// Nodes   : 13  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// TicketCreated                      webhook
// ReadTheTicket                      code
// Classify                           httpRequest                [onError→regular] [retry]
// ReadTheLabels                      code
// ByTopic                            switch
// CloseAsSpam                        httpRequest                [retry]
// SendToBilling                      httpRequest                [retry]
// SendToEngineering                  httpRequest                [retry]
// SendToGeneralQueue                 httpRequest                [retry]
// Urgent                             if
// PageMessage                        code
// PageOnCall                         executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TicketCreated
//    → ReadTheTicket
//      → Classify
//        → ReadTheLabels
//          → ByTopic
//            → CloseAsSpam
//           .out(1) → SendToBilling
//              → Urgent
//                → PageMessage
//                  → PageOnCall
//           .out(2) → SendToEngineering
//              → Urgent (↩ loop)
//           .out(3) → SendToGeneralQueue
//              → Urgent (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Support agent · Ticket triage',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SupportAgentTicketTriageWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '2f056257-b6b9-4a22-a17a-2179606663a5',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -570],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Support agent · Ticket triage
Labels each new ticket by topic and urgency, routes it to the right team, and pages someone only when it is urgent.

**Needs:** HELPDESK_API_KEY, HELPDESK_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/support-agent\``,
    };

    @node({
        id: '431a2f30-91a4-4b47-af24-a2f667ac1dfe',
        webhookId: 'aebb35ac-e5a4-4458-aff4-4d6b1373ff1f',
        name: 'Ticket created',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    TicketCreated = {
        httpMethod: 'POST',
        path: 'support-ticket',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: 'edb65851-2fa0-4626-a9c9-c9ee992b1f46',
        name: 'Read the ticket',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    ReadTheTicket = {
        jsCode: `const b = $input.first().json.body ?? {};
return [{ json: { ticket_id: String(b.id), subject: String(b.subject ?? ""), body: String(b.body ?? "").slice(0, 3000), from: b.from ?? null } }];`,
    };

    @node({
        id: '708e926a-f7d5-46df-a6ff-97df9a82e789',
        name: 'Classify',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
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
    { role: "system", content: "[task:classify] Classify a support ticket. Reply with JSON: { label: 'billing'|'technical'|'spam'|'general', urgent: boolean, sentiment: 'negative'|'neutral'|'positive' }." },
    { role: "user", content: $json.subject + '\\n\\n' + $json.body }
  ]
}) }}`,
    };

    @node({
        id: '7919cc74-98d4-4cc3-ac94-ddc39959eba0',
        name: 'Read the labels',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [720, 0],
    })
    ReadTheLabels = {
        jsCode: `const before = $("Read the ticket").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"label":"general","urgent":false,"sentiment":"neutral"};
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
        id: 'd638aa7d-b630-45a4-abc3-e66644b04cee',
        name: 'By topic',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [960, 0],
    })
    ByTopic = {
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
                                id: '29130356-0c00-4622-a1b3-dafe22b8ffea',
                                leftValue: "={{ $json.label === 'spam' }}",
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
                    outputKey: 'spam',
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
                                id: '26eaf4eb-6b00-4c02-aa1e-020dd518fb3d',
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
                                id: '986705cc-9c8c-463a-a493-20ff6b7d85c4',
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
        id: 'e32eef67-376a-47d5-ac3a-7959a64506b7',
        name: 'Close as spam',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, -270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CloseAsSpam = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/tickets/update',
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
        jsonBody: "={{ JSON.stringify({ ticket_id: $json.ticket_id, status: 'closed', labels: ['spam'] }) }}",
    };

    @node({
        id: '4fad6ab2-8b70-4ac5-a51f-cde4668d7d7e',
        name: 'Send to billing',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendToBilling = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/tickets/update',
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
            "={{ JSON.stringify({ ticket_id: $json.ticket_id, team: 'billing', labels: ['billing', $json.sentiment] }) }}",
    };

    @node({
        id: '3874c530-1c45-4bd7-ac01-e6be81aa78f5',
        name: 'Send to engineering',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendToEngineering = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/tickets/update',
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
            "={{ JSON.stringify({ ticket_id: $json.ticket_id, team: 'engineering', labels: ['technical', $json.sentiment] }) }}",
    };

    @node({
        id: '9d0d05e7-9aac-47e9-a2ca-8b2254b4ac26',
        name: 'Send to general queue',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendToGeneralQueue = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/tickets/update',
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
            "={{ JSON.stringify({ ticket_id: $json.ticket_id, team: 'support', labels: ['general', $json.sentiment], needs_review: $json.parse_error }) }}",
    };

    @node({
        id: 'c6dc00c3-876e-4539-afce-d063a9ba18e5',
        name: 'Urgent?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1440, 0],
    })
    Urgent = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'dc9ef982-ea50-4272-a239-1f980bb39d3a',
                    leftValue: "={{ $('Read the labels').first().json.urgent === true }}",
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
        id: '5b5ccbb9-2713-43fd-a196-1f71bd86a29c',
        name: 'Page message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1680, 0],
    })
    PageMessage = {
        jsCode: `const t = $("Read the labels").first().json;
return [{ json: { text: "Urgent " + t.label + " ticket #" + t.ticket_id + ": " + t.subject, level: "critical" } }];`,
    };

    @node({
        id: '8cac8dc5-3c3e-42f6-a07f-b8b45d049a2d',
        name: 'Page on-call',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1920, 0],
    })
    PageOnCall = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TicketCreated.out(0).to(this.ReadTheTicket.in(0));
        this.ReadTheTicket.out(0).to(this.Classify.in(0));
        this.Classify.out(0).to(this.ReadTheLabels.in(0));
        this.ReadTheLabels.out(0).to(this.ByTopic.in(0));
        this.ByTopic.out(0).to(this.CloseAsSpam.in(0));
        this.ByTopic.out(1).to(this.SendToBilling.in(0));
        this.ByTopic.out(2).to(this.SendToEngineering.in(0));
        this.ByTopic.out(3).to(this.SendToGeneralQueue.in(0));
        this.SendToBilling.out(0).to(this.Urgent.in(0));
        this.SendToEngineering.out(0).to(this.Urgent.in(0));
        this.SendToGeneralQueue.out(0).to(this.Urgent.in(0));
        this.Urgent.out(0).to(this.PageMessage.in(0));
        this.PageMessage.out(0).to(this.PageOnCall.in(0));
    }
}
