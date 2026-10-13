import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support agent · Answer or hand over
// Nodes   : 17  |  Connections: 16
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// MessageReceived                    webhook
// ReadTheMessage                     code
// SeenBefore                         executeWorkflow
// NewMessage                         if
// SearchTheHelpCentre                httpRequest                [onError→regular] [retry]
// BuildTheContext                    code
// DraftAnAnswer                      httpRequest                [onError→regular] [retry]
// ReadTheDraft                       code
// Confident                          if
// SendTheReply                       httpRequest                [retry]
// HandToAPerson                      httpRequest                [retry]
// LeaveAPrivateNote                  httpRequest                [retry]
// Answered                           code
// HandedOver                         code
// LogTheOutcome                      httpRequest                [retry]
// IgnoreTheRepeat                    noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// MessageReceived
//    → ReadTheMessage
//      → SeenBefore
//        → NewMessage
//          → SearchTheHelpCentre
//            → BuildTheContext
//              → DraftAnAnswer
//                → ReadTheDraft
//                  → Confident
//                    → SendTheReply
//                      → Answered
//                        → LogTheOutcome
//                   .out(1) → HandToAPerson
//                      → LeaveAPrivateNote
//                        → HandedOver
//                          → LogTheOutcome (↩ loop)
//         .out(1) → IgnoreTheRepeat
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Support agent · Answer or hand over',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SupportAgentAnswerOrHandOverWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '6bbc5ad0-786c-4b5d-a7c3-142e5ef897f8',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Support agent · Answer or hand over
Answers a customer's message from the help centre when it is confident, and hands the conversation to a person with a summary when it is not.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, HELPDESK_API_KEY, HELPDESK_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/support-agent\``,
    };

    @node({
        id: '2866a047-ee8e-4164-a73d-5a2df239ffd8',
        webhookId: '6bfbeacb-4ae7-4ca9-a61f-927a4aef03c8',
        name: 'Message received',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    MessageReceived = {
        httpMethod: 'POST',
        path: 'support-message',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '53043ff1-cc25-4195-a7bd-f4443123d123',
        name: 'Read the message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheMessage = {
        jsCode: `const b = $input.first().json.body ?? {};
if (b.message_type && b.message_type !== "incoming") return []; // our own replies come back as events too
const text = String(b.content ?? "").trim();
if (!text) return [];
return [{ json: {
  conversation_id: String(b.conversation?.id ?? b.conversation_id),
  message_id: String(b.id),
  text: text.slice(0, 3000),
  customer: b.sender?.name ?? "Customer",
  scope: "support-message", key: String(b.id),
} }];`,
    };

    @node({
        id: '11edd7ca-6ce2-4811-ada1-025b1f916dca',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [520, 180],
    })
    SeenBefore = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: '6f23a2e7-bd5c-42da-a3ea-ecd4ded58340',
        name: 'New message?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
    })
    NewMessage = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '67a08949-441c-4ed4-a0f2-6c737b42a6b2',
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
        id: 'be624172-ccd3-40c6-a800-ca44ad17aa6d',
        name: 'Search the help centre',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SearchTheHelpCentre = {
        method: 'GET',
        url: '={{ $env.HELPDESK_BASE_URL }}/help_center/search',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'query',
                    value: '={{ $json.text.slice(0, 200) }}',
                },
            ],
        },
    };

    @node({
        id: '9ec4b164-2fba-4715-a0ee-2743a711c90b',
        name: 'Build the context',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 180],
    })
    BuildTheContext = {
        jsCode: `const m = $("New message?").first().json;
const articles = ($input.first().json.articles ?? []).slice(0, 4);
const context = articles.map((a) => "[" + a.id + "] " + a.title + "\\n" + String(a.body ?? "").slice(0, 800)).join("\\n\\n");
return [{ json: { ...m, context, article_count: articles.length } }];`,
    };

    @node({
        id: '3bdcdff0-8678-4faf-a927-6d613b3b7d07',
        name: 'Draft an answer',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 180],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DraftAnAnswer = {
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
    { role: "system", content: "[task:support-answer] You are a support agent. Answer ONLY from the articles given. Reply with JSON: { answer: string, confidence: 0-1, sources: string[], handover: boolean }. Set handover true if the articles do not cover it, or the customer is upset, asks for a person, or mentions a refund dispute or legal action." },
    { role: "user", content: 'Articles:\\n' + ($json.context || '(none found)') + '\\n\\nCustomer: ' + $json.text }
  ]
}) }}`,
    };

    @node({
        id: '91d3c3d0-81be-4926-ab29-e4299b684f3a',
        name: 'Read the draft',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 180],
    })
    ReadTheDraft = {
        jsCode: `const before = $("Build the context").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"answer":"","confidence":0,"sources":[],"handover":true};
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
        id: '43f21659-c8e9-4ed8-ab1a-870a3d0ae3b3',
        name: 'Confident?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2080, 180],
    })
    Confident = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'dd5f83b6-c825-4ba6-ad57-4a3d619fa343',
                    leftValue:
                        '={{ !$json.handover && !$json.parse_error && $json.confidence >= 0.7 && $json.answer.length > 0 }}',
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
        id: '9ccdc297-a8dd-48e6-a5d2-c60dd0989f3d',
        name: 'Send the reply',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2340, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheReply = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/conversations/reply',
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
            "={{ JSON.stringify({ conversation_id: $json.conversation_id, content: $json.answer, message_type: 'outgoing' }) }}",
    };

    @node({
        id: '918faca5-5af7-4ad9-a2a8-4c255f277d58',
        name: 'Hand to a person',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2340, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    HandToAPerson = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/conversations/assign',
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
        jsonBody: "={{ JSON.stringify({ conversation_id: $json.conversation_id, team: 'support', status: 'open' }) }}",
    };

    @node({
        id: '7c9e8b18-90b2-4eac-ad7d-f98e55fcc001',
        name: 'Leave a private note',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2600, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LeaveAPrivateNote = {
        method: 'POST',
        url: '={{ $env.HELPDESK_BASE_URL }}/conversations/note',
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
            "={{ JSON.stringify({ conversation_id: $('Confident?').first().json.conversation_id, private: true, content: 'Handed over by the agent. Customer asked: ' + $('Confident?').first().json.text.slice(0, 300) + ' | Confidence: ' + $('Confident?').first().json.confidence + ' | Articles found: ' + $('Confident?').first().json.article_count }) }}",
    };

    @node({
        id: '30859699-0b3e-43dd-a525-a15af3d19e12',
        name: 'Answered',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2600, 270],
    })
    Answered = {
        jsCode: 'return [{ json: { ...$("Confident?").first().json, answered: true } }];',
    };

    @node({
        id: 'c26550dd-767a-4717-ae7d-b941ad48764d',
        name: 'Handed over',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2860, 180],
    })
    HandedOver = {
        jsCode: 'return [{ json: { ...$("Confident?").first().json, answered: false } }];',
    };

    @node({
        id: '9f550e86-6788-4672-a59a-ec64d075bf8a',
        name: 'Log the outcome',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [3120, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheOutcome = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/support_log',
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
            '={{ JSON.stringify({ conversation_id: $json.conversation_id, question: $json.text, answered: $json.answered, confidence: $json.confidence, sources: $json.sources, at: $now.toISO() }) }}',
    };

    @node({
        id: '99ecfdd6-aa4a-41c8-ab05-309ae9fc7f5f',
        name: 'Ignore the repeat',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 270],
    })
    IgnoreTheRepeat = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.MessageReceived.out(0).to(this.ReadTheMessage.in(0));
        this.ReadTheMessage.out(0).to(this.SeenBefore.in(0));
        this.SeenBefore.out(0).to(this.NewMessage.in(0));
        this.NewMessage.out(0).to(this.SearchTheHelpCentre.in(0));
        this.NewMessage.out(1).to(this.IgnoreTheRepeat.in(0));
        this.SearchTheHelpCentre.out(0).to(this.BuildTheContext.in(0));
        this.BuildTheContext.out(0).to(this.DraftAnAnswer.in(0));
        this.DraftAnAnswer.out(0).to(this.ReadTheDraft.in(0));
        this.ReadTheDraft.out(0).to(this.Confident.in(0));
        this.Confident.out(0).to(this.SendTheReply.in(0));
        this.Confident.out(1).to(this.HandToAPerson.in(0));
        this.SendTheReply.out(0).to(this.Answered.in(0));
        this.Answered.out(0).to(this.LogTheOutcome.in(0));
        this.HandToAPerson.out(0).to(this.LeaveAPrivateNote.in(0));
        this.LeaveAPrivateNote.out(0).to(this.HandedOver.in(0));
        this.HandedOver.out(0).to(this.LogTheOutcome.in(0));
    }
}
