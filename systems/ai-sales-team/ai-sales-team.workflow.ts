import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI sales team · Research, outreach and replies
// Nodes   : 109  |  Connections: 82
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionANewLeadResearchScoreStart  stickyNote
// SectionOutreachWriteReviewSend     stickyNote
// SectionRepliesReadDecideAct        stickyNote
// SectionWeeklyReport                stickyNote
// NewLeadForm                        typeformTrigger            [creds]
// ReadTheForm                        code
// SeenThisLead                       executeWorkflow
// NewLead                            if
// AlreadyInASequence                 noOp
// EnrichThePerson                    clearbit                   [onError→regular] [creds]
// SearchCompanyNews                  httpRequest                [onError→regular] [creds]
// BuildTheDossier                    code
// ResearchAgent                      agent                      [AI] [onError→regular]
// ClaudeResearch                     lmChatAnthropic            [creds] [ai_languageModel]
// Scratchpad                         toolThink                  [ai_tool]
// CompanySizeBand                    toolCode                   [ai_tool]
// ResearchBrief                      outputParserStructured     [ai_outputParser]
// AttachTheResearch                  code
// ScoringAgent                       agent                      [AI] [onError→regular]
// GptScoring                         lmChatOpenAi               [creds] [ai_languageModel]
// Score                              outputParserStructured     [ai_outputParser]
// ApplyTheIcpRules                   code
// WhichPath                          switch
// CreateHubspotContact               hubspot                    [onError→out(1)] [creds] [retry]
// StartTheSequence                   supabase                   [creds] [retry]
// QualifiedMessage                   code
// TellSales                          executeWorkflow
// LostContactPayload                 code
// ParkForReplay                      executeWorkflow
// AddToTheNewsletter                 mailchimp                  [onError→regular] [creds] [retry]
// RecordAsNurture                    supabase                   [creds] [retry]
// NeedsALookMessage                  code
// AskSalesToLook                     executeWorkflow
// EveryHour                          scheduleTrigger
// DueSequences                       supabase                   [creds] [alwaysOutput] [retry]
// CapTheRun                          code
// TouchesLeft                        if
// CloseTheSequence                   supabase                   [creds] [alwaysOutput] [retry]
// OneLeadAtATime                     splitInBatches
// OutreachDone                       noOp
// EarlierMessages                    supabase                   [creds] [alwaysOutput] [retry]
// BriefTheWriter                     code
// WriterAgent                        agent                      [AI] [onError→regular]
// ClaudeWriting                      lmChatAnthropic            [creds] [ai_languageModel]
// CaseStudies                        vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsCaseStudies              embeddingsOpenAi           [creds] [ai_embedding]
// EmailDraft                         outputParserStructured     [ai_outputParser]
// ReadTheDraft                       code
// ReviewerAgent                      agent                      [AI] [onError→regular]
// GptReview                          lmChatOpenAi               [creds] [ai_languageModel]
// Review                             outputParserStructured     [ai_outputParser]
// CheckItInCodeToo                   code
// Approved                           if
// SendTheEmail                       sendGrid                   [creds] [retry]
// LogTheMessage                      supabase                   [creds] [retry]
// AdvanceTheSequence                 supabase                   [creds] [alwaysOutput] [retry]
// NoteOnTheContact                   hubspot                    [onError→regular] [creds] [retry]
// FirstAttempt                       if
// ReviserAgent                       agent                      [AI] [onError→regular]
// ClaudeRevising                     lmChatAnthropic            [creds] [ai_languageModel]
// RevisedDraft                       outputParserStructured     [ai_outputParser]
// RecheckInCode                      code
// PassesNow                          if
// HumanReviewMessage                 code
// SendToAPerson                      executeWorkflow
// PauseForReview                     supabase                   [creds] [alwaysOutput] [retry]
// ReplyReceived                      gmailTrigger               [creds]
// ReadTheReply                       code
// FindTheSequence                    supabase                   [creds] [alwaysOutput] [retry]
// OneOfOurs                          if
// NotALeadLeaveIt                    noOp
// ReplyClassifier                    agent                      [AI] [onError→regular]
// GptClassifying                     lmChatOpenAi               [creds] [ai_languageModel]
// Intent                             outputParserStructured     [ai_outputParser]
// ReadTheIntent                      code
// WhatDoTheyWant                     switch
// BookingAgent                       agent                      [AI] [onError→regular]
// ClaudeBooking                      lmChatAnthropic            [creds] [ai_languageModel]
// FreeSlots                          googleCalendarTool         [creds] [ai_tool]
// ProposedTimes                      outputParserStructured     [ai_outputParser]
// GotThreeTimes                      if
// ReplyWithTimes                     gmail                      [creds] [retry]
// MarkAsMeetingProposed              supabase                   [creds] [alwaysOutput] [retry]
// OpenADeal                          hubspot                    [onError→regular] [creds] [retry]
// InterestedMessage                  code
// TellTheOwner                       executeWorkflow
// ObjectionAgent                     agent                      [AI] [onError→regular]
// ClaudeObjections                   lmChatAnthropic            [creds] [ai_languageModel]
// ProductAnswers                     vectorStorePinecone        [AI] [creds] [ai_tool]
// EmbeddingsAnswers                  embeddingsOpenAi           [creds] [ai_embedding]
// Answer                             outputParserStructured     [ai_outputParser]
// ConfidentAnswer                    if
// AnswerTheObjection                 gmail                      [creds] [retry]
// KeepTheSequenceGoing               supabase                   [creds] [alwaysOutput] [retry]
// HandOverMessage                    code
// HandToAPerson                      executeWorkflow
// PauseNeedsAPerson                  supabase                   [creds] [alwaysOutput] [retry]
// SnoozeFor30Days                    supabase                   [creds] [alwaysOutput] [retry]
// StopTheSequence                    supabase                   [creds] [alwaysOutput] [retry]
// MarkOptedOutInHubspot              hubspot                    [onError→regular] [creds] [retry]
// PushTheNextTouchAWeek              supabase                   [creds] [alwaysOutput] [retry]
// Monday0800                         scheduleTrigger
// ThisWeekSMessages                  supabase                   [creds] [alwaysOutput] [retry]
// AllSequences                       supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// CountTheFunnel                     code
// AnalystAgent                       agent                      [AI] [onError→regular]
// ClaudeAnalysis                     lmChatAnthropic            [creds] [ai_languageModel]
// PostTheWeeklyReport                slack                      [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// NewLeadForm
//    → ReadTheForm
//      → SeenThisLead
//        → NewLead
//          → EnrichThePerson
//            → SearchCompanyNews
//              → BuildTheDossier
//                → ResearchAgent
//                  → AttachTheResearch
//                    → ScoringAgent
//                      → ApplyTheIcpRules
//                        → WhichPath
//                          → CreateHubspotContact
//                            → StartTheSequence
//                              → QualifiedMessage
//                                → TellSales
//                           .out(1) → LostContactPayload
//                              → ParkForReplay
//                         .out(1) → AddToTheNewsletter
//                            → RecordAsNurture
//                         .out(2) → NeedsALookMessage
//                            → AskSalesToLook
//         .out(1) → AlreadyInASequence
// EveryHour
//    → DueSequences
//      → CapTheRun
//        → TouchesLeft
//          → OneLeadAtATime
//            → OutreachDone
//           .out(1) → EarlierMessages
//              → BriefTheWriter
//                → WriterAgent
//                  → ReadTheDraft
//                    → ReviewerAgent
//                      → CheckItInCodeToo
//                        → Approved
//                          → SendTheEmail
//                            → LogTheMessage
//                              → AdvanceTheSequence
//                                → NoteOnTheContact
//                                  → OneLeadAtATime (↩ loop)
//                         .out(1) → FirstAttempt
//                            → ReviserAgent
//                              → RecheckInCode
//                                → PassesNow
//                                  → SendTheEmail (↩ loop)
//                                 .out(1) → HumanReviewMessage
//                                    → SendToAPerson
//                                      → PauseForReview
//                                        → OneLeadAtATime (↩ loop)
//                           .out(1) → HumanReviewMessage (↩ loop)
//         .out(1) → CloseTheSequence
// ReplyReceived
//    → ReadTheReply
//      → FindTheSequence
//        → OneOfOurs
//          → ReplyClassifier
//            → ReadTheIntent
//              → WhatDoTheyWant
//                → BookingAgent
//                  → GotThreeTimes
//                    → ReplyWithTimes
//                      → MarkAsMeetingProposed
//                        → OpenADeal
//                          → InterestedMessage
//                            → TellTheOwner
//                   .out(1) → HandOverMessage
//                      → HandToAPerson
//                        → PauseNeedsAPerson
//               .out(1) → ObjectionAgent
//                  → ConfidentAnswer
//                    → AnswerTheObjection
//                      → KeepTheSequenceGoing
//                   .out(1) → HandOverMessage (↩ loop)
//               .out(2) → SnoozeFor30Days
//               .out(3) → StopTheSequence
//                  → MarkOptedOutInHubspot
//               .out(4) → PushTheNextTouchAWeek
//               .out(5) → HandOverMessage (↩ loop)
//         .out(1) → NotALeadLeaveIt
// Monday0800
//    → ThisWeekSMessages
//      → AllSequences
//        → CountTheFunnel
//          → AnalystAgent
//            → PostTheWeeklyReport
//
// AI CONNECTIONS
// ResearchAgent.uses({ ai_languageModel: ClaudeResearch, ai_tool: [Scratchpad, CompanySizeBand], ai_outputParser: ResearchBrief })
// ScoringAgent.uses({ ai_languageModel: GptScoring, ai_outputParser: Score })
// WriterAgent.uses({ ai_languageModel: ClaudeWriting, ai_tool: [CaseStudies], ai_outputParser: EmailDraft })
// CaseStudies.uses({ ai_embedding: EmbeddingsCaseStudies })
// ReviewerAgent.uses({ ai_languageModel: GptReview, ai_outputParser: Review })
// ReviserAgent.uses({ ai_languageModel: ClaudeRevising, ai_outputParser: RevisedDraft })
// ReplyClassifier.uses({ ai_languageModel: GptClassifying, ai_outputParser: Intent })
// BookingAgent.uses({ ai_languageModel: ClaudeBooking, ai_tool: [FreeSlots], ai_outputParser: ProposedTimes })
// ObjectionAgent.uses({ ai_languageModel: ClaudeObjections, ai_tool: [ProductAnswers], ai_outputParser: Answer })
// ProductAnswers.uses({ ai_embedding: EmbeddingsAnswers })
// AnalystAgent.uses({ ai_languageModel: ClaudeAnalysis })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'AI sales team · Research, outreach and replies',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class AiSalesTeamResearchOutreachAndRepliesWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '37c60c08-b01c-4db7-a35f-38fa0b5ca388',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## AI sales team · Research, outreach and replies
Seven agents run outbound end to end: research each new lead, score it, write and review every email, read the replies, propose meeting times and answer objections from the case studies. A person is asked whenever an agent is unsure.

**Platforms:** Typeform, Clearbit, SerpAPI, Claude, OpenAI, HubSpot, Supabase, Mailchimp, Pinecone, SendGrid, Gmail, Google Calendar, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/ai-sales-team\``,
    };

    @node({
        id: 'ebcd0dc5-7214-4e83-a7dc-e243372fd6ea',
        name: 'Section: A new lead: research, score, start',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionANewLeadResearchScoreStart = {
        width: 5080,
        height: 870,
        color: 4,
        content: `## 1. A new lead: research, score, start
Typeform in. Clearbit and SerpAPI gather facts, two agents read them, and code applies the rules a model may not overrule.`,
    };

    @node({
        id: 'dfb4cb04-caf6-499c-a1a2-6dfecc438837',
        name: 'Section: Outreach: write, review, send',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 950],
    })
    SectionOutreachWriteReviewSend = {
        width: 6120,
        height: 770,
        color: 5,
        content: `## 2. Outreach: write, review, send
Hourly. One agent writes, a second one reviews, code checks both. A rejected email gets one rewrite, then a person.`,
    };

    @node({
        id: '9afcf236-3804-4a65-a809-f90f305fde6f',
        name: 'Section: Replies: read, decide, act',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1800],
    })
    SectionRepliesReadDecideAct = {
        width: 4360,
        height: 1750,
        color: 6,
        content: `## 3. Replies: read, decide, act
Gmail in. A classifier reads the reply, then a booking agent or an objection agent answers, or a person is asked.`,
    };

    @node({
        id: '38960c1a-5025-4405-a061-419d784d9c5c',
        name: 'Section: Weekly report',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 3630],
    })
    SectionWeeklyReport = {
        width: 1680,
        height: 590,
        color: 3,
        content: `## 4. Weekly report
The funnel is counted in code. An agent writes three sentences about it.`,
    };

    @node({
        id: '63e0b1d9-ed0f-487f-acda-2fb7db7a3362',
        webhookId: '422b54a1-58e4-4c49-acad-8638c63c0c16',
        name: 'New lead form',
        type: 'n8n-nodes-base.typeformTrigger',
        version: 1.1,
        position: [0, 470],
        credentials: { typeformApi: { id: '__CRED:typeform__', name: 'Typeform' } },
    })
    NewLeadForm = {
        authentication: 'accessToken',
        formId: 'lead-form',
        simplifyAnswers: true,
        onlyAnswers: false,
    };

    @node({
        id: '8f14d5bb-78ac-453b-a02a-f06f7f54bfcc',
        name: 'Read the form',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 470],
    })
    ReadTheForm = {
        jsCode: `return $input.all().map((item) => {
  const f = item.json;
  const email = String(f.email ?? f["Work email"] ?? "").trim().toLowerCase();
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) throw new Error("The form sent no usable email");
  const domain = email.split("@")[1];
  return { json: {
    email, domain,
    name: String(f.name ?? f["Your name"] ?? "").trim() || email.split("@")[0],
    company: String(f.company ?? f["Company"] ?? "").trim() || null,
    message: String(f.message ?? f["What do you need?"] ?? "").slice(0, 3000),
    free_email: /^(gmail|yahoo|hotmail|outlook|icloud|proton)\\./.test(domain),
    scope: "sales-lead", key: email,
  } };
});`,
    };

    @node({
        id: '9abe742f-63fd-4ced-aad7-38a69df47acb',
        name: 'Seen this lead?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [520, 470],
    })
    SeenThisLead = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: '5d019b0f-b973-4be5-ae13-73d69fdc4491',
        name: 'New lead?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 470],
    })
    NewLead = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '5e0a109c-c3fc-4f36-a14d-0b33b6d3c916',
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
        id: 'ff1f953c-b32f-462c-a18e-df73fc54eae7',
        name: 'Already in a sequence',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 380],
    })
    AlreadyInASequence = {};

    @node({
        id: 'db45e34c-c59f-41eb-a562-bbc9ee09975a',
        name: 'Enrich the person',
        type: 'n8n-nodes-base.clearbit',
        version: 1,
        position: [1040, 560],
        credentials: { clearbitApi: { id: '__CRED:clearbit__', name: 'Clearbit' } },
        onError: 'continueRegularOutput',
    })
    EnrichThePerson = {
        resource: 'person',
        operation: 'enrich',
        email: '={{ $json.email }}',
        additionalFields: {},
    };

    @node({
        id: '19d21dce-16c6-40c1-a8d0-24ab412c128f',
        name: 'Search company news',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 470],
        credentials: { serpApi: { id: '__CRED:serpapi__', name: 'SerpAPI' } },
        onError: 'continueRegularOutput',
    })
    SearchCompanyNews = {
        method: 'GET',
        url: "={{ 'https://serpapi.com/search.json' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'serpApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'q',
                    value: "={{ ($('New lead?').first().json.company ?? $('New lead?').first().json.domain) + ' news' }}",
                },
                {
                    name: 'num',
                    value: "={{ '10' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '515d8eed-04e3-4c9f-a258-37df5799a72f',
        name: 'Build the dossier',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 470],
    })
    BuildTheDossier = {
        jsCode: `const l = $("New lead?").first().json;
const person = $("Enrich the person").first().json ?? {};
const found = $input.first().json ?? {};
const news = (found.organic_results ?? []).slice(0, 5).map((r) => ({ title: r.title, snippet: String(r.snippet ?? "").slice(0, 240), link: r.link }));
return [{ json: { ...l, dossier: {
  name: l.name, company: l.company ?? person.employment?.name ?? null, domain: l.domain,
  title: person.employment?.title ?? null, seniority: person.employment?.seniority ?? null,
  employees: person.company?.metrics?.employees ?? null, industry: person.company?.category?.industry ?? null,
  said: l.message, news,
  enriched: !person.error && !!person.employment, searched: !found.error && news.length > 0,
} } }];`,
    };

    @node({
        id: 'e5782de0-bcb2-4e81-a7d3-cb7e684491af',
        name: 'Research agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2120, 340],
        onError: 'continueRegularOutput',
    })
    ResearchAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify($json.dossier) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Research agent on a sales team. From the dossier, write what a salesperson needs before a first email: a two-sentence summary of the company, the likely pains this person has in their role, and one or two specific hooks taken from the news or from what they wrote. Use only what is in the dossier. If the dossier is thin, say so in the summary and return fewer hooks. Never invent a fact, a number or a news item.',
            maxIterations: 6,
        },
    };

    @node({
        id: '4f3675d5-ab52-48ba-a699-597440ede430',
        name: 'Claude · research',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1820, 560],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeResearch = {
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
        id: '0c7fb8b7-8c3c-4dfb-aee5-433e3145cd37',
        name: 'Scratchpad',
        type: '@n8n/n8n-nodes-langchain.toolThink',
        version: 1,
        position: [2020, 560],
    })
    Scratchpad = {};

    @node({
        id: '3dd81015-c5e0-47c8-a9dc-7fb87f36bcb3',
        name: 'Company size band',
        type: '@n8n/n8n-nodes-langchain.toolCode',
        version: 1.3,
        position: [2220, 560],
    })
    CompanySizeBand = {
        description: 'Turns an employee count into a size band. Pass the number of employees.',
        jsCode: "const n = Number(query); if (!Number.isFinite(n)) return 'unknown'; return n < 11 ? 'micro (1-10)' : n < 51 ? 'small (11-50)' : n < 251 ? 'mid (51-250)' : 'large (250+)';",
    };

    @node({
        id: '4e621fde-d897-4eb3-a3cb-56831830e972',
        name: 'Research brief',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2420, 560],
    })
    ResearchBrief = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "summary": "Two sentences about the company.",
  "pains": [
    "A pain this role has"
  ],
  "hooks": [
    "A specific hook from the dossier"
  ],
  "thin": false
}`,
    };

    @node({
        id: '2f391a59-40f5-4843-a8e8-a702c6c7296b',
        name: 'Attach the research',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2680, 470],
    })
    AttachTheResearch = {
        jsCode: `const l = $("Build the dossier").first().json;
const out = $input.first().json.output;
const research = out && typeof out.summary === "string" ? out : null;
return [{ json: { ...l, research, research_failed: !research } }];`,
    };

    @node({
        id: '9902b115-91ee-4ada-a035-fe3e4fa714a9',
        name: 'Scoring agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [3040, 340],
        onError: 'continueRegularOutput',
    })
    ScoringAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ dossier: $json.dossier, research: $json.research }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Scoring agent. Score how well this lead fits a services business that sells website and automation projects to companies with a team and a budget. Reply with a score from 0 to 100, whether it is a fit, and one sentence of reasoning that quotes the evidence. Judge only what is in front of you.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'e4190b7f-5ba0-4fe2-a229-4f7d98aa4c35',
        name: 'GPT · scoring',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [2940, 560],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptScoring = {
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
        id: 'c8af60c8-b2ab-4a45-aa32-0dd2bbc910b3',
        name: 'Score',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [3140, 560],
    })
    Score = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "score": 72,
  "fit": true,
  "reason": "One sentence quoting the evidence."
}`,
    };

    @node({
        id: '0674daab-d057-46ac-a071-2725eaf6746f',
        name: 'Apply the ICP rules',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3400, 470],
    })
    ApplyTheIcpRules = {
        jsCode: `const l = $("Attach the research").first().json;
const m = $input.first().json.output;
const modelOk = m && typeof m.score === "number" && typeof m.fit === "boolean";
// Rules the model does not get to overrule.
const reasons = [];
if (l.free_email) reasons.push("personal email address");
if (l.dossier.employees !== null && l.dossier.employees < 3) reasons.push("fewer than three employees");
if (String(l.message).trim().length < 15) reasons.push("said almost nothing");
const score = modelOk ? Math.max(0, Math.min(100, Math.round(m.score))) : null;
const path = !modelOk || l.research_failed ? "review" : reasons.length || !m.fit || score < 60 ? "nurture" : "qualified";
return [{ json: { ...l, score, path, reason: modelOk ? m.reason : "An agent could not finish, so a person should look.", rule_hits: reasons } }];`,
    };

    @node({
        id: '7ba8ff7a-e2ce-46a0-a100-1634001a633c',
        name: 'Which path?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [3660, 470],
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
                                leftValue: "={{ $json.path === 'qualified' }}",
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
                                leftValue: "={{ $json.path === 'nurture' }}",
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
        id: 'd0ff20d4-91f1-4556-a54e-281c98793662',
        name: 'Create HubSpot contact',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [3920, 290],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateHubspotContact = {
        authentication: 'appToken',
        resource: 'contact',
        operation: 'upsert',
        email: '={{ $json.email }}',
        additionalFields: {
            firstName: '={{ $json.name }}',
            companyName: "={{ $json.dossier.company ?? '' }}",
            jobTitle: "={{ $json.dossier.title ?? '' }}",
        },
        options: {},
    };

    @node({
        id: '9fe58206-2f99-482b-a579-987f9af8e631',
        name: 'Start the sequence',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [4180, 200],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    StartTheSequence = {
        resource: 'row',
        operation: 'create',
        tableId: 'lead_sequences',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('Which path?').first().json.email }}",
                },
                {
                    fieldId: 'name',
                    fieldValue: "={{ $('Which path?').first().json.name }}",
                },
                {
                    fieldId: 'company',
                    fieldValue: "={{ $('Which path?').first().json.dossier.company }}",
                },
                {
                    fieldId: 'research',
                    fieldValue: "={{ $('Which path?').first().json.research }}",
                },
                {
                    fieldId: 'score',
                    fieldValue: "={{ $('Which path?').first().json.score }}",
                },
                {
                    fieldId: 'step',
                    fieldValue: '={{ 0 }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'active' }}",
                },
                {
                    fieldId: 'next_touch_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
                {
                    fieldId: 'created_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '855f2cb8-8e3c-439f-a4fa-88a0ecede071',
        name: 'Qualified message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [4440, 380],
    })
    QualifiedMessage = {
        jsCode: `const l = $("Which path?").first().json;
return [{ json: { channel: "#sales", level: "info", text: "New qualified lead: " + l.name + (l.dossier.company ? " (" + l.dossier.company + ")" : "") + ", score " + l.score + ". " + l.reason + " A sequence has started." } }];`,
    };

    @node({
        id: '7ee68bb0-36b7-4950-ad9b-1cb107dd0012',
        name: 'Tell sales',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [4700, 470],
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
        id: '59658411-67cc-424c-a9bd-547fd2ca1bc6',
        name: 'Lost contact payload',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [4180, 380],
    })
    LostContactPayload = {
        jsCode: `const l = $("Which path?").first().json;
return [{ json: { source: "ai-sales-team", reason: "HubSpot contact could not be created", payload: { email: l.email, name: l.name, score: l.score } } }];`,
    };

    @node({
        id: 'd2b6994e-d3c5-4051-a48b-ce518755ccc3',
        name: 'Park for replay',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [4440, 560],
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
        id: '6c4dafeb-0e10-4649-a444-7e59a6b10a65',
        name: 'Add to the newsletter',
        type: 'n8n-nodes-base.mailchimp',
        version: 1,
        position: [3920, 470],
        credentials: { mailchimpApi: { id: '__CRED:mailchimp__', name: 'Mailchimp' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AddToTheNewsletter = {
        resource: 'member',
        operation: 'create',
        list: 'main-list',
        email: '={{ $json.email }}',
        status: 'subscribed',
        options: {},
    };

    @node({
        id: '6ef1b57b-ab24-425d-adde-896c4d54397d',
        name: 'Record as nurture',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [4180, 560],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordAsNurture = {
        resource: 'row',
        operation: 'create',
        tableId: 'lead_sequences',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('Which path?').first().json.email }}",
                },
                {
                    fieldId: 'name',
                    fieldValue: "={{ $('Which path?').first().json.name }}",
                },
                {
                    fieldId: 'score',
                    fieldValue: "={{ $('Which path?').first().json.score }}",
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'nurture' }}",
                },
                {
                    fieldId: 'reason',
                    fieldValue:
                        "={{ $('Which path?').first().json.rule_hits.concat($('Which path?').first().json.reason).join('; ') }}",
                },
                {
                    fieldId: 'created_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '091290ab-6c3c-4448-aa9f-bae176f361f6',
        name: 'Needs a look message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3920, 650],
    })
    NeedsALookMessage = {
        jsCode: `const l = $input.first().json;
return [{ json: { channel: "#sales", level: "warn", text: "A new lead needs a person (" + l.email + "): " + l.reason } }];`,
    };

    @node({
        id: '0449076c-92f7-49d4-afaf-5753b2e29c89',
        name: 'Ask sales to look',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [4180, 740],
    })
    AskSalesToLook = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '3a34e288-1ef1-4dac-a320-5d9b7ee21b97',
        name: 'Every hour',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 1370],
    })
    EveryHour = {
        rule: {
            interval: [
                {
                    field: 'hours',
                    hoursInterval: 1,
                },
            ],
        },
    };

    @node({
        id: '11eed05d-c4a8-40b1-ad57-1e53c4408df5',
        name: 'Due sequences',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 1370],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DueSequences = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'lead_sequences',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'status=eq.active&next_touch_at=lte.' + $now.toISO() }}",
    };

    @node({
        id: '39b31151-504c-4548-a859-d7e9c35e7392',
        name: 'Cap the run',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 1370],
    })
    CapTheRun = {
        jsCode: `// Twenty an hour: enough to be useful, slow enough that a mistake is caught before it is sent to everyone.
return $input.all().map((i) => i.json).filter((s) => s.email).slice(0, 20).map((json) => ({ json }));`,
    };

    @node({
        id: '1c80a3ea-ef4c-44c7-a6bf-dd389a7241dd',
        name: 'Touches left?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 1370],
    })
    TouchesLeft = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '2ae018e4-bf75-47fd-a4b6-96ab75a0f1aa',
                    leftValue: '={{ Number($json.step ?? 0) < 4 }}',
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
        id: '340c4319-2338-4a01-afa6-b05571a3902f',
        name: 'Close the sequence',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1040, 1280],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CloseTheSequence = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'finished' }}",
                },
                {
                    fieldId: 'finished_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'ac712125-fa23-4f78-a099-1c9bae49eeb6',
        name: 'One lead at a time',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [1040, 1460],
    })
    OneLeadAtATime = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '93bbd4cd-5561-4584-a11f-b09de2320d89',
        name: 'Outreach done',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 1280],
    })
    OutreachDone = {};

    @node({
        id: 'e3fa326e-296d-4217-add5-603ddcab10c3',
        name: 'Earlier messages',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 1460],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    EarlierMessages = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'outreach_messages',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
    };

    @node({
        id: '527e0e58-0b14-4592-ab0d-673bf2d3e342',
        name: 'Brief the writer',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 1370],
    })
    BriefTheWriter = {
        jsCode: `const l = $("One lead at a time").first().json;
const earlier = $input.all().map((i) => i.json).filter((m) => m.subject).map((m) => ({ step: m.step, subject: m.subject }));
const goals = ["Open the conversation with one specific observation and one question.", "Share one relevant proof point and ask if it is worth a call.", "Offer a short, concrete next step.", "A polite last note that leaves the door open."];
const step = Number(l.step ?? 0);
return [{ json: { email: l.email, step, attempt: 1, brief: { name: l.name, company: l.company, research: l.research, goal: goals[step], touch: step + 1, of: goals.length, earlier } } }];`,
    };

    @node({
        id: 'b90a7851-3228-4299-a26b-15bf88536940',
        name: 'Writer agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2020, 1150],
        onError: 'continueRegularOutput',
    })
    WriterAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify($json.brief) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Writer agent. Write one short outreach email for the brief you are given: under 120 words, plain text, one idea, one question or next step, signed 'Kim'. Use the research for something specific to this person. You may search the case studies for one relevant proof point, and you may only cite a result that the search returned. No hype, no 'I hope this finds you well', no invented numbers. Do not repeat an earlier subject line.",
            maxIterations: 6,
        },
    };

    @node({
        id: '647e5b67-4fff-4f4c-ab30-a3b984a476cd',
        name: 'Claude · writing',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1820, 1370],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeWriting = {
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
        id: '7813f046-d722-4355-a73c-25de99f15186',
        name: 'Case studies',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [2020, 1370],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    CaseStudies = {
        mode: 'retrieve-as-tool',
        toolDescription:
            "Search the company's case studies for a relevant proof point. Pass a short description of the lead's industry or problem.",
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'kb-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: '2a12b7a5-68e6-445e-af1a-bb894555b983',
        name: 'Embeddings · case studies',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [2020, 1590],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsCaseStudies = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: '953b2a6b-3332-4fae-a542-17895210263d',
        name: 'Email draft',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2220, 1370],
    })
    EmailDraft = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "subject": "A short subject line",
  "body": "The email body in plain text."
}`,
    };

    @node({
        id: 'e3c7bb81-9d91-4fe6-aa4f-b817e0a9612f',
        name: 'Read the draft',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2480, 1370],
    })
    ReadTheDraft = {
        jsCode: `const b = $("Brief the writer").first().json;
const out = $input.first().json.output;
const ok = out && typeof out.subject === "string" && typeof out.body === "string";
return [{ json: { ...b, subject: ok ? out.subject.trim() : null, body: ok ? out.body.trim() : null, draft_failed: !ok } }];`,
    };

    @node({
        id: '55b89768-80d6-4b11-a2dc-b3ada271032f',
        name: 'Reviewer agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2840, 1240],
        onError: 'continueRegularOutput',
    })
    ReviewerAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ brief: $json.brief, subject: $json.subject, body: $json.body }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Reviewer agent. You did not write this email and you are not trying to be kind about it. Approve it only if it is specific to this person, makes no claim the brief does not support, has one clear ask, and sounds like a person wrote it. List every problem you find.',
            maxIterations: 6,
        },
    };

    @node({
        id: 'ec2fcb8c-b8d1-4947-ae85-3d4df11a397d',
        name: 'GPT · review',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [2740, 1460],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptReview = {
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
        id: '0fe2fb29-36a0-4255-a7cb-335641aeb8df',
        name: 'Review',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2940, 1460],
    })
    Review = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "approve": true,
  "issues": [
    "A specific problem, if any"
  ]
}`,
    };

    @node({
        id: '056476d5-cf2a-4079-a4c8-99d4559f5bd9',
        name: 'Check it in code too',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3200, 1370],
    })
    CheckItInCodeToo = {
        jsCode: `const d = $("Read the draft").first().json;
const r = $input.first().json.output;
// The checks a model should not be trusted to make about its colleague.
const hard = [];
const body = String(d.body ?? "");
if (d.draft_failed) hard.push("no draft was produced");
if (body.split(/\\s+/).filter(Boolean).length > 150) hard.push("over 150 words");
if (/\\{\\{|\\}\\}|\\[(name|company|first name)\\]/i.test(d.subject + " " + body)) hard.push("an unfilled placeholder");
if (/guarantee|100%|risk[- ]free|act now/i.test(body)) hard.push("a promise we do not make");
if ((d.brief.earlier ?? []).some((m) => m.subject && m.subject.toLowerCase() === String(d.subject).toLowerCase())) hard.push("repeats an earlier subject line");
const reviewed = r && typeof r.approve === "boolean";
const issues = [...hard, ...(reviewed ? (r.issues ?? []).filter(Boolean) : ["the reviewer could not be reached"])];
return [{ json: { ...d, approved: reviewed && r.approve === true && hard.length === 0, issues } }];`,
    };

    @node({
        id: '9915d1de-e139-430f-a909-3c93dd7d119a',
        name: 'Approved?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [3460, 1370],
    })
    Approved = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'b604e61a-1df5-4742-a368-1493d5c22ea0',
                    leftValue: '={{ $json.approved }}',
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
        id: '499cb163-45aa-4606-a2b6-f7b72183aec8',
        name: 'Send the email',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [4960, 1280],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheEmail = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'kim@example.com' }}",
        fromName: "={{ 'Kim' }}",
        toEmail: '={{ $json.email }}',
        subject: '={{ $json.subject }}',
        dynamicTemplate: false,
        contentType: 'text/plain',
        contentValue: '={{ $json.body }}',
        additionalFields: {},
    };

    @node({
        id: 'e3754d5d-f7ad-48cc-ab8b-ede2377b6bb4',
        name: 'Log the message',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [5220, 1280],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheMessage = {
        resource: 'row',
        operation: 'create',
        tableId: 'outreach_messages',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('One lead at a time').first().json.email }}",
                },
                {
                    fieldId: 'step',
                    fieldValue: "={{ $('One lead at a time').first().json.step ?? 0 }}",
                },
                {
                    fieldId: 'subject',
                    fieldValue:
                        "={{ $('Send the email').first().json.subject ?? $('Approved?').first().json.subject ?? $('Recheck in code').first().json.subject }}",
                },
                {
                    fieldId: 'sent_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '7035d2ee-8349-480a-a3d0-891b14637801',
        name: 'Advance the sequence',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [5480, 1280],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AdvanceTheSequence = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $('One lead at a time').first().json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'step',
                    fieldValue: "={{ Number($('One lead at a time').first().json.step ?? 0) + 1 }}",
                },
                {
                    fieldId: 'next_touch_at',
                    fieldValue: '={{ $now.plus({ days: 3 }).toISO() }}',
                },
                {
                    fieldId: 'last_touch_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '441dfadd-f6f0-4202-a737-a74eaca4c492',
        name: 'Note on the contact',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [5740, 1370],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    NoteOnTheContact = {
        authentication: 'appToken',
        resource: 'engagement',
        operation: 'create',
        type: 'task',
        metadata: {
            subject:
                "={{ 'Outreach email ' + (Number($('One lead at a time').first().json.step ?? 0) + 1) + ' sent by the sales agents.' }}",
            body: "={{ 'Outreach email ' + (Number($('One lead at a time').first().json.step ?? 0) + 1) + ' sent by the sales agents.' }}",
            status: 'COMPLETED',
        },
        additionalFields: {
            associations: {},
        },
    };

    @node({
        id: '1eb557bf-1c73-4e2b-a9de-c20d93afc560',
        name: 'First attempt?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [3720, 1370],
    })
    FirstAttempt = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '2916f49b-dbaf-4b8c-a997-b1c4425fecbb',
                    leftValue: '={{ $json.attempt < 2 && !$json.draft_failed }}',
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
        id: 'b6c6e8cd-ffaf-4b22-a630-2d889df26ecb',
        name: 'Reviser agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [4080, 1240],
        onError: 'continueRegularOutput',
    })
    ReviserAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify({ brief: $json.brief, subject: $json.subject, body: $json.body, issues: $json.issues }) }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                'You are the Reviser agent. Rewrite the email so that every listed issue is fixed, and change nothing else about what it says. Same rules as before: under 120 words, plain text, one ask, nothing the brief does not support.',
            maxIterations: 6,
        },
    };

    @node({
        id: '2c2c7268-38d1-490c-a057-8db4d2efc2c4',
        name: 'Claude · revising',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [3980, 1460],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeRevising = {
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
        id: '48a9ee0a-dd8a-407c-adbf-baf86a015d26',
        name: 'Revised draft',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [4180, 1460],
    })
    RevisedDraft = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "subject": "A short subject line",
  "body": "The email body in plain text."
}`,
    };

    @node({
        id: '6d2ea394-90c3-45ba-a394-04a63e28f35a',
        name: 'Recheck in code',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [4440, 1370],
    })
    RecheckInCode = {
        jsCode: `const d = $("First attempt?").first().json;
const out = $input.first().json.output;
const ok = out && typeof out.subject === "string" && typeof out.body === "string";
const body = ok ? out.body.trim() : "";
const hard = [];
if (!ok) hard.push("no revision was produced");
if (body.split(/\\s+/).filter(Boolean).length > 150) hard.push("over 150 words");
if (/\\{\\{|\\}\\}|\\[(name|company|first name)\\]/i.test(body)) hard.push("an unfilled placeholder");
if (/guarantee|100%|risk[- ]free|act now/i.test(body)) hard.push("a promise we do not make");
return [{ json: { ...d, attempt: 2, subject: ok ? out.subject.trim() : d.subject, body: ok ? body : d.body, approved: hard.length === 0, issues: hard.length ? hard : d.issues } }];`,
    };

    @node({
        id: '8346f4e7-9213-4679-a5a9-bfb3ad469bf7',
        name: 'Passes now?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [4700, 1370],
    })
    PassesNow = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'e1577b6f-5e81-4519-abd9-55caa5a95e08',
                    leftValue: '={{ $json.approved }}',
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
        id: '3ad7ee6a-91fc-4afe-a7ec-112698d14399',
        name: 'Human review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [4960, 1460],
    })
    HumanReviewMessage = {
        jsCode: `const d = $input.first().json;
return [{ json: { channel: "#sales", level: "warn", text: "An outreach email to " + d.email + " was held back: " + d.issues.join("; ") + ". The sequence is paused until someone looks." } }];`,
    };

    @node({
        id: '9674fb5a-2d98-4eb4-a44b-58706a97449b',
        name: 'Send to a person',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [5220, 1460],
    })
    SendToAPerson = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '6e6ad2c1-ff15-4338-a87d-7a25d6c69c6b',
        name: 'Pause for review',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [5480, 1460],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PauseForReview = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $('One lead at a time').first().json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'needs_review' }}",
                },
            ],
        },
    };

    @node({
        id: 'c17bcd22-d337-4ee6-aaa4-35425c27c3fa',
        name: 'Reply received',
        type: 'n8n-nodes-base.gmailTrigger',
        version: 1.2,
        position: [0, 2710],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
    })
    ReplyReceived = {
        pollTimes: {
            item: [
                {
                    mode: 'everyMinute',
                },
            ],
        },
        simple: true,
        filters: {
            readStatus: 'unread',
        },
    };

    @node({
        id: 'b2aad12b-2acb-4e25-a09f-9c07804cd90c',
        name: 'Read the reply',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 2710],
    })
    ReadTheReply = {
        jsCode: `return $input.all().map((item) => {
  const m = item.json;
  const from = String(m.From ?? m.from ?? "").toLowerCase();
  const email = (/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/.exec(from) ?? [""])[0];
  // Keep what they wrote; drop the quoted email underneath it.
  const text = String(m.snippet ?? m.text ?? "").split(/\\nOn .+ wrote:|\\n>|\\n-----Original Message-----/)[0].trim().slice(0, 2000);
  return { json: { email, message_id: String(m.id ?? ""), thread_id: String(m.threadId ?? ""), subject: String(m.Subject ?? m.subject ?? ""), text } };
}).filter((i) => i.json.email && i.json.text);`,
    };

    @node({
        id: 'd414899c-128d-41b4-a914-05e83325c32c',
        name: 'Find the sequence',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 2710],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FindTheSequence = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'lead_sequences',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
    };

    @node({
        id: '17ad71c5-ebef-437b-a8ac-a6dfc437ac1f',
        name: 'One of ours?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 2710],
    })
    OneOfOurs = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd0f6fc2a-0e68-419b-ad02-d277e6767cc7',
                    leftValue: '={{ !!$json.email }}',
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
        id: 'bd5e866d-1ce7-4a80-a399-a6cfca764235',
        name: 'Not a lead, leave it',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1140, 2490],
    })
    NotALeadLeaveIt = {};

    @node({
        id: '3a879dad-ca54-4491-a887-09465f53d6cf',
        name: 'Reply classifier',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1140, 2670],
        onError: 'continueRegularOutput',
    })
    ReplyClassifier = {
        promptType: 'define',
        text: "={{ $('Read the reply').first().json.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Reply classifier. Read a reply to a sales email and say what the person wants: 'interested' (wants to talk or asks for times), 'objection' (a concern or a question about the offer), 'not_now' (maybe later), 'unsubscribe' (stop writing), or 'out_of_office' (an automatic reply). Give your confidence from 0 to 1. If it could be two of these, pick the more cautious one and lower your confidence.",
            maxIterations: 6,
        },
    };

    @node({
        id: 'f2272e3f-d3ce-42a1-ab86-8e8e1ec2c512',
        name: 'GPT · classifying',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1040, 2890],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    GptClassifying = {
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
        id: '11c65eaa-be05-4ae6-a899-7c3e1ab64879',
        name: 'Intent',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1240, 2890],
    })
    Intent = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "intent": "interested",
  "confidence": 0.9
}`,
    };

    @node({
        id: '8bfc11a8-a4be-4740-a4c0-385f9d06d56e',
        name: 'Read the intent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1500, 2710],
    })
    ReadTheIntent = {
        jsCode: `const s = $("Find the sequence").first().json;
const r = $("Read the reply").first().json;
const out = $input.first().json.output;
const known = ["interested", "objection", "not_now", "unsubscribe", "out_of_office"];
let intent = out && known.includes(out.intent) && Number(out.confidence) >= 0.7 ? out.intent : "unknown";
// "Stop" is honoured whatever the model made of it.
if (/\\b(unsubscribe|stop emailing|remove me|do not contact)\\b/i.test(r.text)) intent = "unsubscribe";
return [{ json: { ...s, reply: r, intent, confidence: out?.confidence ?? null } }];`,
    };

    @node({
        id: '155343ff-1aab-4e66-a22f-0606038932ee',
        name: 'What do they want?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1760, 2710],
    })
    WhatDoTheyWant = {
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
                                id: '0764210a-3f25-4325-abb0-28df355e7549',
                                leftValue: "={{ $json.intent === 'interested' }}",
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
                    outputKey: 'interested',
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
                                id: '0c406bfd-729d-437f-af1c-bb71fd999638',
                                leftValue: "={{ $json.intent === 'objection' }}",
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
                    outputKey: 'objection',
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
                                id: 'c1118417-a495-4f5d-a7b6-1294a2edca05',
                                leftValue: "={{ $json.intent === 'not_now' }}",
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
                    outputKey: 'not_now',
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
                                id: '8bf9f020-e2e7-4f26-a14e-76f7d38d2d2b',
                                leftValue: "={{ $json.intent === 'unsubscribe' }}",
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
                    outputKey: 'unsubscribe',
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
                                id: 'c3e8c9b0-0e6b-4782-a7fe-282132a12c55',
                                leftValue: "={{ $json.intent === 'out_of_office' }}",
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
                    outputKey: 'out_of_office',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: 'bd006151-dc31-43a8-ae27-b5b67e6811a1',
        name: 'Booking agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2220, 2000],
        onError: 'continueRegularOutput',
    })
    BookingAgent = {
        promptType: 'define',
        text: "={{ 'Their reply: ' + $json.reply.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Booking agent. The person is interested. Look up free time in the calendar for the next five working days and reply offering exactly three slots of 30 minutes, in their words' tone, in under 80 words, signed 'Kim'. Offer only times the calendar returned as free.",
            maxIterations: 6,
        },
    };

    @node({
        id: '973be848-ae24-4b75-a272-a44caf1b9031',
        name: 'Claude · booking',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [2020, 2220],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeBooking = {
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
        id: '35301f17-a7e8-4efa-a5a3-471f1ccfedce',
        name: 'Free slots',
        type: 'n8n-nodes-base.googleCalendarTool',
        version: 1.3,
        position: [2220, 2220],
        credentials: { googleCalendarOAuth2Api: { id: '__CRED:googleCalendar__', name: 'Google Calendar' } },
    })
    FreeSlots = {
        descriptionType: 'manual',
        toolDescription: 'Checks whether the calendar is free between two times. Call it once per candidate slot.',
        resource: 'calendar',
        operation: 'availability',
        calendar: {
            __rl: true,
            mode: 'id',
            value: 'kim@example.com',
        },
        timeMin: "={{ $fromAI('from', `Start of the slot, ISO 8601`, 'string') }}",
        timeMax: "={{ $fromAI('to', `End of the slot, ISO 8601`, 'string') }}",
        options: {},
    };

    @node({
        id: '70eace99-247d-4559-afd0-960d65222dca',
        name: 'Proposed times',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2420, 2220],
    })
    ProposedTimes = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "reply": "The reply offering three times.",
  "slots": [
    "2026-11-02T10:00:00Z"
  ]
}`,
    };

    @node({
        id: '7fa1e749-cf02-4f96-a9b4-a48ebf785275',
        name: 'Got three times?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2680, 2530],
    })
    GotThreeTimes = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '1f1564fa-2a90-4fc4-aed2-a7d8c6bc8ee3',
                    leftValue:
                        "={{ Array.isArray($json.output?.slots) && $json.output.slots.length === 3 && typeof $json.output.reply === 'string' }}",
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
        id: '5fb7157c-1545-4c7b-a02e-38faac0383e6',
        name: 'Reply with times',
        type: 'n8n-nodes-base.gmail',
        version: 2.1,
        position: [2940, 2530],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReplyWithTimes = {
        resource: 'message',
        operation: 'reply',
        messageId: "={{ $('Read the reply').first().json.message_id }}",
        emailType: 'text',
        message: '={{ $json.output.reply }}',
        options: {},
    };

    @node({
        id: 'c5b52205-acf4-40ee-a9f8-de507f1a0a58',
        name: 'Mark as meeting proposed',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [3200, 2530],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkAsMeetingProposed = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $('Read the reply').first().json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'meeting_proposed' }}",
                },
                {
                    fieldId: 'replied_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '0c5490b9-dde5-402c-ab7b-d4a50fba159e',
        name: 'Open a deal',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [3460, 2620],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenADeal = {
        authentication: 'appToken',
        resource: 'deal',
        operation: 'create',
        stage: "={{ 'appointmentscheduled' }}",
        additionalFields: {
            dealName: "={{ 'Intro call: ' + $('Find the sequence').first().json.name }}",
        },
    };

    @node({
        id: 'e1abf003-de31-4c76-adae-8abf0cd08c3d',
        name: 'Interested message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [3720, 2710],
    })
    InterestedMessage = {
        jsCode: `const s = $("Find the sequence").first().json;
return [{ json: { channel: "#sales", level: "info", text: s.name + " replied and is interested. Three times were offered and a deal is open in HubSpot." } }];`,
    };

    @node({
        id: '2d497184-8e2b-4d04-aa0b-87778db9b48d',
        name: 'Tell the owner',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3980, 2710],
    })
    TellTheOwner = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '5e07e217-919b-4374-a166-73d38567be89',
        name: 'Objection agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2220, 2440],
        onError: 'continueRegularOutput',
    })
    ObjectionAgent = {
        promptType: 'define',
        text: "={{ 'Their reply: ' + $json.reply.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "You are the Objection agent. Answer the person's concern or question honestly, using only what the product and case study search returns. If the search does not cover it, say you will find out and set your confidence low. Under 100 words, signed 'Kim'. Never argue, never discount, never promise a result.",
            maxIterations: 6,
        },
    };

    @node({
        id: '0d564568-c0b9-4c84-a4a5-e1ea64c2aec5',
        name: 'Claude · objections',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [2020, 2660],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeObjections = {
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
        id: 'edf63fa8-5027-4a84-a2ce-9c7608b66cf7',
        name: 'Product answers',
        type: '@n8n/n8n-nodes-langchain.vectorStorePinecone',
        version: 1.3,
        position: [2220, 2660],
        credentials: { pineconeApi: { id: '__CRED:pinecone__', name: 'Pinecone' } },
    })
    ProductAnswers = {
        mode: 'retrieve-as-tool',
        toolDescription:
            "Search the product documentation and case studies to answer a prospect's question or concern.",
        pineconeIndex: {
            __rl: true,
            mode: 'id',
            value: 'kb-index',
        },
        topK: 4,
        options: {},
    };

    @node({
        id: '72480ccf-fd05-4480-a4b4-0f76c48392a2',
        name: 'Embeddings · answers',
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        version: 1.2,
        position: [2220, 2880],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    EmbeddingsAnswers = {
        model: 'text-embedding-3-small',
        options: {},
    };

    @node({
        id: 'a00c8cdb-34c6-4a2e-a011-5403494f7470',
        name: 'Answer',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2420, 2660],
    })
    Answer = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "reply": "The answer.",
  "confidence": 0.8
}`,
    };

    @node({
        id: 'e552a3e4-8695-4ae0-ad6d-4ecb19da7018',
        name: 'Confident answer?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2680, 2710],
    })
    ConfidentAnswer = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f947c5ff-2df9-4658-aa97-23dc64682fd3',
                    leftValue:
                        "={{ Number($json.output?.confidence) >= 0.75 && typeof $json.output?.reply === 'string' }}",
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
        id: '384e3640-be85-4b29-a2fd-9bd0b9eb290f',
        name: 'Answer the objection',
        type: 'n8n-nodes-base.gmail',
        version: 2.1,
        position: [2940, 2710],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AnswerTheObjection = {
        resource: 'message',
        operation: 'reply',
        messageId: "={{ $('Read the reply').first().json.message_id }}",
        emailType: 'text',
        message: '={{ $json.output.reply }}',
        options: {},
    };

    @node({
        id: '85ae045b-17c7-4b0e-a9e7-44cbe9ffbe10',
        name: 'Keep the sequence going',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [3200, 2710],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    KeepTheSequenceGoing = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $('Read the reply').first().json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'last_reply_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
                {
                    fieldId: 'next_touch_at',
                    fieldValue: '={{ $now.plus({ days: 4 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '84284b08-240a-4d20-a756-c4036064583d',
        name: 'Hand over message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2940, 2890],
    })
    HandOverMessage = {
        jsCode: `const s = $("Read the intent").first().json;
return [{ json: { channel: "#sales", level: "warn", text: s.name + " (" + s.email + ") replied and an agent was not sure how to answer: \\"" + s.reply.text.slice(0, 240) + "\\". The sequence is paused." } }];`,
    };

    @node({
        id: 'ae07677f-6add-4fba-a365-87182c1ae99b',
        name: 'Hand to a person',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3200, 2890],
    })
    HandToAPerson = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '99dec237-50b9-4261-a830-27d3b477561c',
        name: 'Pause: needs a person',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [3460, 2800],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PauseNeedsAPerson = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $('Read the reply').first().json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'needs_review' }}",
                },
                {
                    fieldId: 'replied_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '097a6133-4b3f-440e-af34-d2368bed778e',
        name: 'Snooze for 30 days',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2220, 3060],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SnoozeFor30Days = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'next_touch_at',
                    fieldValue: '={{ $now.plus({ days: 30 }).toISO() }}',
                },
                {
                    fieldId: 'replied_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '4faacab4-7f69-4be8-abe4-db40add8aa0a',
        name: 'Stop the sequence',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2220, 3240],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    StopTheSequence = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'unsubscribed' }}",
                },
                {
                    fieldId: 'replied_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '8cf5abe8-bdce-4981-a590-d602724aa0d3',
        name: 'Mark opted out in HubSpot',
        type: 'n8n-nodes-base.hubspot',
        version: 2.1,
        position: [2680, 2890],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkOptedOutInHubspot = {
        authentication: 'appToken',
        resource: 'contact',
        operation: 'upsert',
        email: "={{ $('Read the reply').first().json.email }}",
        additionalFields: {},
        options: {},
    };

    @node({
        id: 'e05763c5-1bfc-47e1-a409-6059cbe2c9f6',
        name: 'Push the next touch a week',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2220, 3420],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PushTheNextTouchAWeek = {
        resource: 'row',
        operation: 'update',
        tableId: 'lead_sequences',
        filterType: 'string',
        filterString: "={{ 'email=eq.' + $json.email }}",
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'next_touch_at',
                    fieldValue: '={{ $now.plus({ days: 7 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '9e5d6b9a-73f4-4fb2-a28f-959f044e8cfc',
        name: 'Monday 08:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 3960],
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
        id: 'c4d8e832-ba6d-49e0-ad16-b6fb975cd287',
        name: "This week's messages",
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 3960],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ThisWeekSMessages = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'outreach_messages',
        returnAll: true,
        filterType: 'string',
        filterString: "={{ 'sent_at=gte.' + $now.minus({ days: 7 }).toISO() }}",
    };

    @node({
        id: 'cfb30d13-16d4-469e-af10-1fd535a7f8bd',
        name: 'All sequences',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 3960],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AllSequences = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'lead_sequences',
        returnAll: true,
    };

    @node({
        id: '48721882-0058-42ef-a020-1f4d4f624364',
        name: 'Count the funnel',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 3960],
    })
    CountTheFunnel = {
        jsCode: `const sent = $("This week's messages").all().filter((i) => i.json.sent_at).length;
const seqs = $input.all().map((i) => i.json).filter((s) => s.email);
const by = (status) => seqs.filter((s) => s.status === status).length;
const weekAgo = Date.now() - 7 * 864e5;
const replied = seqs.filter((s) => s.replied_at && new Date(s.replied_at).getTime() >= weekAgo).length;
return [{ json: { sent, replied, reply_rate: sent ? Math.round((replied / sent) * 100) : 0, active: by("active"), meetings: by("meeting_proposed"), needs_review: by("needs_review"), unsubscribed: by("unsubscribed"), nurture: by("nurture") } }];`,
    };

    @node({
        id: '1bf60c30-83d5-40dd-aa5d-227985322159',
        name: 'Analyst agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1040, 3830],
        onError: 'continueRegularOutput',
    })
    AnalystAgent = {
        promptType: 'define',
        text: '={{ JSON.stringify($json) }}',
        hasOutputParser: false,
        options: {
            systemMessage:
                "You are the Analyst agent. Write three sentences for a sales lead about last week's outbound numbers: what moved, what needs attention, and one thing to try. Use only the numbers given. Do not invent a cause.",
            maxIterations: 6,
        },
    };

    @node({
        id: '0701ae46-0d00-47b2-aabe-17096e73fd8b',
        name: 'Claude · analysis',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1040, 4050],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    ClaudeAnalysis = {
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
        id: 'bed88b3a-40b0-4868-af2b-bc6f733080f3',
        name: 'Post the weekly report',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1300, 3960],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheWeeklyReport = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#sales' }}",
        },
        text: "={{ '*Outbound last week*\\n' + ($json.output ?? 'The written summary is unavailable this week.') + '\\nSent ' + $('Count the funnel').first().json.sent + ' · replies ' + $('Count the funnel').first().json.replied + ' (' + $('Count the funnel').first().json.reply_rate + '%) · meetings proposed ' + $('Count the funnel').first().json.meetings + ' · waiting on a person ' + $('Count the funnel').first().json.needs_review }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.NewLeadForm.out(0).to(this.ReadTheForm.in(0));
        this.ReadTheForm.out(0).to(this.SeenThisLead.in(0));
        this.SeenThisLead.out(0).to(this.NewLead.in(0));
        this.NewLead.out(0).to(this.EnrichThePerson.in(0));
        this.NewLead.out(1).to(this.AlreadyInASequence.in(0));
        this.EnrichThePerson.out(0).to(this.SearchCompanyNews.in(0));
        this.SearchCompanyNews.out(0).to(this.BuildTheDossier.in(0));
        this.BuildTheDossier.out(0).to(this.ResearchAgent.in(0));
        this.ResearchAgent.out(0).to(this.AttachTheResearch.in(0));
        this.AttachTheResearch.out(0).to(this.ScoringAgent.in(0));
        this.ScoringAgent.out(0).to(this.ApplyTheIcpRules.in(0));
        this.ApplyTheIcpRules.out(0).to(this.WhichPath.in(0));
        this.WhichPath.out(0).to(this.CreateHubspotContact.in(0));
        this.WhichPath.out(1).to(this.AddToTheNewsletter.in(0));
        this.WhichPath.out(2).to(this.NeedsALookMessage.in(0));
        this.CreateHubspotContact.out(0).to(this.StartTheSequence.in(0));
        this.CreateHubspotContact.out(1).to(this.LostContactPayload.in(0));
        this.StartTheSequence.out(0).to(this.QualifiedMessage.in(0));
        this.QualifiedMessage.out(0).to(this.TellSales.in(0));
        this.LostContactPayload.out(0).to(this.ParkForReplay.in(0));
        this.AddToTheNewsletter.out(0).to(this.RecordAsNurture.in(0));
        this.NeedsALookMessage.out(0).to(this.AskSalesToLook.in(0));
        this.EveryHour.out(0).to(this.DueSequences.in(0));
        this.DueSequences.out(0).to(this.CapTheRun.in(0));
        this.CapTheRun.out(0).to(this.TouchesLeft.in(0));
        this.TouchesLeft.out(0).to(this.OneLeadAtATime.in(0));
        this.TouchesLeft.out(1).to(this.CloseTheSequence.in(0));
        this.OneLeadAtATime.out(0).to(this.OutreachDone.in(0));
        this.OneLeadAtATime.out(1).to(this.EarlierMessages.in(0));
        this.EarlierMessages.out(0).to(this.BriefTheWriter.in(0));
        this.BriefTheWriter.out(0).to(this.WriterAgent.in(0));
        this.WriterAgent.out(0).to(this.ReadTheDraft.in(0));
        this.ReadTheDraft.out(0).to(this.ReviewerAgent.in(0));
        this.ReviewerAgent.out(0).to(this.CheckItInCodeToo.in(0));
        this.CheckItInCodeToo.out(0).to(this.Approved.in(0));
        this.Approved.out(0).to(this.SendTheEmail.in(0));
        this.Approved.out(1).to(this.FirstAttempt.in(0));
        this.SendTheEmail.out(0).to(this.LogTheMessage.in(0));
        this.LogTheMessage.out(0).to(this.AdvanceTheSequence.in(0));
        this.AdvanceTheSequence.out(0).to(this.NoteOnTheContact.in(0));
        this.NoteOnTheContact.out(0).to(this.OneLeadAtATime.in(0));
        this.FirstAttempt.out(0).to(this.ReviserAgent.in(0));
        this.FirstAttempt.out(1).to(this.HumanReviewMessage.in(0));
        this.ReviserAgent.out(0).to(this.RecheckInCode.in(0));
        this.RecheckInCode.out(0).to(this.PassesNow.in(0));
        this.PassesNow.out(0).to(this.SendTheEmail.in(0));
        this.PassesNow.out(1).to(this.HumanReviewMessage.in(0));
        this.HumanReviewMessage.out(0).to(this.SendToAPerson.in(0));
        this.SendToAPerson.out(0).to(this.PauseForReview.in(0));
        this.PauseForReview.out(0).to(this.OneLeadAtATime.in(0));
        this.ReplyReceived.out(0).to(this.ReadTheReply.in(0));
        this.ReadTheReply.out(0).to(this.FindTheSequence.in(0));
        this.FindTheSequence.out(0).to(this.OneOfOurs.in(0));
        this.OneOfOurs.out(0).to(this.ReplyClassifier.in(0));
        this.OneOfOurs.out(1).to(this.NotALeadLeaveIt.in(0));
        this.ReplyClassifier.out(0).to(this.ReadTheIntent.in(0));
        this.ReadTheIntent.out(0).to(this.WhatDoTheyWant.in(0));
        this.WhatDoTheyWant.out(0).to(this.BookingAgent.in(0));
        this.WhatDoTheyWant.out(1).to(this.ObjectionAgent.in(0));
        this.WhatDoTheyWant.out(2).to(this.SnoozeFor30Days.in(0));
        this.WhatDoTheyWant.out(3).to(this.StopTheSequence.in(0));
        this.WhatDoTheyWant.out(4).to(this.PushTheNextTouchAWeek.in(0));
        this.WhatDoTheyWant.out(5).to(this.HandOverMessage.in(0));
        this.BookingAgent.out(0).to(this.GotThreeTimes.in(0));
        this.GotThreeTimes.out(0).to(this.ReplyWithTimes.in(0));
        this.GotThreeTimes.out(1).to(this.HandOverMessage.in(0));
        this.ReplyWithTimes.out(0).to(this.MarkAsMeetingProposed.in(0));
        this.MarkAsMeetingProposed.out(0).to(this.OpenADeal.in(0));
        this.OpenADeal.out(0).to(this.InterestedMessage.in(0));
        this.InterestedMessage.out(0).to(this.TellTheOwner.in(0));
        this.ObjectionAgent.out(0).to(this.ConfidentAnswer.in(0));
        this.ConfidentAnswer.out(0).to(this.AnswerTheObjection.in(0));
        this.ConfidentAnswer.out(1).to(this.HandOverMessage.in(0));
        this.AnswerTheObjection.out(0).to(this.KeepTheSequenceGoing.in(0));
        this.HandOverMessage.out(0).to(this.HandToAPerson.in(0));
        this.HandToAPerson.out(0).to(this.PauseNeedsAPerson.in(0));
        this.StopTheSequence.out(0).to(this.MarkOptedOutInHubspot.in(0));
        this.Monday0800.out(0).to(this.ThisWeekSMessages.in(0));
        this.ThisWeekSMessages.out(0).to(this.AllSequences.in(0));
        this.AllSequences.out(0).to(this.CountTheFunnel.in(0));
        this.CountTheFunnel.out(0).to(this.AnalystAgent.in(0));
        this.AnalystAgent.out(0).to(this.PostTheWeeklyReport.in(0));

        this.ResearchAgent.uses({
            ai_languageModel: this.ClaudeResearch.output,
            ai_outputParser: this.ResearchBrief.output,
            ai_tool: [this.Scratchpad.output, this.CompanySizeBand.output],
        });
        this.ScoringAgent.uses({
            ai_languageModel: this.GptScoring.output,
            ai_outputParser: this.Score.output,
        });
        this.WriterAgent.uses({
            ai_languageModel: this.ClaudeWriting.output,
            ai_outputParser: this.EmailDraft.output,
            ai_tool: [this.CaseStudies.output],
        });
        this.CaseStudies.uses({
            ai_embedding: this.EmbeddingsCaseStudies.output,
        });
        this.ReviewerAgent.uses({
            ai_languageModel: this.GptReview.output,
            ai_outputParser: this.Review.output,
        });
        this.ReviserAgent.uses({
            ai_languageModel: this.ClaudeRevising.output,
            ai_outputParser: this.RevisedDraft.output,
        });
        this.ReplyClassifier.uses({
            ai_languageModel: this.GptClassifying.output,
            ai_outputParser: this.Intent.output,
        });
        this.BookingAgent.uses({
            ai_languageModel: this.ClaudeBooking.output,
            ai_outputParser: this.ProposedTimes.output,
            ai_tool: [this.FreeSlots.output],
        });
        this.ObjectionAgent.uses({
            ai_languageModel: this.ClaudeObjections.output,
            ai_outputParser: this.Answer.output,
            ai_tool: [this.ProductAnswers.output],
        });
        this.ProductAnswers.uses({
            ai_embedding: this.EmbeddingsAnswers.output,
        });
        this.AnalystAgent.uses({
            ai_languageModel: this.ClaudeAnalysis.output,
        });
    }
}
