import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI support desk · Triage, specialists and a judge
// Nodes   : 102  |  Connections: 69
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionIntakeAndTriage             stickyNote
// SectionSpecialistsEachWithItsOwnTools stickyNote
// SectionRefundPolicyInCode          stickyNote
// SectionTheJudgeThenSendOrHandOver  stickyNote
// SectionResponseTimeWatch           stickyNote
// SectionNightlyAuditOfWhatWasSent   stickyNote
// SectionWeeklyGaps                  stickyNote
// SectionAfterTheAnswerUnhappyCustomers stickyNote
// NewTicket                          zendeskTrigger             [creds]
// ReadTheTicket                      code
// SeenThisTicket                     executeWorkflow
// NewTicket1                         if
// AlreadyHandled                     noOp
// TriageAgent                        agent                      [AI] [onError→regular]
// GptTriage                          lmChatOpenAi               [creds] [ai_languageModel]
// Triage                             outputParserStructured     [ai_outputParser]
// ApplyTheTriageRules                code
// TagTheTicket                       zendesk                    [onError→regular] [creds] [retry]
// StraightToAPerson                  if
// SkipTheAgents                      code
// WhichSpecialist                    switch
// ToTheOrdersAgent                   code
// ToTheBillingAgent                  code
// ToTheTechnicalAgent                code
// ToTheGeneralAgent                  code
// OrdersAgent                        agent                      [AI] [onError→regular]
// ClaudeOrders                       lmChatAnthropic            [creds] [ai_languageModel]
// OrdersAnswer                       outputParserStructured     [ai_outputParser]
// OrderLookup                        shopifyTool                [creds] [ai_tool]
// OrderHistory                       supabaseTool               [creds] [ai_tool]
// BillingAgent                       agent                      [AI] [onError→regular]
// ClaudeBilling                      lmChatAnthropic            [creds] [ai_languageModel]
// BillingAnswer                      outputParserStructured     [ai_outputParser]
// ChargeLookup                       stripeTool                 [creds] [ai_tool]
// CustomerLookup                     stripeTool                 [creds] [ai_tool]
// DaysSince                          toolCode                   [ai_tool]
// TechnicalAgent                     agent                      [AI] [onError→regular]
// ClaudeTechnical                    lmChatAnthropic            [creds] [ai_languageModel]
// TechnicalAnswer                    outputParserStructured     [ai_outputParser]
// HelpCentre                         vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsHelpCentre               embeddingsOpenAi           [creds] [ai_embedding]
// WorkItThrough                      toolThink                  [ai_tool]
// GeneralAgent                       agent                      [AI] [onError→regular]
// ClaudeGeneral                      lmChatAnthropic            [creds] [ai_languageModel]
// GeneralAnswer                      outputParserStructured     [ai_outputParser]
// PoliciesAndGuides                  vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsPolicies                 embeddingsOpenAi           [creds] [ai_embedding]
// CollectTheAnswer                   code
// RefundAskedFor                     if
// PastRefunds                        supabase                   [creds] [alwaysOutput] [retry]
// ApplyTheRefundPolicy               code
// InsideThePolicy                    if
// RefundInStripe                     httpRequest                [onError→out(1)] [creds] [retry]
// RecordTheRefund                    supabase                   [creds] [retry]
// AddTheRefundToTheReply             code
// RefundNeedsAPerson                 code
// JudgeAgent                         agent                      [AI] [onError→regular]
// GptJudging                         lmChatOpenAi               [creds] [ai_languageModel]
// Verdict                            outputParserStructured     [ai_outputParser]
// DecideSendOrHandOver               code
// FitToSend                          if
// SendTheReply                       zendesk                    [creds] [retry]
// LogAnswered                        supabase                   [creds] [retry]
// WriteTheHandover                   code
// AssignToTheTeam                    zendesk                    [creds] [retry]
// LogHandedOver                      supabase                   [creds] [retry]
// HandoverMessage                    code
// TellTheSupportTeam                 executeWorkflow
// Every10Minutes                     scheduleTrigger
// OpenUnansweredTickets              zendesk                    [creds] [alwaysOutput] [retry]
// MeasureAgainstTheSla               code
// MarkTheStage                       zendesk                    [onError→regular] [creds] [retry]
// SlaMessage                         code
// RaiseTheSla                        executeWorkflow
// _0200Nightly                       scheduleTrigger
// YesterdaySAnswers                  supabase                   [creds] [alwaysOutput] [retry]
// TakeASample                        code
// AuditorAgent                       agent                      [AI] [onError→regular]
// ClaudeAuditing                     lmChatAnthropic            [creds] [ai_languageModel]
// Grade                              outputParserStructured     [ai_outputParser]
// GatherTheGrades                    code
// SaveTheAudit                       supabase                   [creds] [retry]
// PostTheAudit                       slack                      [creds] [retry]
// Monday0800                         scheduleTrigger
// HandedOverLastWeek                 supabase                   [creds] [alwaysOutput] [retry]
// GatherTheQuestions                 code
// AnyGaps                            if
// GapsAgent                          agent                      [AI] [onError→regular]
// ClaudeGaps                         lmChatAnthropic            [creds] [ai_languageModel]
// PostTheGaps                        slack                      [creds] [retry]
// PostAllClear                       slack                      [creds] [retry]
// SurveyAnswered                     typeformTrigger            [creds]
// ReadTheSurvey                      code
// RecordTheScore                     supabase                   [creds] [retry]
// Unhappy                            if
// RecoveryAgent                      agent                      [AI] [onError→regular]
// ClaudeRecovery                     lmChatAnthropic            [creds] [ai_languageModel]
// OpenAFollowUp                      zendesk                    [creds] [retry]
// UnhappyMessage                     code
// TellTheSupportLead                 executeWorkflow
// Recorded                           noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// NewTicket
//    → ReadTheTicket
//      → SeenThisTicket
//        → NewTicket1
//          → TriageAgent
//            → ApplyTheTriageRules
//              → TagTheTicket
//                → StraightToAPerson
//                  → SkipTheAgents
//                    → WriteTheHandover
//                      → AssignToTheTeam
//                        → LogHandedOver
//                          → HandoverMessage
//                            → TellTheSupportTeam
//                 .out(1) → WhichSpecialist
//                    → ToTheOrdersAgent
//                      → OrdersAgent
//                        → CollectTheAnswer
//                          → RefundAskedFor
//                            → PastRefunds
//                              → ApplyTheRefundPolicy
//                                → InsideThePolicy
//                                  → RefundInStripe
//                                    → RecordTheRefund
//                                      → AddTheRefundToTheReply
//                                        → JudgeAgent
//                                          → DecideSendOrHandOver
//                                            → FitToSend
//                                              → SendTheReply
//                                                → LogAnswered
//                                             .out(1) → WriteTheHandover (↩ loop)
//                                   .out(1) → RefundNeedsAPerson
//                                      → WriteTheHandover (↩ loop)
//                                 .out(1) → RefundNeedsAPerson (↩ loop)
//                           .out(1) → JudgeAgent (↩ loop)
//                   .out(1) → ToTheBillingAgent
//                      → BillingAgent
//                        → CollectTheAnswer (↩ loop)
//                   .out(2) → ToTheTechnicalAgent
//                      → TechnicalAgent
//                        → CollectTheAnswer (↩ loop)
//                   .out(3) → ToTheGeneralAgent
//                      → GeneralAgent
//                        → CollectTheAnswer (↩ loop)
//         .out(1) → AlreadyHandled
// Every10Minutes
//    → OpenUnansweredTickets
//      → MeasureAgainstTheSla
//        → MarkTheStage
//          → SlaMessage
//            → RaiseTheSla
// _0200Nightly
//    → YesterdaySAnswers
//      → TakeASample
//        → AuditorAgent
//          → GatherTheGrades
//            → SaveTheAudit
//              → PostTheAudit
// Monday0800
//    → HandedOverLastWeek
//      → GatherTheQuestions
//        → AnyGaps
//          → GapsAgent
//            → PostTheGaps
//         .out(1) → PostAllClear
// SurveyAnswered
//    → ReadTheSurvey
//      → RecordTheScore
//        → Unhappy
//          → RecoveryAgent
//            → OpenAFollowUp
//              → UnhappyMessage
//                → TellTheSupportLead
//         .out(1) → Recorded
//
// AI CONNECTIONS
// TriageAgent.uses({ ai_languageModel: GptTriage, ai_outputParser: Triage })
// OrdersAgent.uses({ ai_languageModel: ClaudeOrders, ai_outputParser: OrdersAnswer, ai_tool: [OrderLookup, OrderHistory] })
// BillingAgent.uses({ ai_languageModel: ClaudeBilling, ai_outputParser: BillingAnswer, ai_tool: [ChargeLookup, CustomerLookup, DaysSince] })
// TechnicalAgent.uses({ ai_languageModel: ClaudeTechnical, ai_outputParser: TechnicalAnswer, ai_tool: [HelpCentre, WorkItThrough] })
// HelpCentre.uses({ ai_embedding: EmbeddingsHelpCentre })
// GeneralAgent.uses({ ai_languageModel: ClaudeGeneral, ai_outputParser: GeneralAnswer, ai_tool: [PoliciesAndGuides] })
// PoliciesAndGuides.uses({ ai_embedding: EmbeddingsPolicies })
// JudgeAgent.uses({ ai_languageModel: GptJudging, ai_outputParser: Verdict })
// AuditorAgent.uses({ ai_languageModel: ClaudeAuditing, ai_outputParser: Grade })
// GapsAgent.uses({ ai_languageModel: ClaudeGaps })
// RecoveryAgent.uses({ ai_languageModel: ClaudeRecovery })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'AI support desk · Triage, specialists and a judge',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class AiSupportDeskTriageSpecialistsAndAJudgeWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'f68ffd9f-2bcd-4b35-a9a3-76adc8079f22',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## AI support desk · Triage, specialists and a judge
A triage agent routes each Zendesk ticket to a specialist agent that can read Shopify, Stripe or the knowledge base. A separate judge checks every answer before it is sent, refunds are decided by a written policy in code, and anything uncertain reaches a person with the facts already gathered.

**Platforms:** Zendesk, OpenAI, Claude, Shopify, Supabase, Stripe, Pinecone, Slack, Typeform
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/ai-support-desk\``,
    };

    @node({
        id: 'ee334b2d-8ecc-456d-a000-db1ca0f979fa',
        name: 'Section: Intake and triage',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionIntakeAndTriage = {
        width: 2920,
        height: 870,
        color: 4,
        content: `## 1. Intake and triage
Zendesk in. One agent reads the ticket; code decides what always goes to a person.`,
    };

    @node({
        id: '9218e76e-32ca-490e-a60c-1b664a3357cf',
        name: 'Section: Specialists, each with its own tools',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 950],
    })
    SectionSpecialistsEachWithItsOwnTools = {
        width: 1440,
        height: 2270,
        color: 5,
        content: `## 2. Specialists, each with its own tools
Orders reads Shopify, billing reads Stripe, technical and general search the knowledge base in Pinecone.`,
    };

    @node({
        id: 'e626be2e-929a-42bb-a8bc-f5580bc9fcbb',
        name: 'Section: Refund policy, in code',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3300],
    })
    SectionRefundPolicyInCode = {
        width: 1940,
        height: 510,
        color: 6,
        content: `## 3. Refund policy, in code
An agent can ask for a refund. Only this section can make one.`,
    };

    @node({
        id: '4ec2bfa7-a9ae-4683-a80c-54d0cde43f0e',
        name: 'Section: The judge, then send or hand over',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3890],
    })
    SectionTheJudgeThenSendOrHandOver = {
        width: 2400,
        height: 590,
        color: 3,
        content: `## 4. The judge, then send or hand over
A different model checks the answer against the facts. Code makes the final call.`,
    };

    @node({
        id: 'bb0cb96d-6937-41a8-aa18-075deb37dee2',
        name: 'Section: Response-time watch',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 4560],
    })
    SectionResponseTimeWatch = {
        width: 1680,
        height: 330,
        color: 7,
        content: '## 5. Response-time watch',
    };

    @node({
        id: 'aebdb838-4b8b-40df-a075-49e31163b0ed',
        name: 'Section: Nightly audit of what was sent',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 4970],
    })
    SectionNightlyAuditOfWhatWasSent = {
        width: 2140,
        height: 590,
        color: 2,
        content: '## 6. Nightly audit of what was sent',
    };

    @node({
        id: '7ae1387f-9093-4dc6-a2a0-a1138fb77005',
        name: 'Section: Weekly gaps',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 5640],
    })
    SectionWeeklyGaps = {
        width: 1680,
        height: 770,
        color: 4,
        content: '## 7. Weekly gaps',
    };

    @node({
        id: '0f34fb00-5458-4085-abba-b7beaf3bc664',
        name: 'Section: After the answer: unhappy customers',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 6490],
    })
    SectionAfterTheAnswerUnhappyCustomers = {
        width: 2200,
        height: 770,
        color: 5,
        content: '## 8. After the answer: unhappy customers',
    };

    @node({
        id: 'f0b84625-0fab-4bbd-a1ff-6f0f6537b5cc',
        webhookId: '85a6b415-94b1-4bac-a67b-3fc2b8479dfc',
        name: 'New ticket',
        type: 'n8n-nodes-base.zendeskTrigger',
        version: 1,
        position: [0, 470],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
    })
    NewTicket = {
        service: 'support',
        options: {},
        conditions: {
            all: [
                {
                    resource: 'ticket',
                    field: 'status',
                    operation: 'is',
                    value: 'new',
                },
            ],
        },
    };

    @node({
        id: '82092ee9-3929-4b97-a2fb-d291c21fe259',
        name: 'Read the ticket',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 470],
    })
    ReadTheTicket = {
        jsCode: `return $input.all().map((item) => {
  const t = item.json;
  const id = String(t.id ?? t.ticket_id ?? "");
  if (!id) throw new Error("Ticket has no id");
  return { json: {
    ticket_id: id,
    email: String(t.requester_email ?? t.requester?.email ?? "").toLowerCase(),
    subject: String(t.subject ?? "").slice(0, 300),
    body: String(t.description ?? t.body ?? "").slice(0, 4000),
    plan: t.organization?.plan ?? t.plan ?? "standard",
    scope: "support-ticket", key: id,
  } };
});`,
    };

    @node({
        id: '5c2ddf2c-5f21-4ffc-ae5c-c0e206b42dfe',
        name: 'Seen this ticket?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [520, 470],
    })
    SeenThisTicket = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: 'c9d3c72a-644a-4b96-af34-51839743e941',
        name: 'New ticket?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 470],
    })
    NewTicket1 = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd16d7877-6534-40cc-aa83-6632d7a29357',
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
        id: '7c2b9b73-833d-4303-a9a9-032a00582646',
        name: 'Already handled',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1140, 250],
    })
    AlreadyHandled = {};

    @node({
        id: '13f7e52e-8a8e-4121-a11f-ae651b69233b',
        name: 'Triage agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1140, 430],
        onError: 'continueRegularOutput',
    })
    TriageAgent = {
        promptType: 'define',
        text: "={{ 'Subject: ' + $json.subject + '\\n\\n' + $json.body }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Triage agent on a support desk. Read the ticket and decide: topic ('orders' for delivery, order status and returns; 'billing' for charges, invoices and refunds; 'technical' for something not working; 'other' for anything else), urgency ('low', 'normal' or 'high'), sentiment ('calm', 'frustrated' or 'angry') and the language it is written in as a two-letter code. Do not answer the ticket.",
            maxIterations: 6,
        },
    };

    @node({
        id: 'e65088e4-54ad-4414-a2ce-99369174cf9e',
        name: 'GPT · triage',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1040, 650],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptTriage = {
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
        id: '580993ec-4c30-431e-a3af-15083fb264e3',
        name: 'Triage',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1240, 650],
    })
    Triage = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "topic": "orders",
  "urgency": "normal",
  "sentiment": "calm",
  "language": "en"
}`,
    };

    @node({
        id: '3bd3f21c-d746-463d-a748-1e74a1a98cb1',
        name: 'Apply the triage rules',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1500, 470],
    })
    ApplyTheTriageRules = {
        jsCode: `const t = $("New ticket?").first().json;
const m = $input.first().json.output;
const ok = m && ["orders", "billing", "technical", "other"].includes(m.topic);
const text = (t.subject + " " + t.body).toLowerCase();
// Things a person handles whatever the model made of them.
const human = [];
if (!ok) human.push("triage could not read the ticket");
if (/\\b(lawyer|legal action|sue|chargeback|trading standards|data protection|gdpr|press)\\b/.test(text)) human.push("legal or regulatory language");
if (ok && m.sentiment === "angry") human.push("the customer is angry");
if (t.plan === "enterprise") human.push("enterprise account");
if (ok && m.language && m.language !== "en") human.push("written in " + m.language);
return [{ json: { ...t, topic: ok ? m.topic : "other", urgency: ok ? m.urgency : "normal", sentiment: ok ? m.sentiment : "unknown", straight_to_human: human.length > 0, human_reasons: human } }];`,
    };

    @node({
        id: '4cb81686-d2fb-42f8-a573-d1516b0f7323',
        name: 'Tag the ticket',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [1760, 470],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TagTheTicket = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.ticket_id }}',
        updateFields: {
            tags: ['ai-triaged'],
            internalNote: "={{ 'Triage: ' + $json.topic + ', ' + $json.urgency + ', ' + $json.sentiment }}",
        },
    };

    @node({
        id: 'fb31888b-4f4f-4b32-ab0d-5e673ecee857',
        name: 'Straight to a person?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2020, 470],
    })
    StraightToAPerson = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'a84e04a9-b455-429e-ad85-cbc9ecd51e1c',
                    leftValue: "={{ $('Apply the triage rules').first().json.straight_to_human }}",
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
        id: 'd62275ae-2865-4db4-a21f-6f12f2d1544d',
        name: 'Skip the agents',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2280, 380],
    })
    SkipTheAgents = {
        jsCode: 'return [{ json: $("Apply the triage rules").first().json }];',
    };

    @node({
        id: '4d4cede7-0432-4ff6-ae01-7cd3a6b14cf7',
        name: 'Which specialist?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [2280, 560],
    })
    WhichSpecialist = {
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
                                id: '0810dca3-f5c7-4eec-aff0-e6c17636edb0',
                                leftValue: "={{ $('Apply the triage rules').first().json.topic === 'orders' }}",
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
                    outputKey: 'orders',
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
                                id: '2ed90610-e52e-480c-a19d-ebcd14b13b67',
                                leftValue: "={{ $('Apply the triage rules').first().json.topic === 'billing' }}",
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
                                id: '87602f1c-6593-4793-a005-de0216478b21',
                                leftValue: "={{ $('Apply the triage rules').first().json.topic === 'technical' }}",
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
        id: 'e9ae329a-80e4-45c5-a2ae-c6797baadf50',
        name: 'To the orders agent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2540, 200],
    })
    ToTheOrdersAgent = {
        jsCode: 'return [{ json: $("Apply the triage rules").first().json }];',
    };

    @node({
        id: 'd50148ba-569f-4acd-ae56-5dca13f9b3dd',
        name: 'To the billing agent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2540, 380],
    })
    ToTheBillingAgent = {
        jsCode: 'return [{ json: $("Apply the triage rules").first().json }];',
    };

    @node({
        id: 'a78a6d01-dc68-4e4c-aca5-ce56ae9ccb40',
        name: 'To the technical agent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2540, 560],
    })
    ToTheTechnicalAgent = {
        jsCode: 'return [{ json: $("Apply the triage rules").first().json }];',
    };

    @node({
        id: '08b076f5-dc89-40cc-a78b-1b7e242a210e',
        name: 'To the general agent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2540, 740],
    })
    ToTheGeneralAgent = {
        jsCode: 'return [{ json: $("Apply the triage rules").first().json }];',
    };

    @node({
        id: '7b529563-d0f1-4aa7-a5f3-ef5485bfd1bc',
        name: 'Orders agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [400, 1150],
        onError: 'continueRegularOutput',
    })
    OrdersAgent = {
        promptType: 'define',
        text: "={{ 'Subject: ' + $json.subject + '\\n\\n' + $json.body + '\\n\\nCustomer email: ' + $json.email }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Orders agent. Look the order up in Shopify before saying anything about it. Reply in under 140 words, plain text, signed 'The Acme support team'. State only what a tool returned. If a tool returned nothing useful, set needs_human true and confidence low instead of guessing. Never promise a refund, a date or a discount: describe what you found and what happens next.",
            maxIterations: 6,
        },
    };

    @node({
        id: '9be363aa-f14a-40db-a082-b033e868daee',
        name: 'Claude · orders',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [100, 1370],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeOrders = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'f7c11566-ac12-4123-a09e-724c1f7aecb8',
        name: 'Orders answer',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [300, 1370],
    })
    OrdersAnswer = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "reply": "The reply to the customer.",
  "confidence": 0.85,
  "needs_human": false,
  "facts": [
    "A fact the reply relies on, with where it came from"
  ]
}`,
    };

    @node({
        id: 'd86e7167-71c5-486e-a1db-0f48899f4826',
        name: 'Order lookup',
        type: 'n8n-nodes-base.shopifyTool',
        version: 1,
        position: [500, 1370],
        credentials: { shopifyAccessTokenApi: { id: '__CRED:shopify__', name: 'Shopify' } },
    })
    OrderLookup = {
        descriptionType: 'manual',
        toolDescription: 'Gets one Shopify order by its id: status, fulfilment, tracking and line items.',
        authentication: 'accessToken',
        resource: 'order',
        operation: 'get',
        orderId: "={{ $fromAI('order_id', `The Shopify order id from the ticket`, 'string') }}",
        options: {},
    };

    @node({
        id: 'be84197b-0f6e-4b7b-a4e4-384bbe3fd650',
        name: 'Order history',
        type: 'n8n-nodes-base.supabaseTool',
        version: 1,
        position: [700, 1370],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
    })
    OrderHistory = {
        descriptionType: 'manual',
        toolDescription: "Lists this customer's past orders from the orders table. Pass their email.",
        resource: 'row',
        operation: 'getAll',
        tableId: 'orders',
        returnAll: false,
        limit: 10,
        filterType: 'string',
        filterString: "={{ $fromAI('filter', `A PostgREST filter such as email=eq.ana@example.com`, 'string') }}",
    };

    @node({
        id: 'e5be4a87-fce4-448d-a140-815c08c4a99b',
        name: 'Billing agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [400, 1590],
        onError: 'continueRegularOutput',
    })
    BillingAgent = {
        promptType: 'define',
        text: "={{ 'Subject: ' + $json.subject + '\\n\\n' + $json.body + '\\n\\nCustomer email: ' + $json.email }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Billing agent. Look the charge up in Stripe before saying anything about it. If the customer is asking for money back, do not decide it: describe what you found and set refund to the charge id and the amount in the currency's main unit. A separate policy decides. Reply in under 140 words, plain text, signed 'The Acme support team'. State only what a tool returned. If a tool returned nothing useful, set needs_human true and confidence low instead of guessing. Never promise a refund, a date or a discount: describe what you found and what happens next.",
            maxIterations: 6,
        },
    };

    @node({
        id: '52ea9108-6fb9-4711-a0be-e754ac97c21b',
        name: 'Claude · billing',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [0, 1810],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeBilling = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '42242f90-6d14-45bc-ad8c-faab0d238ebe',
        name: 'Billing answer',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [200, 1810],
    })
    BillingAnswer = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "reply": "The reply to the customer.",
  "confidence": 0.85,
  "needs_human": false,
  "facts": [
    "A fact the reply relies on, with where it came from"
  ],
  "refund": {
    "charge": "ch_123",
    "amount": 0
  }
}`,
    };

    @node({
        id: 'f23ba892-fc49-4cd5-a12e-d0a500080f62',
        name: 'Charge lookup',
        type: 'n8n-nodes-base.stripeTool',
        version: 1,
        position: [400, 1810],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
    })
    ChargeLookup = {
        descriptionType: 'manual',
        toolDescription: 'Gets one Stripe charge by its id: amount, status, date and whether it was refunded.',
        resource: 'charge',
        operation: 'get',
        chargeId: "={{ $fromAI('charge_id', `The Stripe charge id, starting ch_`, 'string') }}",
    };

    @node({
        id: '14281933-c645-4a63-a61c-d4bd5ec9012f',
        name: 'Customer lookup',
        type: 'n8n-nodes-base.stripeTool',
        version: 1,
        position: [600, 1810],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
    })
    CustomerLookup = {
        descriptionType: 'manual',
        toolDescription: 'Gets one Stripe customer by id.',
        resource: 'customer',
        operation: 'get',
        customerId: "={{ $fromAI('customer_id', `The Stripe customer id, starting cus_`, 'string') }}",
    };

    @node({
        id: '405f3f6d-ddb6-4c71-a528-3b0049743881',
        name: 'Days since',
        type: '@n8n/n8n-nodes-langchain.toolCode',
        version: 1.3,
        position: [800, 1810],
    })
    DaysSince = {
        description: 'Returns how many whole days ago an ISO date or a Unix timestamp in seconds was.',
        jsCode: "const t = /^\\d+$/.test(String(query).trim()) ? Number(query) * 1000 : Date.parse(query); if (Number.isNaN(t)) return 'unknown'; return String(Math.floor((Date.now() - t) / 864e5));",
    };

    @node({
        id: '2e78b9ff-4e4f-4f15-abca-e4d4140b99fc',
        name: 'Technical agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [400, 2030],
        onError: 'continueRegularOutput',
    })
    TechnicalAgent = {
        promptType: 'define',
        text: "={{ 'Subject: ' + $json.subject + '\\n\\n' + $json.body + '\\n\\nCustomer email: ' + $json.email }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Technical agent. Search the knowledge base and answer only from what it returns, citing the article titles in facts. Reply in under 140 words, plain text, signed 'The Acme support team'. State only what a tool returned. If a tool returned nothing useful, set needs_human true and confidence low instead of guessing. Never promise a refund, a date or a discount: describe what you found and what happens next.",
            maxIterations: 6,
        },
    };

    @node({
        id: '1928c57d-d38d-415a-a61c-8f7a95e3def7',
        name: 'Claude · technical',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [100, 2250],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeTechnical = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '63621588-ebd5-4703-a5ae-304adb62d281',
        name: 'Technical answer',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [300, 2250],
    })
    TechnicalAnswer = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "reply": "The reply to the customer.",
  "confidence": 0.85,
  "needs_human": false,
  "facts": [
    "A fact the reply relies on, with where it came from"
  ]
}`,
    };

    @node({
        id: '75c5293d-013d-4c14-a1bc-5b71bfd99d7d',
        name: 'Help centre',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [500, 2250],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    HelpCentre = {
        mode: 'retrieve-as-tool',
        toolDescription: 'Search the help centre and troubleshooting guides. Pass a short description of the problem.',
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'kb-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: 'bcda1946-f73b-458c-aeeb-86588c005e0c',
        name: 'Embeddings · help centre',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [500, 2470],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsHelpCentre = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: 'b1e159c3-c12e-49ba-a009-823c8a454fe9',
        name: 'Work it through',
        type: '@n8n/n8n-nodes-langchain.toolThink',
        version: 1,
        position: [700, 2250],
    })
    WorkItThrough = {};

    @node({
        id: '36eab742-64cd-470b-ae86-b5dc3c80951f',
        name: 'General agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [400, 2650],
        onError: 'continueRegularOutput',
    })
    GeneralAgent = {
        promptType: 'define',
        text: "={{ 'Subject: ' + $json.subject + '\\n\\n' + $json.body + '\\n\\nCustomer email: ' + $json.email }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the General agent, for questions that are not about an order, a charge or a fault. Search the knowledge base for policy and how-to answers. Reply in under 140 words, plain text, signed 'The Acme support team'. State only what a tool returned. If a tool returned nothing useful, set needs_human true and confidence low instead of guessing. Never promise a refund, a date or a discount: describe what you found and what happens next.",
            maxIterations: 6,
        },
    };

    @node({
        id: 'ecba4e3e-1f36-472f-a8ce-0240e8c907da',
        name: 'Claude · general',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [200, 2870],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeGeneral = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'e8033c38-43ec-4e3b-a9c3-301e25e48b27',
        name: 'General answer',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [400, 2870],
    })
    GeneralAnswer = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "reply": "The reply to the customer.",
  "confidence": 0.85,
  "needs_human": false,
  "facts": [
    "A fact the reply relies on, with where it came from"
  ]
}`,
    };

    @node({
        id: '6bb4b822-170d-4ebd-a87d-504806119ed3',
        name: 'Policies and guides',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [600, 2870],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    PoliciesAndGuides = {
        mode: 'retrieve-as-tool',
        toolDescription: 'Search company policies, opening hours and how-to guides.',
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'kb-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: '5c417ea0-88ba-46bc-a7e1-78ff5e79e3ae',
        name: 'Embeddings · policies',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [600, 3090],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsPolicies = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: 'd9874466-f036-44f6-a81d-fadb1438877e',
        name: 'Collect the answer',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1060, 2120],
    })
    CollectTheAnswer = {
        jsCode: `const t = $("Apply the triage rules").first().json;
const o = $input.first().json.output;
const ok = o && typeof o.reply === "string" && o.reply.trim().length > 0;
const refund = t.topic === "billing" && o && o.refund && o.refund.charge ? { charge: String(o.refund.charge), amount: Number(o.refund.amount) } : null;
return [{ json: { ...t, reply: ok ? o.reply.trim() : null, confidence: ok ? Number(o.confidence) || 0 : 0, needs_human: !ok || o.needs_human === true, facts: ok ? (o.facts ?? []) : [], refund, agent_failed: !ok } }];`,
    };

    @node({
        id: 'c671a3a5-93ad-4a3c-af39-d62a130dc560',
        name: 'Refund asked for?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [0, 3590],
    })
    RefundAskedFor = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'db3bb622-f33a-4125-a407-d79bb4337cf1',
                    leftValue: '={{ !!$json.refund }}',
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
        id: 'c28564d6-223a-4b66-affe-0fe06243786f',
        name: 'Past refunds',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 3590],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PastRefunds = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'refunds',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
    };

    @node({
        id: '5e6ba887-7d2d-47f5-a192-4f3c2c90433c',
        name: 'Apply the refund policy',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 3590],
    })
    ApplyTheRefundPolicy = {
        jsCode: `const a = $("Collect the answer").first().json;
const past = $input.all().map((i) => i.json).filter((r) => r.email);
const reasons = [];
if (!(a.refund.amount > 0)) reasons.push("no amount could be read");
if (a.refund.amount > 100) reasons.push("over the 100 automatic limit");
if (past.length >= 2) reasons.push("third refund for this customer");
if (past.some((r) => r.charge === a.refund.charge)) reasons.push("this charge was already refunded");
return [{ json: { ...a, refund_ok: reasons.length === 0, refund_reasons: reasons } }];`,
    };

    @node({
        id: '3f96a0a2-3d2d-4cd9-a2d3-edc26feb9074',
        name: 'Inside the policy?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 3590],
    })
    InsideThePolicy = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6511e17d-31ea-4580-a7b2-89071c34d29e',
                    leftValue: '={{ $json.refund_ok }}',
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
        id: 'f47cc760-3fc3-42ae-aced-e92ac7cd8db4',
        name: 'Refund in Stripe',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 3590],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RefundInStripe = {
        method: 'POST',
        url: "={{ 'https://api.stripe.com/v1/refunds' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'stripeApi',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Idempotency-Key',
                    value: "={{ 'refund-' + $json.ticket_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ charge: $json.refund.charge, amount: Math.round($json.refund.amount * 100) }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '9179b82d-4134-4afc-aa72-17c382ca5c3c',
        name: 'Record the refund',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 3500],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheRefund = {
        resource: 'row',
        operation: 'create',
        tableId: 'refunds',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('Inside the policy?').first().json.email }}",
                },
                {
                    fieldId: 'charge',
                    fieldValue: "={{ $('Inside the policy?').first().json.refund.charge }}",
                },
                {
                    fieldId: 'amount',
                    fieldValue: "={{ $('Inside the policy?').first().json.refund.amount }}",
                },
                {
                    fieldId: 'ticket_id',
                    fieldValue: "={{ $('Inside the policy?').first().json.ticket_id }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'b25cc0bc-fec8-4858-ae96-f7cbc5921153',
        name: 'Add the refund to the reply',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 3590],
    })
    AddTheRefundToTheReply = {
        jsCode: `const a = $("Inside the policy?").first().json;
return [{ json: { ...a, reply: a.reply + "\\n\\nWe have refunded " + a.refund.amount.toFixed(2) + " to your original payment method. It usually arrives within 5 to 10 working days.", refunded: true } }];`,
    };

    @node({
        id: '52081b73-bed2-4ea2-ab33-73fc7eb4fd01',
        name: 'Refund needs a person',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 3680],
    })
    RefundNeedsAPerson = {
        jsCode: `const a = $("Collect the answer").first().json;
const why = $input.first().json.refund_reasons ?? ["Stripe could not process the refund"];
return [{ json: { ...a, needs_human: true, human_reasons: ["refund outside the policy: " + why.join(", ")] } }];`,
    };

    @node({
        id: '57a3c7e3-eef5-4fe0-a167-bc9acc30588a',
        name: 'Judge agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [100, 4090],
        onError: 'continueRegularOutput',
    })
    JudgeAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ ticket: { subject: $json.subject, body: $json.body }, reply: $json.reply, facts: $json.facts }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Judge agent. You did not write this reply. Pass it only if every statement in it is supported by the listed facts, it answers what the customer asked, it promises nothing, and the tone is calm and plain. List every problem you find.',
            maxIterations: 6,
        },
    };

    @node({
        id: '7afa5bce-7b49-40ff-a6b7-4ebeab69a8c3',
        name: 'GPT · judging',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [0, 4310],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptJudging = {
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
        id: 'db00854c-ef00-4825-a269-d9d015e7be04',
        name: 'Verdict',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [200, 4310],
    })
    Verdict = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "pass": true,
  "issues": [
    "A specific problem, if any"
  ]
}`,
    };

    @node({
        id: '7d51b218-f146-4d08-a00b-d41014bb7f22',
        name: 'Decide: send or hand over',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 4220],
    })
    DecideSendOrHandOver = {
        jsCode: `const a = $("Add the refund to the reply").isExecuted ? $("Add the refund to the reply").first().json : $("Collect the answer").first().json;
const v = $input.first().json.output;
const judged = v && typeof v.pass === "boolean";
const reasons = [...(a.human_reasons ?? [])];
if (a.needs_human) reasons.push("the specialist asked for a person");
if (a.confidence < 0.75) reasons.push("low confidence (" + a.confidence + ")");
if (!judged) reasons.push("the judge could not be reached");
else if (!v.pass) reasons.push("the judge rejected it: " + (v.issues ?? []).join("; "));
// Checks no model is asked to make.
const reply = String(a.reply ?? "");
if (/guarantee|we promise|definitely will|100%/i.test(reply)) reasons.push("the reply makes a promise");
if (/\\b(?:\\d[ -]?){13,19}\\b/.test(reply)) reasons.push("the reply contains what looks like a card number");
if (reply.split(/\\s+/).filter(Boolean).length > 220) reasons.push("the reply is too long");
return [{ json: { ...a, send: reasons.length === 0, human_reasons: reasons } }];`,
    };

    @node({
        id: '5a2ef8b7-a8f6-42c1-af76-7233558fd91a',
        name: 'Fit to send?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 4220],
    })
    FitToSend = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'eea52163-d725-4acf-a687-9956c1c196b5',
                    leftValue: '={{ $json.send }}',
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
        id: '33ab2d01-f0d2-4c25-a40e-17311f40e071',
        name: 'Send the reply',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [980, 4130],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheReply = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.ticket_id }}',
        updateFields: {
            status: "={{ 'pending' }}",
            publicReply: '={{ $json.reply }}',
            tags: ['ai-answered'],
        },
    };

    @node({
        id: '56529c73-ea86-43f6-a0df-05f713d42807',
        name: 'Log: answered',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1240, 4130],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogAnswered = {
        resource: 'row',
        operation: 'create',
        tableId: 'support_log',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'ticket_id',
                    fieldValue: "={{ $('Fit to send?').first().json.ticket_id }}",
                },
                {
                    fieldId: 'topic',
                    fieldValue: "={{ $('Fit to send?').first().json.topic }}",
                },
                {
                    fieldId: 'question',
                    fieldValue: "={{ $('Fit to send?').first().json.subject }}",
                },
                {
                    fieldId: 'reply',
                    fieldValue: "={{ $('Fit to send?').first().json.reply }}",
                },
                {
                    fieldId: 'answered',
                    fieldValue: '={{ true }}',
                },
                {
                    fieldId: 'confidence',
                    fieldValue: "={{ $('Fit to send?').first().json.confidence }}",
                },
                {
                    fieldId: 'refunded',
                    fieldValue: "={{ $('Fit to send?').first().json.refunded === true }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '4a56ed06-d6c9-44b3-a8ee-bade46235158',
        name: 'Write the handover',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [980, 4310],
    })
    WriteTheHandover = {
        jsCode: `const t = $input.first().json;
const reasons = t.human_reasons ?? [];
const draft = t.reply ? "\\n\\nDraft the agents wrote (not sent):\\n" + t.reply : "";
const facts = (t.facts ?? []).length ? "\\n\\nWhat was found:\\n- " + t.facts.join("\\n- ") : "";
return [{ json: { ticket_id: t.ticket_id, topic: t.topic, subject: t.subject, urgency: t.urgency ?? "normal", confidence: t.confidence ?? 0, reasons, note: "Handed to a person because: " + reasons.join("; ") + "." + facts + draft } }];`,
    };

    @node({
        id: '47fd7279-1645-4b65-addc-3ee89a464889',
        name: 'Assign to the team',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [1240, 4310],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AssignToTheTeam = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.ticket_id }}',
        updateFields: {
            status: "={{ 'open' }}",
            priority: "={{ $json.urgency === 'high' ? 'urgent' : 'normal' }}",
            internalNote: '={{ $json.note }}',
            tags: ['needs-human'],
        },
    };

    @node({
        id: 'a0c8731a-f9ff-4e05-aace-cdb5622fe6a9',
        name: 'Log: handed over',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1500, 4220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogHandedOver = {
        resource: 'row',
        operation: 'create',
        tableId: 'support_log',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'ticket_id',
                    fieldValue: "={{ $('Write the handover').first().json.ticket_id }}",
                },
                {
                    fieldId: 'topic',
                    fieldValue: "={{ $('Write the handover').first().json.topic }}",
                },
                {
                    fieldId: 'question',
                    fieldValue: "={{ $('Write the handover').first().json.subject }}",
                },
                {
                    fieldId: 'answered',
                    fieldValue: '={{ false }}',
                },
                {
                    fieldId: 'reasons',
                    fieldValue: "={{ $('Write the handover').first().json.reasons }}",
                },
                {
                    fieldId: 'confidence',
                    fieldValue: "={{ $('Write the handover').first().json.confidence }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '1fa92d72-0067-407b-af4b-b2e213703129',
        name: 'Handover message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1760, 4220],
    })
    HandoverMessage = {
        jsCode: `const h = $("Write the handover").first().json;
return [{ json: { channel: "#support", level: h.urgency === "high" ? "critical" : "warn", text: "Ticket #" + h.ticket_id + " (" + h.topic + ") needs a person: " + h.reasons.join("; ") + "." } }];`,
    };

    @node({
        id: 'fbaa47b7-c87e-4f42-a587-0a4aee55e9df',
        name: 'Tell the support team',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2020, 4220],
    })
    TellTheSupportTeam = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '5512c8e8-c472-4d3f-a787-85856f2d873c',
        name: 'Every 10 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 4760],
    })
    Every10Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 10,
                },
            ],
        },
    };

    @node({
        id: 'f99506e9-c578-40cd-abd9-d3a2247ab45b',
        name: 'Open, unanswered tickets',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [260, 4760],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenUnansweredTickets = {
        resource: 'ticket',
        operation: 'getAll',
        returnAll: true,
        options: {
            query: "={{ 'status:open tags:needs-human' }}",
        },
    };

    @node({
        id: '565f8983-9ca3-41ce-abf8-abc0676a9f62',
        name: 'Measure against the SLA',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 4760],
    })
    MeasureAgainstTheSla = {
        jsCode: `const SLA = { urgent: 30, high: 120, normal: 480, low: 1440 }; // minutes
const now = Date.now();
return $input.all().map((i) => i.json).filter((t) => t.id && t.created_at).map((t) => {
  const limit = SLA[t.priority] ?? SLA.normal;
  const waited = Math.floor((now - new Date(t.created_at).getTime()) / 60000);
  const stage = waited >= limit ? "breached" : waited >= limit * 0.75 ? "at_risk" : "ok";
  const last = (t.tags ?? []).includes("sla-breached") ? "breached" : (t.tags ?? []).includes("sla-at-risk") ? "at_risk" : "ok";
  return { id: String(t.id), subject: t.subject, waited, limit, stage, last };
}).filter((t) => t.stage !== "ok" && t.stage !== t.last).map((json) => ({ json }));`,
    };

    @node({
        id: '3d005afc-6ece-4a0f-acb2-5fd5593a7891',
        name: 'Mark the stage',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [780, 4760],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkTheStage = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.id }}',
        updateFields: {
            tags: ["={{ $json.stage === 'breached' ? 'sla-breached' : 'sla-at-risk' }}"],
        },
    };

    @node({
        id: '7a2cd8ea-12f7-44e2-aa00-6a9dec8557e3',
        name: 'SLA message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 4760],
    })
    SlaMessage = {
        jsCode: `const before = $("Measure against the SLA").all();
return $input.all().map((_, i) => { const t = before[i].json; return { json: { channel: "#support", level: t.stage === "breached" ? "critical" : "warn", text: t.stage === "breached" ? "Response time missed on #" + t.id + ": waited " + t.waited + " min (limit " + t.limit + ")." : "Response time at risk on #" + t.id + ": " + (t.limit - t.waited) + " min left." } }; });`,
    };

    @node({
        id: '79297600-2ab2-421e-a7b0-1599c703d0f0',
        name: 'Raise the SLA',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1300, 4760],
    })
    RaiseTheSla = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'a0b6c08b-1e06-4661-a2fc-5be8da256069',
        name: '02:00 nightly',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 5300],
    })
    _0200Nightly = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 2 * * *',
                },
            ],
        },
    };

    @node({
        id: 'bbc94dbb-81ce-4e2f-a1cc-9476dbb32e7d',
        name: "Yesterday's answers",
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 5300],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    YesterdaySAnswers = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'support_log',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'answered=eq.true&at=gte.' + $now.minus({ days: 1 }).toISO() }}",
    };

    @node({
        id: '366eb9b2-3853-4891-ac71-a5499e66b51d',
        name: 'Take a sample',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 5300],
    })
    TakeASample = {
        jsCode: `// Every answer that moved money, plus up to eight of the rest.
const rows = $input.all().map((i) => i.json).filter((r) => r.ticket_id && r.reply);
const refunded = rows.filter((r) => r.refunded);
const rest = rows.filter((r) => !r.refunded).sort((a, b) => String(a.ticket_id).localeCompare(String(b.ticket_id))).slice(0, 8);
return [...refunded, ...rest].map((json) => ({ json }));`,
    };

    @node({
        id: 'be979adc-c814-4342-ab7d-2589a5627669',
        name: 'Auditor agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [880, 5170],
        onError: 'continueRegularOutput',
    })
    AuditorAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ question: $json.question, reply: $json.reply, topic: $json.topic }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Auditor agent. Grade a support reply that has already been sent, from 1 to 5: was it correct for the question, complete, and honest about what it did not know? Name the single most important thing to fix, or 'nothing'.",
            maxIterations: 6,
        },
    };

    @node({
        id: '054e00b6-96f9-4e5b-a27c-7e043f5625a9',
        name: 'Claude · auditing',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [780, 5390],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeAuditing = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'e1e83be0-77a6-454f-ab75-b19b539a9a2e',
        name: 'Grade',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [980, 5390],
    })
    Grade = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "grade": 4,
  "fix": "nothing"
}`,
    };

    @node({
        id: 'ac399a73-d477-4fe8-a4cd-c5d2e368e5ce',
        name: 'Gather the grades',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1240, 5300],
    })
    GatherTheGrades = {
        jsCode: `const sample = $("Take a sample").all().map((i) => i.json);
const graded = $input.all().map((item, i) => ({ ticket_id: sample[i]?.ticket_id, topic: sample[i]?.topic, grade: Number(item.json.output?.grade), fix: item.json.output?.fix ?? null })).filter((g) => g.ticket_id && g.grade >= 1 && g.grade <= 5);
const poor = graded.filter((g) => g.grade <= 2);
const average = graded.length ? Math.round((graded.reduce((s, g) => s + g.grade, 0) / graded.length) * 10) / 10 : null;
return [{ json: { audited: graded.length, average, poor, text: graded.length ? "Audited " + graded.length + " answers from yesterday, average " + average + "/5." + (poor.length ? " Poor: " + poor.map((p) => "#" + p.ticket_id + " (" + p.fix + ")").join("; ") : " None graded 2 or under.") : "No answers to audit yesterday." } }];`,
    };

    @node({
        id: '306a4bf9-93ab-4507-acc3-1d6f49b70232',
        name: 'Save the audit',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1500, 5300],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheAudit = {
        resource: 'row',
        operation: 'create',
        tableId: 'support_audits',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'audited',
                    fieldValue: '={{ $json.audited }}',
                },
                {
                    fieldId: 'average',
                    fieldValue: '={{ $json.average }}',
                },
                {
                    fieldId: 'poor',
                    fieldValue: '={{ $json.poor }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'cb6b0664-a9fb-4c63-a3b4-eabc162f93c2',
        name: 'Post the audit',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1760, 5300],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheAudit = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#support' }}",
        },
        text: "={{ ':mag: ' + $('Gather the grades').first().json.text }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '9500b0ef-63d3-432d-ad99-6404694218f2',
        name: 'Monday 08:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 6060],
    })
    Monday0800 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 8 * * 1',
                },
            ],
        },
    };

    @node({
        id: '083627cc-1330-4cbd-a009-4b54ce4394c4',
        name: 'Handed over last week',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 6060],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    HandedOverLastWeek = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'support_log',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'answered=eq.false&at=gte.' + $now.minus({ days: 7 }).toISO() }}",
    };

    @node({
        id: '1c1130c6-1ba1-4437-a512-3793434d9bef',
        name: 'Gather the questions',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 6060],
    })
    GatherTheQuestions = {
        jsCode: `const rows = $input.all().map((i) => i.json).filter((r) => r.question);
return [{ json: { count: rows.length, questions: rows.slice(0, 80).map((r) => "- [" + r.topic + "] " + String(r.question).slice(0, 160) + " (" + (r.reasons ?? []).join(", ") + ")").join("\\n") } }];`,
    };

    @node({
        id: '587171d7-42ca-42a7-ad21-82fd68b5f393',
        name: 'Any gaps?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 6060],
    })
    AnyGaps = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'a2745c57-5fa1-4165-a27c-689389e72115',
                    leftValue: '={{ $json.count > 0 }}',
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
        id: 'e3aa32cb-7749-4b57-af1d-0eb3436591f6',
        name: 'Gaps agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1040, 5840],
        onError: 'continueRegularOutput',
    })
    GapsAgent = {
        promptType: 'define',
        text: '={{ $json.questions }}',
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the Gaps agent. Group these tickets the agents could not answer into at most five themes. For each, give the theme, how many tickets, and the one change that would let an agent answer next time: a help article to write, a tool to add, or a policy to clarify. Plain text, no preamble.',
            maxIterations: 6,
        },
    };

    @node({
        id: '1c01b170-080b-45fb-abdd-c7f1e0d993de',
        name: 'Claude · gaps',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1040, 6060],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeGaps = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '47bb48df-9d7a-4101-a835-27932a6833a0',
        name: 'Post the gaps',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1300, 6060],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheGaps = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#support' }}",
        },
        text: "={{ ':books: ' + $('Gather the questions').first().json.count + ' tickets went to a person last week.\\n' + ($json.output ?? $('Gather the questions').first().json.questions) }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'd0c2a49d-853d-483a-a1f0-0c7cd3404368',
        name: 'Post all clear',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1040, 6280],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostAllClear = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#support' }}",
        },
        text: "={{ ':white_check_mark: The agents answered every ticket they were given last week.' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'ae0d589d-7e9a-4c3e-a79e-8c7b296d56f1',
        webhookId: '11f1c370-ec16-4264-a336-8cc3bac95932',
        name: 'Survey answered',
        type: 'n8n-nodes-base.typeformTrigger',
        version: 1.1,
        position: [0, 6910],
        credentials: { typeformApi: { id: '__CRED:typeform__', name: 'Typeform' } },
    })
    SurveyAnswered = {
        authentication: 'accessToken',
        formId: 'csat-form',
        simplifyAnswers: true,
        onlyAnswers: false,
    };

    @node({
        id: '86d4c1b3-9f96-4477-a804-b0c3db3a9978',
        name: 'Read the survey',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 6910],
    })
    ReadTheSurvey = {
        jsCode: `return $input.all().map((item) => {
  const s = item.json;
  const score = Number(s.score ?? s["How did we do?"]);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("Score must be 1 to 5");
  return { json: { ticket_id: String(s.ticket_id ?? ""), email: String(s.email ?? "").toLowerCase(), score, comment: String(s.comment ?? "").slice(0, 1000) } };
});`,
    };

    @node({
        id: 'cd9e8122-1550-4f23-a822-bb7e7a0d1a6a',
        name: 'Record the score',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 6910],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheScore = {
        resource: 'row',
        operation: 'create',
        tableId: 'csat',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'ticket_id',
                    fieldValue: '={{ $json.ticket_id }}',
                },
                {
                    fieldId: 'email',
                    fieldValue: '={{ $json.email }}',
                },
                {
                    fieldId: 'score',
                    fieldValue: '={{ $json.score }}',
                },
                {
                    fieldId: 'comment',
                    fieldValue: '={{ $json.comment }}',
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '9bdc7e4e-9c9d-491d-a009-0f2aace6c0ef',
        name: 'Unhappy?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 6910],
    })
    Unhappy = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'ad1b6d91-a4e4-4fe5-a405-8d6946636c0f',
                    leftValue: "={{ $('Read the survey').first().json.score <= 2 }}",
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
        id: '3b227fb1-4f63-44a8-a6ba-ee31bb278374',
        name: 'Recovery agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1040, 6690],
        onError: 'continueRegularOutput',
    })
    RecoveryAgent = {
        promptType: 'define',
        text: "={{ 'Score: ' + $('Read the survey').first().json.score + '/5\\nComment: ' + ($('Read the survey').first().json.comment || '(none)') }}",
        hasOutputParser: false,
        options: {
            systemMessage:
                'You are the Recovery agent. A customer rated their support 1 or 2 out of 5. Draft a short, personal note a human support lead could send: acknowledge what went wrong in their words, do not make excuses, do not offer compensation, and ask one question that would help put it right. Under 90 words. This is a draft for a person, never sent by you.',
            maxIterations: 6,
        },
    };

    @node({
        id: '358db0b1-e88a-4656-a078-839b52915c48',
        name: 'Claude · recovery',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1040, 6910],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeRecovery = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '14437b8a-e865-4550-a77e-3df3765e598d',
        name: 'Open a follow-up',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [1300, 6910],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenAFollowUp = {
        resource: 'ticket',
        operation: 'create',
        description:
            "={{ 'Rated ' + $('Read the survey').first().json.score + '/5. ' + $('Read the survey').first().json.comment + '\\n\\nDraft reply for you to edit:\\n' + ($json.output ?? '(no draft: the agent was unavailable)') }}",
        additionalFields: {
            subject: "={{ 'Unhappy after ticket #' + $('Read the survey').first().json.ticket_id }}",
            tags: ['csat-recovery'],
        },
    };

    @node({
        id: '89de1513-dcb5-4d3b-a999-e62acf418562',
        name: 'Unhappy message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 6910],
    })
    UnhappyMessage = {
        jsCode: `const s = $("Read the survey").first().json;
return [{ json: { channel: "#support", level: "warn", text: s.email + " rated ticket #" + s.ticket_id + " " + s.score + "/5" + (s.comment ? ": \\"" + s.comment.slice(0, 200) + "\\"" : "") + ". A follow-up ticket is open with a draft reply." } }];`,
    };

    @node({
        id: 'd57f4953-4fd6-4e75-a3d4-4e26368dde78',
        name: 'Tell the support lead',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1820, 6910],
    })
    TellTheSupportLead = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'de6f846f-dd7c-4d3c-adab-de4e1cc819e5',
        name: 'Recorded',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 7130],
    })
    Recorded = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.NewTicket.out(0).to(this.ReadTheTicket.in(0));
        this.ReadTheTicket.out(0).to(this.SeenThisTicket.in(0));
        this.SeenThisTicket.out(0).to(this.NewTicket1.in(0));
        this.NewTicket1.out(0).to(this.TriageAgent.in(0));
        this.NewTicket1.out(1).to(this.AlreadyHandled.in(0));
        this.TriageAgent.out(0).to(this.ApplyTheTriageRules.in(0));
        this.ApplyTheTriageRules.out(0).to(this.TagTheTicket.in(0));
        this.TagTheTicket.out(0).to(this.StraightToAPerson.in(0));
        this.StraightToAPerson.out(0).to(this.SkipTheAgents.in(0));
        this.StraightToAPerson.out(1).to(this.WhichSpecialist.in(0));
        this.SkipTheAgents.out(0).to(this.WriteTheHandover.in(0));
        this.WhichSpecialist.out(0).to(this.ToTheOrdersAgent.in(0));
        this.WhichSpecialist.out(1).to(this.ToTheBillingAgent.in(0));
        this.WhichSpecialist.out(2).to(this.ToTheTechnicalAgent.in(0));
        this.WhichSpecialist.out(3).to(this.ToTheGeneralAgent.in(0));
        this.ToTheOrdersAgent.out(0).to(this.OrdersAgent.in(0));
        this.OrdersAgent.out(0).to(this.CollectTheAnswer.in(0));
        this.ToTheBillingAgent.out(0).to(this.BillingAgent.in(0));
        this.BillingAgent.out(0).to(this.CollectTheAnswer.in(0));
        this.ToTheTechnicalAgent.out(0).to(this.TechnicalAgent.in(0));
        this.TechnicalAgent.out(0).to(this.CollectTheAnswer.in(0));
        this.ToTheGeneralAgent.out(0).to(this.GeneralAgent.in(0));
        this.GeneralAgent.out(0).to(this.CollectTheAnswer.in(0));
        this.CollectTheAnswer.out(0).to(this.RefundAskedFor.in(0));
        this.RefundAskedFor.out(0).to(this.PastRefunds.in(0));
        this.RefundAskedFor.out(1).to(this.JudgeAgent.in(0));
        this.PastRefunds.out(0).to(this.ApplyTheRefundPolicy.in(0));
        this.ApplyTheRefundPolicy.out(0).to(this.InsideThePolicy.in(0));
        this.InsideThePolicy.out(0).to(this.RefundInStripe.in(0));
        this.InsideThePolicy.out(1).to(this.RefundNeedsAPerson.in(0));
        this.RefundInStripe.out(0).to(this.RecordTheRefund.in(0));
        this.RefundInStripe.out(1).to(this.RefundNeedsAPerson.in(0));
        this.RecordTheRefund.out(0).to(this.AddTheRefundToTheReply.in(0));
        this.AddTheRefundToTheReply.out(0).to(this.JudgeAgent.in(0));
        this.RefundNeedsAPerson.out(0).to(this.WriteTheHandover.in(0));
        this.JudgeAgent.out(0).to(this.DecideSendOrHandOver.in(0));
        this.DecideSendOrHandOver.out(0).to(this.FitToSend.in(0));
        this.FitToSend.out(0).to(this.SendTheReply.in(0));
        this.FitToSend.out(1).to(this.WriteTheHandover.in(0));
        this.SendTheReply.out(0).to(this.LogAnswered.in(0));
        this.WriteTheHandover.out(0).to(this.AssignToTheTeam.in(0));
        this.AssignToTheTeam.out(0).to(this.LogHandedOver.in(0));
        this.LogHandedOver.out(0).to(this.HandoverMessage.in(0));
        this.HandoverMessage.out(0).to(this.TellTheSupportTeam.in(0));
        this.Every10Minutes.out(0).to(this.OpenUnansweredTickets.in(0));
        this.OpenUnansweredTickets.out(0).to(this.MeasureAgainstTheSla.in(0));
        this.MeasureAgainstTheSla.out(0).to(this.MarkTheStage.in(0));
        this.MarkTheStage.out(0).to(this.SlaMessage.in(0));
        this.SlaMessage.out(0).to(this.RaiseTheSla.in(0));
        this._0200Nightly.out(0).to(this.YesterdaySAnswers.in(0));
        this.YesterdaySAnswers.out(0).to(this.TakeASample.in(0));
        this.TakeASample.out(0).to(this.AuditorAgent.in(0));
        this.AuditorAgent.out(0).to(this.GatherTheGrades.in(0));
        this.GatherTheGrades.out(0).to(this.SaveTheAudit.in(0));
        this.SaveTheAudit.out(0).to(this.PostTheAudit.in(0));
        this.Monday0800.out(0).to(this.HandedOverLastWeek.in(0));
        this.HandedOverLastWeek.out(0).to(this.GatherTheQuestions.in(0));
        this.GatherTheQuestions.out(0).to(this.AnyGaps.in(0));
        this.AnyGaps.out(0).to(this.GapsAgent.in(0));
        this.AnyGaps.out(1).to(this.PostAllClear.in(0));
        this.GapsAgent.out(0).to(this.PostTheGaps.in(0));
        this.SurveyAnswered.out(0).to(this.ReadTheSurvey.in(0));
        this.ReadTheSurvey.out(0).to(this.RecordTheScore.in(0));
        this.RecordTheScore.out(0).to(this.Unhappy.in(0));
        this.Unhappy.out(0).to(this.RecoveryAgent.in(0));
        this.Unhappy.out(1).to(this.Recorded.in(0));
        this.RecoveryAgent.out(0).to(this.OpenAFollowUp.in(0));
        this.OpenAFollowUp.out(0).to(this.UnhappyMessage.in(0));
        this.UnhappyMessage.out(0).to(this.TellTheSupportLead.in(0));

        this.TriageAgent.uses({
            ai_languageModel: this.GptTriage.output,
            ai_outputParser: this.Triage.output,
        });
        this.OrdersAgent.uses({
            ai_languageModel: this.ClaudeOrders.output,
            ai_outputParser: this.OrdersAnswer.output,
            ai_tool: [this.OrderLookup.output, this.OrderHistory.output],
        });
        this.BillingAgent.uses({
            ai_languageModel: this.ClaudeBilling.output,
            ai_outputParser: this.BillingAnswer.output,
            ai_tool: [this.ChargeLookup.output, this.CustomerLookup.output, this.DaysSince.output],
        });
        this.TechnicalAgent.uses({
            ai_languageModel: this.ClaudeTechnical.output,
            ai_outputParser: this.TechnicalAnswer.output,
            ai_tool: [this.HelpCentre.output, this.WorkItThrough.output],
        });
        this.HelpCentre.uses({
            ai_embedding: this.EmbeddingsHelpCentre.output,
        });
        this.GeneralAgent.uses({
            ai_languageModel: this.ClaudeGeneral.output,
            ai_outputParser: this.GeneralAnswer.output,
            ai_tool: [this.PoliciesAndGuides.output],
        });
        this.PoliciesAndGuides.uses({
            ai_embedding: this.EmbeddingsPolicies.output,
        });
        this.JudgeAgent.uses({
            ai_languageModel: this.GptJudging.output,
            ai_outputParser: this.Verdict.output,
        });
        this.AuditorAgent.uses({
            ai_languageModel: this.ClaudeAuditing.output,
            ai_outputParser: this.Grade.output,
        });
        this.GapsAgent.uses({
            ai_languageModel: this.ClaudeGaps.output,
        });
        this.RecoveryAgent.uses({
            ai_languageModel: this.ClaudeRecovery.output,
        });
    }
}
