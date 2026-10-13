import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content pipeline · Research and draft
// Nodes   : 18  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Weekdays0700                       scheduleTrigger
// NextTopic                          supabase                   [creds] [alwaysOutput] [retry]
// IsThereOne                         if
// ClaimTheTopic                      supabase                   [creds] [retry]
// Research                           httpRequest                [onError→regular] [creds] [retry]
// CollectSources                     code
// Outline                            agent                      [AI] [onError→regular]
// OutlineGpt                         lmChatOpenAi               [creds] [ai_languageModel]
// OutlineShape                       outputParserStructured     [ai_outputParser]
// ReadTheOutline                     code
// UsableOutline                      if
// WriteTheDraft                      agent                      [AI] [onError→regular]
// WriteTheDraftClaude                lmChatAnthropic            [creds] [ai_languageModel]
// SaveTheDraft                       supabase                   [creds] [retry]
// AskForApproval                     slack                      [creds] [retry]
// ReturnTheTopic                     supabase                   [creds] [retry]
// QueueIsEmpty                       noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Weekdays0700
//    → NextTopic
//      → IsThereOne
//        → ClaimTheTopic
//          → Research
//            → CollectSources
//              → Outline
//                → ReadTheOutline
//                  → UsableOutline
//                    → WriteTheDraft
//                      → SaveTheDraft
//                        → AskForApproval
//                   .out(1) → ReturnTheTopic
//       .out(1) → QueueIsEmpty
//
// AI CONNECTIONS
// Outline.uses({ ai_languageModel: OutlineGpt, ai_outputParser: OutlineShape })
// WriteTheDraft.uses({ ai_languageModel: WriteTheDraftClaude })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Content pipeline · Research and draft',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ContentPipelineResearchAndDraftWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'cbdcd577-5b47-48cc-ab91-bbec0af34eeb',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Content pipeline · Research and draft
Takes the next topic off the list, researches it, drafts the article, and asks a person to approve it. Nothing is published from here.

**Platforms:** Supabase, SerpAPI, OpenAI, Claude, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/content-pipeline\``,
    };

    @node({
        id: '0d978302-c53c-4e6b-a20e-6a90f5e40a83',
        name: 'Weekdays 07:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 310],
    })
    Weekdays0700 = {
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
        id: '6314bcf4-9b57-446a-a723-b46098e2bcbc',
        name: 'Next topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 310],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    NextTopic = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'content_topics',
        returnAll: false,
        limit: 1,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'queued' }}",
                },
            ],
        },
    };

    @node({
        id: '5bb76069-560f-4701-a855-641b3a766e57',
        name: 'Is there one?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 310],
    })
    IsThereOne = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f51cd303-5533-400e-ad5c-f340f751b332',
                    leftValue: '={{ !!$json.id }}',
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
        id: '7d858916-a729-409f-abf6-41376f9d71e2',
        name: 'Claim the topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimTheTopic = {
        resource: 'row',
        operation: 'update',
        tableId: 'content_topics',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.id }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'drafting' }}",
                },
            ],
        },
    };

    @node({
        id: 'd3ac425a-e1bc-494a-add7-70e6f4f1885f',
        name: 'Research',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 310],
        credentials: { serpApi: { id: '__CRED:serpapi__', name: 'SerpAPI' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Research = {
        method: 'GET',
        url: "={{ 'https://serpapi.com/search.json' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'serpApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'q',
                    value: "={{ $('Is there one?').first().json.topic }}",
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
        id: '1e64b3ba-f22f-4d17-ac6b-1a969d4c1058',
        name: 'Collect sources',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 310],
    })
    CollectSources = {
        jsCode: `const t = $("Is there one?").first().json;
const results = ($input.first().json.organic_results ?? []).slice(0, 5);
return [{ json: { topic_id: t.id, topic: t.topic, sources: results.map((r) => ({ title: r.title, url: r.link })), notes: results.map((r) => "- " + r.title + ": " + String(r.snippet ?? "").slice(0, 400)).join("\\n") } }];`,
    };

    @node({
        id: 'a642d55a-764b-4c6f-a2bd-7c8be9a76bf0',
        name: 'Outline',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1660, 180],
        onError: 'continueRegularOutput',
    })
    Outline = {
        promptType: 'define',
        text: "={{ 'Topic: ' + $json.topic + '\\n\\nResearch notes:\\n' + ($json.notes || '(none)') }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                '[task:outline] Write an article outline as JSON: { title: string, sections: string[], keywords: string[] }. Use only facts found in the research notes.',
            maxIterations: 2,
        },
    };

    @node({
        id: '3b5db886-3758-483f-abad-bce364628b7c',
        name: 'Outline · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1560, 400],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    OutlineGpt = {
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
        id: 'd0834dbd-922a-437a-adbe-30816cd550ab',
        name: 'Outline · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [1760, 400],
    })
    OutlineShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "title": "The title",
  "sections": [
    "A section"
  ],
  "keywords": [
    "a keyword"
  ]
}`,
    };

    @node({
        id: '7006d8a4-39a7-470a-a65a-0c1014a71cf6',
        name: 'Read the outline',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2020, 310],
    })
    ReadTheOutline = {
        jsCode: `const before = $("Collect sources").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : {"title":null,"sections":[],"keywords":[]}), parse_error: !ok } });
}
return out;`,
    };

    @node({
        id: '7abc4d7f-5b9f-4451-a167-84dd9078c1cc',
        name: 'Usable outline?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2280, 310],
    })
    UsableOutline = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3a91b1aa-fbe4-4cf7-ac56-b94cada24ba4',
                    leftValue: '={{ !$json.parse_error && $json.sections.length >= 2 }}',
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
        id: '7d71d3bc-6809-43b8-ae2a-f11aa165edca',
        name: 'Write the draft',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [2540, 90],
        onError: 'continueRegularOutput',
    })
    WriteTheDraft = {
        promptType: 'define',
        text: '={{ JSON.stringify({ title: $json.title, sections: $json.sections, sources: $json.sources }) }}',
        hasOutputParser: false,
        options: {
            systemMessage:
                '[task:draft] Write the article in Markdown from this outline. Plain language, no invented statistics, cite only the sources listed.',
            maxIterations: 2,
        },
    };

    @node({
        id: '66bfb0f2-d70c-44de-ac06-dedce788c272',
        name: 'Write the draft · Claude',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [2540, 310],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    WriteTheDraftClaude = {
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
        id: '18d3527e-aff3-483c-a15c-2ce30a62dee4',
        name: 'Save the draft',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2800, 310],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheDraft = {
        resource: 'row',
        operation: 'create',
        tableId: 'content_drafts',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'topic_id',
                    fieldValue: "={{ $('Usable outline?').first().json.topic_id }}",
                },
                {
                    fieldId: 'title',
                    fieldValue: "={{ $('Usable outline?').first().json.title }}",
                },
                {
                    fieldId: 'keywords',
                    fieldValue: "={{ $('Usable outline?').first().json.keywords }}",
                },
                {
                    fieldId: 'sources',
                    fieldValue: "={{ $('Usable outline?').first().json.sources }}",
                },
                {
                    fieldId: 'body',
                    fieldValue: '={{ $json.output }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'awaiting_approval' }}",
                },
                {
                    fieldId: 'created_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '1f860db6-5ddb-4767-a6ac-e203553b5a11',
        name: 'Ask for approval',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [3060, 310],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AskForApproval = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#content' }}",
        },
        text: "={{ ':memo: Draft ready for review: \"' + $json.title + '\". Approve or reject draft ' + $json.id + '.' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '445a2090-f167-40c6-a5eb-f181b8dbe0f3',
        name: 'Return the topic',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2540, 530],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReturnTheTopic = {
        resource: 'row',
        operation: 'update',
        tableId: 'content_topics',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.topic_id }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'needs_brief' }}",
                },
            ],
        },
    };

    @node({
        id: 'a3d9e506-67df-42bb-afd9-49294a675833',
        name: 'Queue is empty',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 400],
    })
    QueueIsEmpty = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Weekdays0700.out(0).to(this.NextTopic.in(0));
        this.NextTopic.out(0).to(this.IsThereOne.in(0));
        this.IsThereOne.out(0).to(this.ClaimTheTopic.in(0));
        this.IsThereOne.out(1).to(this.QueueIsEmpty.in(0));
        this.ClaimTheTopic.out(0).to(this.Research.in(0));
        this.Research.out(0).to(this.CollectSources.in(0));
        this.CollectSources.out(0).to(this.Outline.in(0));
        this.Outline.out(0).to(this.ReadTheOutline.in(0));
        this.ReadTheOutline.out(0).to(this.UsableOutline.in(0));
        this.UsableOutline.out(0).to(this.WriteTheDraft.in(0));
        this.UsableOutline.out(1).to(this.ReturnTheTopic.in(0));
        this.WriteTheDraft.out(0).to(this.SaveTheDraft.in(0));
        this.SaveTheDraft.out(0).to(this.AskForApproval.in(0));

        this.Outline.uses({
            ai_languageModel: this.OutlineGpt.output,
            ai_outputParser: this.OutlineShape.output,
        });
        this.WriteTheDraft.uses({
            ai_languageModel: this.WriteTheDraftClaude.output,
        });
    }
}
