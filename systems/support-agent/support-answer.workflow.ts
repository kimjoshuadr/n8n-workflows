import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support agent · Answer or hand over
// Nodes   : 19  |  Connections: 16
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// MessageReceived                    webhook
// ReadTheMessage                     code
// SeenBefore                         executeWorkflow
// NewMessage                         if
// SearchTheHelpCentre                httpRequest                [onError→regular] [creds] [retry]
// BuildTheContext                    code
// DraftAnAnswer                      agent                      [AI] [onError→regular]
// DraftAnAnswerGpt                   lmChatOpenAi               [creds] [ai_languageModel]
// DraftAnAnswerShape                 outputParserStructured     [ai_outputParser]
// ReadTheDraft                       code
// Confident                          if
// SendTheReply                       zendesk                    [creds] [retry]
// HandToAPerson                      zendesk                    [creds] [retry]
// LeaveAPrivateNote                  zendesk                    [creds] [retry]
// Answered                           code
// HandedOver                         code
// LogTheOutcome                      supabase                   [creds] [retry]
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
//
// AI CONNECTIONS
// DraftAnAnswer.uses({ ai_languageModel: DraftAnAnswerGpt, ai_outputParser: DraftAnAnswerShape })
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

**Platforms:** Zendesk, OpenAI, Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/support-agent\``,
    };

    @node({
        id: '2866a047-ee8e-4164-a73d-5a2df239ffd8',
        webhookId: '6bfbeacb-4ae7-4ca9-a61f-927a4aef03c8',
        name: 'Message received',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 220],
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
        position: [260, 220],
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
        position: [520, 220],
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
        position: [780, 220],
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
        position: [1040, 130],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SearchTheHelpCentre = {
        method: 'GET',
        url: "={{ 'https://acme.zendesk.com/api/v2/help_center/articles/search.json' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'zendeskApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'query',
                    value: '={{ $json.text.slice(0, 200) }}',
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '9ec4b164-2fba-4715-a0ee-2743a711c90b',
        name: 'Build the context',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 220],
    })
    BuildTheContext = {
        jsCode: `const m = $("New message?").first().json;
const articles = ($input.first().json.results ?? []).slice(0, 4);
const context = articles.map((a) => "[" + a.id + "] " + a.title + "\\n" + String(a.body ?? "").slice(0, 800)).join("\\n\\n");
return [{ json: { ...m, context, article_count: articles.length } }];`,
    };

    @node({
        id: '3bdcdff0-8678-4faf-a927-6d613b3b7d07',
        name: 'Draft an answer',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1660, 90],
        onError: 'continueRegularOutput',
    })
    DraftAnAnswer = {
        promptType: 'define',
        text: "={{ 'Articles:\\n' + ($json.context || '(none found)') + '\\n\\nCustomer: ' + $json.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                '[task:support-answer] You are a support agent. Answer ONLY from the articles given. Reply with JSON: { answer: string, confidence: 0-1, sources: string[], handover: boolean }. Set handover true if the articles do not cover it, or the customer is upset, asks for a person, or mentions a refund dispute or legal action.',
            maxIterations: 2,
        },
    };

    @node({
        id: '9698fe4b-2c62-4d7e-a1e8-73ae38fdad99',
        name: 'Draft an answer · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1560, 310],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    DraftAnAnswerGpt = {
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
        id: '78e25e75-6be2-4598-a76f-3587e7be77be',
        name: 'Draft an answer · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1760, 310],
    })
    DraftAnAnswerShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "answer": "The answer.",
  "confidence": 0.9,
  "sources": [
    "kb-12"
  ],
  "handover": false
}`,
    };

    @node({
        id: '91d3c3d0-81be-4926-ab29-e4299b684f3a',
        name: 'Read the draft',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2020, 220],
    })
    ReadTheDraft = {
        jsCode: `const before = $("Build the context").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : {"answer":"","confidence":0,"sources":[],"handover":true}), parse_error: !ok } });
}
return out;`,
    };

    @node({
        id: '43f21659-c8e9-4ed8-ab1a-870a3d0ae3b3',
        name: 'Confident?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2280, 220],
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
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [2540, 130],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheReply = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.conversation_id }}',
        updateFields: {
            status: "={{ 'pending' }}",
            publicReply: '={{ $json.answer }}',
            tags: ['ai-answered'],
        },
    };

    @node({
        id: '918faca5-5af7-4ad9-a2a8-4c255f277d58',
        name: 'Hand to a person',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [2540, 310],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    HandToAPerson = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.conversation_id }}',
        updateFields: {
            status: "={{ 'open' }}",
            tags: ['needs-human'],
        },
    };

    @node({
        id: '7c9e8b18-90b2-4eac-ad7d-f98e55fcc001',
        name: 'Leave a private note',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [2800, 130],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LeaveAPrivateNote = {
        resource: 'ticket',
        operation: 'update',
        id: "={{ $('Confident?').first().json.conversation_id }}",
        updateFields: {
            internalNote:
                "={{ 'Handed over by the agent. Customer asked: ' + $('Confident?').first().json.text.slice(0, 300) + ' | Confidence: ' + $('Confident?').first().json.confidence + ' | Articles found: ' + $('Confident?').first().json.article_count }}",
        },
    };

    @node({
        id: '30859699-0b3e-43dd-a525-a15af3d19e12',
        name: 'Answered',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2800, 310],
    })
    Answered = {
        jsCode: 'return [{ json: { ...$("Confident?").first().json, answered: true } }];',
    };

    @node({
        id: 'c26550dd-767a-4717-ae7d-b941ad48764d',
        name: 'Handed over',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3060, 220],
    })
    HandedOver = {
        jsCode: 'return [{ json: { ...$("Confident?").first().json, answered: false } }];',
    };

    @node({
        id: '9f550e86-6788-4672-a59a-ec64d075bf8a',
        name: 'Log the outcome',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [3320, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheOutcome = {
        resource: 'row',
        operation: 'create',
        tableId: 'support_log',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'conversation_id',
                    fieldValue: '={{ $json.conversation_id }}',
                },
                {
                    fieldId: 'question',
                    fieldValue: '={{ $json.text }}',
                },
                {
                    fieldId: 'answered',
                    fieldValue: '={{ $json.answered }}',
                },
                {
                    fieldId: 'confidence',
                    fieldValue: '={{ $json.confidence }}',
                },
                {
                    fieldId: 'sources',
                    fieldValue: '={{ $json.sources }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '99ecfdd6-aa4a-41c8-ab05-309ae9fc7f5f',
        name: 'Ignore the repeat',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 310],
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

        this.DraftAnAnswer.uses({
            ai_languageModel: this.DraftAnAnswerGpt.output,
            ai_outputParser: this.DraftAnAnswerShape.output,
        });
    }
}
