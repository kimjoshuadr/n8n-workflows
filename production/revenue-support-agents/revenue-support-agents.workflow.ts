import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI agents · Revenue and support pipeline
// Nodes   : 54  |  Connections: 39
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionInboundRouteTheMessage      stickyNote
// SectionInboundAnswerFallBackOrHandOver stickyNote
// SectionOutboundResearch            stickyNote
// SectionOutboundFindThePersonWriteSend stickyNote
// OnMessageReceived                  webhook
// NormaliseMessage                   code
// RouterAgent                        agent                      [AI] [onError→regular]
// RouterParser                       outputParserStructured     [ai_outputParser]
// ReadRoute                          code
// SwitchIntent                       switch
// RagAgent                           agent                      [AI] [onError→regular]
// ConversationMemory                 memoryBufferWindow         [ai_memory]
// KnowledgeBase                      vectorStoreSupabase        [AI] [creds] [ai_tool]
// Embeddings                         embeddingsOpenAi           [creds] [ai_embedding]
// CrmLookup                          hubspotTool                [creds] [ai_tool]
// ReadAnswer                         code
// IfAnswered                         if
// FallbackAgent                      agent                      [AI] [onError→regular]
// ReadFallback                       code
// HumanEscalationAgent               agent                      [AI] [onError→regular]
// EscalationParser                   outputParserStructured     [ai_outputParser]
// ReadEscalation                     code
// CreateHandoverTask                 hubspot                    [creds] [retry]
// NotifyTeam                         slack                      [onError→regular] [creds] [retry]
// SetEscalationReply                 set
// LogConversation                    supabase                   [creds] [retry]
// RespondToCustomer                  respondToWebhook
// DailyProspecting                   scheduleTrigger
// GetIcp                             supabase                   [creds] [alwaysOutput] [retry]
// IfIcp                              if
// ResearchAgent                      agent                      [AI] [onError→regular]
// WebSearch                          toolSerpApi                [creds] [ai_tool]
// FetchPage                          httpRequestTool            [ai_tool]
// ResearchParser                     outputParserStructured     [ai_outputParser]
// ReadCompanies                      code
// ForEachCompany                     splitInBatches
// LeadGenAgent                       agent                      [AI] [onError→regular]
// FetchCompanyPage                   httpRequestTool            [ai_tool]
// CrmSearch                          hubspotTool                [creds] [ai_tool]
// LeadParser                         outputParserStructured     [ai_outputParser]
// CheckIcp                           code
// IfQualified                        if
// FindContact                        hubspot                    [creds] [alwaysOutput] [retry]
// IfNewLead                          if
// ColdOutreachAgent                  agent                      [AI] [onError→regular]
// OutreachParser                     outputParserStructured     [ai_outputParser]
// CheckEmail                         code
// IfSendable                         if
// SendOutreach                       gmail                      [creds] [retry]
// CreateLead                         hubspot                    [onError→regular] [creds] [retry]
// LogOutreach                        supabase                   [creds] [retry]
// OpenaiChatModel                    lmChatOpenAi               [creds] [ai_languageModel] [ai_languageModel] [ai_languageModel] [ai_languageModel]
// OpenaiChatModel1                   lmChatOpenAi               [creds] [ai_languageModel] [ai_languageModel] [ai_languageModel]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OnMessageReceived
//    → NormaliseMessage
//      → RouterAgent
//        → ReadRoute
//          → SwitchIntent
//            → RagAgent
//              → ReadAnswer
//                → IfAnswered
//                  → LogConversation
//                    → RespondToCustomer
//                 .out(1) → FallbackAgent
//                    → ReadFallback
//                      → LogConversation (↩ loop)
//           .out(1) → HumanEscalationAgent
//              → ReadEscalation
//                → CreateHandoverTask
//                  → NotifyTeam
//                    → SetEscalationReply
//                      → LogConversation (↩ loop)
//           .out(2) → FallbackAgent (↩ loop)
// DailyProspecting
//    → GetIcp
//      → IfIcp
//        → ResearchAgent
//          → ReadCompanies
//            → ForEachCompany
//             .out(1) → LeadGenAgent
//                → CheckIcp
//                  → IfQualified
//                    → FindContact
//                      → IfNewLead
//                        → ColdOutreachAgent
//                          → CheckEmail
//                            → IfSendable
//                              → SendOutreach
//                                → CreateLead
//                                  → LogOutreach
//                                    → ForEachCompany (↩ loop)
//                             .out(1) → ForEachCompany (↩ loop)
//                       .out(1) → ForEachCompany (↩ loop)
//                   .out(1) → ForEachCompany (↩ loop)
//
// AI CONNECTIONS
// RouterAgent.uses({ ai_outputParser: RouterParser, ai_languageModel: OpenaiChatModel })
// RagAgent.uses({ ai_memory: ConversationMemory, ai_tool: [KnowledgeBase, CrmLookup], ai_languageModel: OpenaiChatModel })
// KnowledgeBase.uses({ ai_embedding: Embeddings })
// FallbackAgent.uses({ ai_languageModel: OpenaiChatModel })
// HumanEscalationAgent.uses({ ai_outputParser: EscalationParser, ai_languageModel: OpenaiChatModel })
// ResearchAgent.uses({ ai_tool: [WebSearch, FetchPage], ai_outputParser: ResearchParser, ai_languageModel: OpenaiChatModel1 })
// LeadGenAgent.uses({ ai_tool: [FetchCompanyPage, CrmSearch], ai_outputParser: LeadParser, ai_languageModel: OpenaiChatModel1 })
// ColdOutreachAgent.uses({ ai_outputParser: OutreachParser, ai_languageModel: OpenaiChatModel1 })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'AI agents · Revenue and support pipeline',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class AiAgentsRevenueAndSupportPipelineWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '127f150c-81d0-4c3d-a28a-f5cb1dd147ac',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## AI agents · Revenue and support pipeline
Two tracks on one canvas. Inbound messages go to a router agent, which hands each one to a RAG agent that answers from the Supabase knowledge base and HubSpot, to a fallback agent, or to a human escalation agent that briefs a person. On weekdays, research and lead gen agents find people who fit the ideal customer profile, and a cold outreach agent writes to them and files them in the CRM.

**Platforms:** Supabase, OpenAI, HubSpot, Slack, SerpAPI, Gmail
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/revenue-support-agents\``,
    };

    @node({
        id: 'a06d93f0-18e1-4c13-af90-9d920e523e63',
        name: 'Section: Inbound: route the message',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionInboundRouteTheMessage = {
        width: 1620,
        height: 590,
        color: 4,
        content: `## 1. Inbound: route the message
A router agent names the intent. Code decides where it goes, and sends anything that reads like a dispute to a person.`,
    };

    @node({
        id: '05a65b43-a8b7-4fe9-a9b3-36e2de9f84af',
        name: 'Section: Inbound: answer, fall back or hand over',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 670],
    })
    SectionInboundAnswerFallBackOrHandOver = {
        width: 2540,
        height: 1210,
        color: 5,
        content: `## 2. Inbound: answer, fall back or hand over
The RAG agent answers from the knowledge base and the CRM. What it cannot answer goes to the fallback agent; what needs a person is briefed and raised.`,
    };

    @node({
        id: '41947925-c854-4151-a98e-f9cbac24acf1',
        name: 'Section: Outbound: research',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1960],
    })
    SectionOutboundResearch = {
        width: 2020,
        height: 590,
        color: 6,
        content: `## 3. Outbound: research
Weekdays. A research agent searches the web for companies that fit the profile stored in Supabase.`,
    };

    @node({
        id: '6972c10c-1b04-4ee1-ab06-bd3fb81940b7',
        name: 'Section: Outbound: find the person, write, send',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 2630],
    })
    SectionOutboundFindThePersonWriteSend = {
        width: 980,
        height: 2830,
        color: 3,
        content: `## 4. Outbound: find the person, write, send
One company per pass. Code applies the profile and checks the email before anything is sent.`,
    };

    @node({
        id: 'd33b1e3d-b3a3-4294-ae1f-5169e0999f68',
        webhookId: '2add19e6-6bb5-42ed-acac-a1c93d2dadb2',
        name: 'on_message_received',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 330],
    })
    OnMessageReceived = {
        httpMethod: 'POST',
        path: 'inbound-message',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '818e392a-6933-4550-a3b8-9f724ba47908',
        name: 'normalise_message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 330],
    })
    NormaliseMessage = {
        jsCode: `const b = $input.first().json.body ?? {};
const text = String(b.message ?? b.text ?? "").trim();
if (!text) throw new Error("The message is empty");
return [{ json: { conversation_id: String(b.conversation_id ?? b.email ?? "anonymous"), email: String(b.email ?? "").trim().toLowerCase(), text: text.slice(0, 4000), channel: b.channel ?? "chat" } }];`,
    };

    @node({
        id: '5e940843-8ffe-4018-a3d1-77588067ccee',
        name: 'Router Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [620, 200],
        onError: 'continueRegularOutput',
    })
    RouterAgent = {
        promptType: 'define',
        text: "={{ 'From: ' + ($json.email || 'unknown') + '\\n\\n' + $json.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Router Agent for a company's inbox. Read the message and decide its intent: 'support' for a question about the product, an order, an account or how something works; 'sales' for someone asking about buying, pricing or a demo; 'human' for a complaint, a legal or billing dispute, or anyone asking for a person; 'other' for anything else. Give your confidence from 0 to 1. Do not answer the message.",
            maxIterations: 6,
        },
    };

    @node({
        id: '09b87922-3303-4ee3-a7a4-58efb11038dd',
        name: 'router_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [520, 420],
    })
    RouterParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "intent": "support",
  "confidence": 0.9,
  "reason": "One sentence."
}`,
    };

    @node({
        id: '9a33a49e-9efe-4675-ab28-29709ced4631',
        name: 'read_route',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [980, 330],
    })
    ReadRoute = {
        jsCode: `const m = $("normalise_message").first().json;
const r = $input.first().json.output;
const ok = r && ["support", "sales", "human", "other"].includes(r.intent);
// What a person handles whatever the model made of it.
const must = /\\b(lawyer|legal action|sue|chargeback|refund|complaint|speak to (a|someone)|human|manager)\\b/i.test(m.text);
let to = "fallback";
if (must || (ok && r.intent === "human")) to = "human";
else if (ok && Number(r.confidence) >= 0.6 && (r.intent === "support" || r.intent === "sales")) to = "answer";
return [{ json: { ...m, intent: ok ? r.intent : "unknown", confidence: ok ? Number(r.confidence) : 0, route: to } }];`,
    };

    @node({
        id: 'f0f18519-6724-459d-a1a1-c0d5bca9a35c',
        name: 'switch_intent',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1240, 330],
    })
    SwitchIntent = {
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
                                id: 'ccbcf3a7-d9f5-43c5-a052-fbf9c249a1f2',
                                leftValue: "={{ $json.route === 'answer' }}",
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
                    outputKey: 'answer',
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
                                id: '46553f94-5fa6-4ae0-ab74-976626ebcae4',
                                leftValue: "={{ $json.route === 'human' }}",
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
                    outputKey: 'human',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '3e4e24a9-bb79-455c-a58e-e0188d2c3be6',
        name: 'RAG Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [300, 870],
        onError: 'continueRegularOutput',
    })
    RagAgent = {
        promptType: 'define',
        text: "={{ 'Customer: ' + ($('normalise_message').first().json.email || 'unknown') + '\\n\\n' + $('normalise_message').first().json.text }}",
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the RAG Agent: you answer customers for the company. Search the knowledge base before you answer, and look the customer up in the CRM when the question depends on who they are. State only what a tool returned. If the tools do not hold the answer, reply with exactly: I do not know. Under 120 words, plain text.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'f4f37e26-eb78-4bb5-ad94-537df2ad7170',
        name: 'conversation_memory',
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        version: 1.3,
        position: [0, 1090],
    })
    ConversationMemory = {
        sessionIdType: 'customKey',
        sessionKey: "={{ $('normalise_message').first().json.conversation_id }}",
        contextWindowLength: 10,
    };

    @node({
        id: '68bb6bb7-0d09-4beb-a8f2-3fb050737243',
        name: 'knowledge_base',
        type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
        version: 1.3,
        position: [200, 1090],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
    })
    KnowledgeBase = {
        mode: 'retrieve-as-tool',
        toolName: 'knowledge_base',
        toolDescription:
            "Searches the company's help centre and product documentation. Pass the customer's question in a few words.",
        tableName: {
            __rl: true,
            mode: 'id',
            value: 'documents',
        },
        topK: 4,
        options: {
            queryName: 'match_documents',
        },
    };

    @node({
        id: '55ab8d0c-02ce-49b5-ae6f-6ba4c2231a06',
        name: 'embeddings',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [200, 1310],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    Embeddings = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: 'cffc7647-75c5-4928-aa2e-1327b82726b0',
        name: 'crm_lookup',
        type: 'n8n-nodes-base.hubspotTool',
        version: 2.1,
        position: [400, 1090],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
    })
    CrmLookup = {
        descriptionType: 'manual',
        toolDescription:
            'Searches HubSpot contacts by email, name or company and returns what the CRM knows about them.',
        authentication: 'appToken',
        resource: 'contact',
        operation: 'search',
        returnAll: false,
        limit: 5,
        filterGroupsUi: {},
        additionalFields: {
            query: "={{ $fromAI('query', `An email address, a name or a company`, 'string') }}",
        },
    };

    @node({
        id: '7f881909-0c3e-43b6-a2db-dc86c272455f',
        name: 'read_answer',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [860, 1220],
    })
    ReadAnswer = {
        jsCode: `const m = $("normalise_message").first().json;
const reply = String($input.first().json.output ?? "").trim();
const answered = reply.length > 0 && !/i do not know|i don't know|UNSCRIPTED/i.test(reply);
return [{ json: { ...m, reply, answered, handled_by: "rag" } }];`,
    };

    @node({
        id: '83f0423a-29e3-4035-a862-a07f847abf8b',
        name: 'if_answered',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1120, 1220],
    })
    IfAnswered = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '00dcd248-86a7-4b34-a169-22dc9748875f',
                    leftValue: '={{ $json.answered }}',
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
        id: 'a33b7605-349c-4ded-a325-475a44a6bc48',
        name: 'Fallback Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1380, 1090],
        onError: 'continueRegularOutput',
    })
    FallbackAgent = {
        promptType: 'define',
        text: "={{ $('normalise_message').first().json.text }}",
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the Fallback Agent. The message could not be answered from the knowledge base, or its intent was unclear. Do not guess an answer. Ask the one question that would make it answerable, or say that the team will follow up by email. Under 60 words, plain text.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'fe35b6d0-fbac-4f7b-ab80-5181bfa17980',
        name: 'read_fallback',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1640, 1220],
    })
    ReadFallback = {
        jsCode: `const m = $("normalise_message").first().json;
const reply = String($input.first().json.output ?? "").trim();
const usable = reply.length > 0 && !/UNSCRIPTED/.test(reply);
return [{ json: { ...m, reply: usable ? reply : "Thanks for your message. A member of the team will reply by email shortly.", handled_by: "fallback" } }];`,
    };

    @node({
        id: '1f02099b-23a7-401a-a6bf-b7b1ac691012',
        name: 'Human Escalation Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [300, 1490],
        onError: 'continueRegularOutput',
    })
    HumanEscalationAgent = {
        promptType: 'define',
        text: "={{ 'Customer: ' + ($('normalise_message').first().json.email || 'unknown') + '\\n\\n' + $('normalise_message').first().json.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Human Escalation Agent. This conversation is going to a person. Write a two-sentence summary of what the customer wants for the colleague who picks it up, say how urgent it is ('low', 'normal' or 'high'), and write a short holding reply that tells the customer a person will be in touch. Promise nothing else.",
            maxIterations: 6,
        },
    };

    @node({
        id: '9dffe015-45b7-4871-a62a-08135ed24bbc',
        name: 'escalation_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [200, 1710],
    })
    EscalationParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "summary": "Two sentences.",
  "urgency": "normal",
  "holding_reply": "A person will be in touch."
}`,
    };

    @node({
        id: 'd6c1d536-2271-4e9c-a55f-a5801a90d766',
        name: 'read_escalation',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [860, 1400],
    })
    ReadEscalation = {
        jsCode: `const m = $("normalise_message").first().json;
const e = $input.first().json.output;
const ok = e && typeof e === "object" && e.summary;
return [{ json: { ...m, summary: ok ? String(e.summary) : m.text.slice(0, 300), urgency: ok && ["low", "normal", "high"].includes(e.urgency) ? e.urgency : "high", reply: ok && e.holding_reply ? String(e.holding_reply) : "Thanks for your message. A member of the team will be in touch shortly.", handled_by: "human" } }];`,
    };

    @node({
        id: 'c692c708-f064-4880-ad96-168f6c36bd83',
        name: 'create_handover_task',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [1120, 1400],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateHandoverTask = {
        authentication: 'appToken',
        resource: 'engagement',
        operation: 'create',
        type: 'task',
        metadata: {
            subject: "={{ 'Handover: ' + ($json.email || 'unknown customer') }}",
            body: '={{ $json.summary }}',
            status: 'NOT_STARTED',
        },
        additionalFields: {
            associations: {},
        },
    };

    @node({
        id: '327b3f59-6d4e-45db-a7d7-94edd98139b2',
        name: 'notify_team',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1380, 1530],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    NotifyTeam = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#support' }}",
        },
        text: "={{ ':raising_hand: ' + $('read_escalation').first().json.urgency.toUpperCase() + ' handover from ' + ($('read_escalation').first().json.email || 'unknown') + ': ' + $('read_escalation').first().json.summary }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'dd404df0-6c5b-4f81-ab80-e3adcf538c7d',
        name: 'set_escalation_reply',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1640, 1400],
    })
    SetEscalationReply = {
        assignments: {
            assignments: [
                {
                    id: '00fdde0b-8699-4953-ab86-9a73b756938a',
                    name: 'reply',
                    value: "={{ $('read_escalation').first().json.reply }}",
                    type: 'string',
                },
                {
                    id: 'fee77097-7206-476f-aa7c-035093200fda',
                    name: 'handled_by',
                    value: "={{ 'human' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '940fbd66-d887-4c07-aeb1-b62d614d3ddf',
        name: 'log_conversation',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1900, 1310],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogConversation = {
        resource: 'row',
        operation: 'create',
        tableId: 'conversations',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'conversation_id',
                    fieldValue: "={{ $('normalise_message').first().json.conversation_id }}",
                },
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('normalise_message').first().json.email }}",
                },
                {
                    fieldId: 'message',
                    fieldValue: "={{ $('normalise_message').first().json.text }}",
                },
                {
                    fieldId: 'reply',
                    fieldValue: '={{ $json.reply }}',
                },
                {
                    fieldId: 'handled_by',
                    fieldValue: '={{ $json.handled_by }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '37053c9a-da80-4c4e-acde-9d6699ee148b',
        name: 'respond_to_customer',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2160, 1310],
    })
    RespondToCustomer = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ reply: $json.reply, handled_by: $json.handled_by }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '707a3982-6f51-4925-a834-c5f26432c05e',
        name: 'daily_prospecting',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 2290],
    })
    DailyProspecting = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * 1-5',
                },
            ],
        },
    };

    @node({
        id: '2a8d5af9-5a49-4617-a4d2-967aaa1c7878',
        name: 'get_icp',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 2290],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetIcp = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'icp_profiles',
        returnAll: false,
        limit: 1,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'active',
                    condition: 'eq',
                    keyValue: '={{ true }}',
                },
            ],
        },
    };

    @node({
        id: '5f9db57d-1089-445a-abbc-765bce87617d',
        name: 'if_icp',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 2290],
    })
    IfIcp = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '4a99e0b2-954e-4297-ac4a-3eeb0ac7db86',
                    leftValue: '={{ !!$json.industry }}',
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
        id: 'bf47b89b-ca92-475a-a71d-158fbef023d4',
        name: 'Research Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1080, 2160],
        onError: 'continueRegularOutput',
    })
    ResearchAgent = {
        promptType: 'define',
        text: "={{ 'Industry: ' + $json.industry + '\\nSize: ' + $json.size + '\\nRegion: ' + $json.region + '\\nWe offer: ' + $json.offer }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Research Agent. Find up to five real companies that fit the ideal customer profile you are given. Use web search to find candidates and fetch a company's own site to confirm it fits before you list it. For each give its name, its domain and one sentence of evidence. List nothing you could not confirm.",
            maxIterations: 6,
        },
    };

    @node({
        id: 'f3cf571e-13b0-401f-a7b9-b80f5787f3cc',
        name: 'web_search',
        type: '@n8n/n8n-nodes-langchain.toolSerpApi',
        version: 1,
        position: [780, 2380],
        credentials: { serpApi: { id: '__CRED:serpapi__', name: 'SerpAPI' } },
    })
    WebSearch = {
        options: {},
    };

    @node({
        id: '7839b39c-b892-4369-a7db-6ba667abeb9d',
        name: 'fetch_page',
        type: 'n8n-nodes-base.httpRequestTool',
        version: 4.2,
        position: [980, 2380],
    })
    FetchPage = {
        descriptionType: 'manual',
        toolDescription: 'Fetches a public web page and returns its HTML. Pass the full address.',
        method: 'GET',
        url: "={{ $fromAI('url', `The full address of the page, starting https://`, 'string') }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'c25200d5-f77f-41ed-a95c-b55e97259317',
        name: 'research_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1180, 2380],
    })
    ResearchParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "companies": [
    {
      "name": "The company",
      "domain": "its-site.com",
      "why": "One sentence of evidence."
    }
  ]
}`,
    };

    @node({
        id: '638d1c89-54ba-4a3b-a37a-7d8b2dfb37ca',
        name: 'read_companies',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1640, 2290],
    })
    ReadCompanies = {
        jsCode: `const list = $input.first().json.output?.companies;
if (!Array.isArray(list)) return [];
const seen = new Set();
return list.filter((c) => c && c.name && c.domain && !seen.has(c.domain) && seen.add(c.domain)).slice(0, 5).map((c) => ({ json: { name: String(c.name), domain: String(c.domain).toLowerCase(), why: String(c.why ?? "") } }));`,
    };

    @node({
        id: '4cf65f9f-6925-4db6-aa9d-3cf3c3996735',
        name: 'for_each_company',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [300, 2830],
    })
    ForEachCompany = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '06582c47-e4c1-4497-ae48-a2e4b1af79cb',
        name: 'Lead Gen Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [300, 3010],
        onError: 'continueRegularOutput',
    })
    LeadGenAgent = {
        promptType: 'define',
        text: "={{ 'Company: ' + $json.name + ' (' + $json.domain + ')\\nRole we want: ' + $('get_icp').first().json.role + '\\nWhy the company fits: ' + $json.why }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Lead Gen Agent. For the company you are given, find the one person who holds the role in the ideal customer profile. Fetch the company's site (team, about and contact pages) to find them. Give their name, role and work email only if the site shows them, a fit score from 0 to 100, and the evidence for the role. If you cannot find a named person with an email, leave email empty.",
            maxIterations: 6,
        },
    };

    @node({
        id: '9110934f-03a1-48f5-a199-cdc385f48108',
        name: 'fetch_company_page',
        type: 'n8n-nodes-base.httpRequestTool',
        version: 4.2,
        position: [0, 3230],
    })
    FetchCompanyPage = {
        descriptionType: 'manual',
        toolDescription: 'Fetches a public web page and returns its HTML. Pass the full address.',
        method: 'GET',
        url: "={{ $fromAI('url', `The full address of the page, starting https://`, 'string') }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'b1e12919-bae3-4d70-a2fc-288b3818ac4a',
        name: 'crm_search',
        type: 'n8n-nodes-base.hubspotTool',
        version: 2.1,
        position: [200, 3230],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
    })
    CrmSearch = {
        descriptionType: 'manual',
        toolDescription:
            'Searches HubSpot contacts by email, name or company and returns what the CRM knows about them.',
        authentication: 'appToken',
        resource: 'contact',
        operation: 'search',
        returnAll: false,
        limit: 5,
        filterGroupsUi: {},
        additionalFields: {
            query: "={{ $fromAI('query', `An email address, a name or a company`, 'string') }}",
        },
    };

    @node({
        id: 'e245f82c-60ac-49b0-a24f-ff477c377137',
        name: 'lead_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [400, 3230],
    })
    LeadParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "name": "Full name",
  "role": "Their role",
  "email": "name@company.com",
  "company": "The company",
  "score": 80,
  "evidence": "Where the role was found."
}`,
    };

    @node({
        id: 'eb104a50-cff9-4d30-a2cf-b1f195bcea88',
        name: 'check_icp',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [300, 3450],
    })
    CheckIcp = {
        jsCode: `// The profile is applied here, in code: a model's enthusiasm does not qualify a lead.
const c = $("for_each_company").first().json;
const l = $input.first().json.output ?? {};
const email = String(l.email ?? "").trim().toLowerCase();
const reasons = [];
if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) reasons.push("no work email found");
else if (!email.endsWith("@" + c.domain) && !email.endsWith("." + c.domain)) reasons.push("email is not at the company's domain");
if (!(Number(l.score) >= 70)) reasons.push("fit score under 70");
if (!String(l.evidence ?? "").trim()) reasons.push("no evidence for the role");
if (!String(l.name ?? "").trim()) reasons.push("no named person");
return [{ json: { company: c.name, domain: c.domain, why: c.why, name: String(l.name ?? ""), role: String(l.role ?? ""), email, score: Number(l.score) || 0, evidence: String(l.evidence ?? ""), qualified: reasons.length === 0, reasons } }];`,
    };

    @node({
        id: '0ae42ada-c85f-4a3c-ad99-2497c293fb92',
        name: 'if_qualified',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [300, 3630],
    })
    IfQualified = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'fbc0d8bf-edb7-4f43-adec-6334cd553e1a',
                    leftValue: '={{ $json.qualified }}',
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
        id: '4a8b2048-5075-4e98-a5c9-a54c74a7f436',
        name: 'find_contact',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [300, 3810],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FindContact = {
        authentication: 'appToken',
        resource: 'contact',
        operation: 'search',
        returnAll: false,
        limit: 100,
        filterGroupsUi: {},
        additionalFields: {
            query: '={{ $json.email }}',
        },
    };

    @node({
        id: '18d1f901-fd21-4d05-a383-d5813efc650e',
        name: 'if_new_lead',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [300, 3990],
    })
    IfNewLead = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '78c65dcd-a36f-4bbd-aec3-073773ac07ee',
                    leftValue: '={{ !$json.id }}',
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
        id: 'ddc720b2-a1c1-4ab3-ac29-691929d83c67',
        name: 'Cold Outreach Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [300, 4170],
        onError: 'continueRegularOutput',
    })
    ColdOutreachAgent = {
        promptType: 'define',
        text: "={{ 'To: ' + $('check_icp').first().json.name + ', ' + $('check_icp').first().json.role + ' at ' + $('check_icp').first().json.company + '\\nWhat we found: ' + $('check_icp').first().json.why + '\\nWe offer: ' + $('get_icp').first().json.offer }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Cold Outreach Agent. Write one first email to the person you are given. Open with the specific thing found about their company, say in one sentence what we offer and why it fits them, and end with one small ask. Under 90 words, plain text, no flattery, no placeholders. Give a subject line of under 60 characters.',
            maxIterations: 6,
        },
    };

    @node({
        id: '9c8292d4-7de2-49e8-a141-7fc5974387b8',
        name: 'outreach_parser',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [200, 4390],
    })
    OutreachParser = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "subject": "The subject line",
  "body": "The email."
}`,
    };

    @node({
        id: '4d03b9e4-63a4-47d1-a120-3ebd43bb6b09',
        name: 'check_email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [300, 4610],
    })
    CheckEmail = {
        jsCode: `const l = $("check_icp").first().json;
const e = $input.first().json.output ?? {};
const subject = String(e.subject ?? "").trim();
const body = String(e.body ?? "").trim();
const problems = [];
if (!subject || subject.length > 80) problems.push("subject missing or too long");
if (body.length < 40 || body.split(/\\s+/).length > 130) problems.push("body missing or too long");
if (/[\\[{<][^\\]}>]*[\\]}>]/.test(subject + body)) problems.push("a placeholder was left in");
return [{ json: { ...l, subject, body, sendable: problems.length === 0, problems } }];`,
    };

    @node({
        id: '97a5496a-cf0e-4f82-ab59-0bed5ece8b9f',
        name: 'if_sendable',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [300, 4790],
    })
    IfSendable = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd803d112-6b41-459a-a006-4e60dd01ab22',
                    leftValue: '={{ $json.sendable }}',
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
        id: '1a28e057-a046-4f9d-a4f5-01c3d1da78de',
        name: 'send_outreach',
        type: 'n8n-nodes-base.gmail',
        version: 2.1,
        position: [300, 4970],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendOutreach = {
        resource: 'message',
        operation: 'send',
        sendTo: '={{ $json.email }}',
        subject: '={{ $json.subject }}',
        emailType: 'text',
        message: '={{ $json.body }}',
        options: {
            appendAttribution: false,
        },
    };

    @node({
        id: '856bb52b-c9cb-4f90-aad2-09ee3363b27a',
        name: 'create_lead',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [300, 5150],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateLead = {
        authentication: 'appToken',
        resource: 'contact',
        operation: 'upsert',
        email: "={{ $('check_icp').first().json.email }}",
        additionalFields: {
            firstName: "={{ $('check_icp').first().json.name }}",
            companyName: "={{ $('check_icp').first().json.company }}",
            jobTitle: "={{ $('check_icp').first().json.role }}",
        },
        options: {},
    };

    @node({
        id: '173af5e6-8f69-48c1-a918-0dcc5f2b1214',
        name: 'log_outreach',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [300, 5330],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogOutreach = {
        resource: 'row',
        operation: 'create',
        tableId: 'outreach_log',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('check_icp').first().json.email }}",
                },
                {
                    fieldId: 'company',
                    fieldValue: "={{ $('check_icp').first().json.company }}",
                },
                {
                    fieldId: 'subject',
                    fieldValue: "={{ $('check_email').first().json.subject }}",
                },
                {
                    fieldId: 'score',
                    fieldValue: "={{ $('check_icp').first().json.score }}",
                },
                {
                    fieldId: 'sent_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '3191d97a-9230-47ef-a9a0-19bdbbfe3f3e',
        name: 'OpenAI Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [720, 420],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    OpenaiChatModel = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'gpt-4o-mini',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'cb762694-adc2-4a62-a5df-9618443cdc96',
        name: 'OpenAI Chat Model 1',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1380, 2380],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    OpenaiChatModel1 = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'gpt-4o-mini',
        },
        options: {
            temperature: 0.2,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.OnMessageReceived.out(0).to(this.NormaliseMessage.in(0));
        this.NormaliseMessage.out(0).to(this.RouterAgent.in(0));
        this.RouterAgent.out(0).to(this.ReadRoute.in(0));
        this.ReadRoute.out(0).to(this.SwitchIntent.in(0));
        this.SwitchIntent.out(0).to(this.RagAgent.in(0));
        this.SwitchIntent.out(1).to(this.HumanEscalationAgent.in(0));
        this.SwitchIntent.out(2).to(this.FallbackAgent.in(0));
        this.RagAgent.out(0).to(this.ReadAnswer.in(0));
        this.ReadAnswer.out(0).to(this.IfAnswered.in(0));
        this.IfAnswered.out(0).to(this.LogConversation.in(0));
        this.IfAnswered.out(1).to(this.FallbackAgent.in(0));
        this.FallbackAgent.out(0).to(this.ReadFallback.in(0));
        this.ReadFallback.out(0).to(this.LogConversation.in(0));
        this.HumanEscalationAgent.out(0).to(this.ReadEscalation.in(0));
        this.ReadEscalation.out(0).to(this.CreateHandoverTask.in(0));
        this.CreateHandoverTask.out(0).to(this.NotifyTeam.in(0));
        this.NotifyTeam.out(0).to(this.SetEscalationReply.in(0));
        this.SetEscalationReply.out(0).to(this.LogConversation.in(0));
        this.LogConversation.out(0).to(this.RespondToCustomer.in(0));
        this.DailyProspecting.out(0).to(this.GetIcp.in(0));
        this.GetIcp.out(0).to(this.IfIcp.in(0));
        this.IfIcp.out(0).to(this.ResearchAgent.in(0));
        this.ResearchAgent.out(0).to(this.ReadCompanies.in(0));
        this.ReadCompanies.out(0).to(this.ForEachCompany.in(0));
        this.ForEachCompany.out(1).to(this.LeadGenAgent.in(0));
        this.LeadGenAgent.out(0).to(this.CheckIcp.in(0));
        this.CheckIcp.out(0).to(this.IfQualified.in(0));
        this.IfQualified.out(0).to(this.FindContact.in(0));
        this.IfQualified.out(1).to(this.ForEachCompany.in(0));
        this.FindContact.out(0).to(this.IfNewLead.in(0));
        this.IfNewLead.out(0).to(this.ColdOutreachAgent.in(0));
        this.IfNewLead.out(1).to(this.ForEachCompany.in(0));
        this.ColdOutreachAgent.out(0).to(this.CheckEmail.in(0));
        this.CheckEmail.out(0).to(this.IfSendable.in(0));
        this.IfSendable.out(0).to(this.SendOutreach.in(0));
        this.IfSendable.out(1).to(this.ForEachCompany.in(0));
        this.SendOutreach.out(0).to(this.CreateLead.in(0));
        this.CreateLead.out(0).to(this.LogOutreach.in(0));
        this.LogOutreach.out(0).to(this.ForEachCompany.in(0));

        this.RouterAgent.uses({
            ai_languageModel: this.OpenaiChatModel.output,
            ai_outputParser: this.RouterParser.output,
        });
        this.RagAgent.uses({
            ai_languageModel: this.OpenaiChatModel.output,
            ai_memory: this.ConversationMemory.output,
            ai_tool: [this.KnowledgeBase.output, this.CrmLookup.output],
        });
        this.KnowledgeBase.uses({
            ai_embedding: this.Embeddings.output,
        });
        this.FallbackAgent.uses({
            ai_languageModel: this.OpenaiChatModel.output,
        });
        this.HumanEscalationAgent.uses({
            ai_languageModel: this.OpenaiChatModel.output,
            ai_outputParser: this.EscalationParser.output,
        });
        this.ResearchAgent.uses({
            ai_languageModel: this.OpenaiChatModel1.output,
            ai_outputParser: this.ResearchParser.output,
            ai_tool: [this.WebSearch.output, this.FetchPage.output],
        });
        this.LeadGenAgent.uses({
            ai_languageModel: this.OpenaiChatModel1.output,
            ai_outputParser: this.LeadParser.output,
            ai_tool: [this.FetchCompanyPage.output, this.CrmSearch.output],
        });
        this.ColdOutreachAgent.uses({
            ai_languageModel: this.OpenaiChatModel1.output,
            ai_outputParser: this.OutreachParser.output,
        });
    }
}
