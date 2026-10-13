import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Brand · Mention monitor
// Nodes   : 15  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Hourly                             scheduleTrigger
// SearchForMentions                  httpRequest                [creds] [retry]
// OneItemPerMention                  code
// AlreadySeen                        supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// KeepTheUnseen                      code
// RememberIt                         supabase                   [creds] [retry]
// NewMention                         if
// ReadTheTone                        agent                      [AI] [onError→regular]
// ReadTheToneGpt                     lmChatOpenAi               [creds] [ai_languageModel]
// ReadTheToneShape                   outputParserStructured     [ai_outputParser]
// ReadTheVerdict                     code
// NeedsAttention                     if
// WriteTheAlert                      code
// RaiseIt                            executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Hourly
//    → SearchForMentions
//      → OneItemPerMention
//        → AlreadySeen
//          → KeepTheUnseen
//            → RememberIt
//              → NewMention
//                → ReadTheTone
//                  → ReadTheVerdict
//                    → NeedsAttention
//                      → WriteTheAlert
//                        → RaiseIt
//
// AI CONNECTIONS
// ReadTheTone.uses({ ai_languageModel: ReadTheToneGpt, ai_outputParser: ReadTheToneShape })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Brand · Mention monitor',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BrandMentionMonitorWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'fd7adbcf-5839-4c98-a544-b11917a87adf',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Brand · Mention monitor
Checks hourly for new mentions of the brand, and raises the negative ones straight away with the text and the link.

**Platforms:** SerpAPI, Supabase, OpenAI
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/content\``,
    };

    @node({
        id: '783f890a-1f56-4274-a82b-85b36463e9ff',
        name: 'Hourly',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 220],
    })
    Hourly = {
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
        id: '1f6f7a17-4b0b-477e-aedd-db2ce240958a',
        name: 'Search for mentions',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 220],
        credentials: { serpApi: { id: '__CRED:serpapi__', name: 'SerpAPI' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SearchForMentions = {
        method: 'GET',
        url: "={{ 'https://serpapi.com/search.json' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'serpApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'q',
                    value: '={{ \'"YourBrand" -site:yourbrand.com\' }}',
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
        id: '5aa5a603-f41c-4f9a-aa3b-de47c512dc3c',
        name: 'One item per mention',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 220],
    })
    OneItemPerMention = {
        jsCode: 'return ($input.first().json.organic_results ?? []).filter((m) => m.link && m.snippet).map((m) => ({ json: { url: m.link, text: String(m.snippet).slice(0, 1500), author: m.source ?? "unknown" } }));',
    };

    @node({
        id: '04434a01-4cdb-45fd-a1f3-f50baec5b005',
        name: 'Already seen',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AlreadySeen = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'seen_mentions',
        returnAll: true,
    };

    @node({
        id: '10500e04-a418-4c77-a8aa-c4aaad3f744f',
        name: 'Keep the unseen',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 220],
    })
    KeepTheUnseen = {
        jsCode: `const seen = new Set($input.all().map((i) => i.json.url).filter(Boolean));
return $("One item per mention").all().filter((i) => !seen.has(i.json.url));`,
    };

    @node({
        id: '0f96b39f-4736-4171-a25c-778a1b16321f',
        name: 'Remember it',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RememberIt = {
        resource: 'row',
        operation: 'create',
        tableId: 'seen_mentions',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'url',
                    fieldValue: '={{ $json.url }}',
                },
                {
                    fieldId: 'text',
                    fieldValue: '={{ $json.text }}',
                },
                {
                    fieldId: 'author',
                    fieldValue: '={{ $json.author }}',
                },
            ],
        },
    };

    @node({
        id: '9f0e05e0-d6d4-41ba-a9e4-7c45edf88955',
        name: 'New mention?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 220],
    })
    NewMention = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '0af0568a-5483-443d-a949-162ab3b25f45',
                    leftValue: '={{ !!$json.url }}',
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
        id: '709e6a7c-db85-41d5-a448-3325ef6a0625',
        name: 'Read the tone',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1920, 90],
        onError: 'continueRegularOutput',
    })
    ReadTheTone = {
        promptType: 'define',
        text: '={{ $json.text }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                "[task:classify] Classify a public mention of a brand. Reply with JSON: { label: string, urgent: boolean, sentiment: 'negative'|'neutral'|'positive' }.",
            maxIterations: 2,
        },
    };

    @node({
        id: '2d449a17-d4b7-403c-ace6-23627f1c2c5f',
        name: 'Read the tone · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [1820, 310],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    ReadTheToneGpt = {
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
        id: '8a8704b2-79d0-4b8e-a37a-243dcfd4ce06',
        name: 'Read the tone · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [2020, 310],
    })
    ReadTheToneShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "label": "billing",
  "urgent": false,
  "sentiment": "neutral"
}`,
    };

    @node({
        id: 'a33254dd-9d01-4f63-afb8-8192e282cd8a',
        name: 'Read the verdict',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2280, 220],
    })
    ReadTheVerdict = {
        jsCode: `const before = $("New mention?").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : {"sentiment":"unknown"}), parse_error: !ok } });
}
return out;`,
    };

    @node({
        id: 'c611beb0-43ce-4506-ae34-bb8a59e94758',
        name: 'Needs attention?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2540, 220],
    })
    NeedsAttention = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '9f752473-dabe-43f0-ab0a-a87aeeda6155',
                    leftValue: "={{ $json.sentiment === 'negative' || $json.sentiment === 'unknown' }}",
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
        id: '111a576d-cccd-4ada-af8f-6d8381d791be',
        name: 'Write the alert',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2800, 220],
    })
    WriteTheAlert = {
        jsCode: 'return $input.all().map((i) => ({ json: { channel: "#brand", level: "warn", text: (i.json.sentiment === "unknown" ? "Unclassified" : "Negative") + " mention by " + i.json.author + ": \\"" + i.json.text.slice(0, 240) + "\\" " + i.json.url } }));',
    };

    @node({
        id: 'a257aad1-dddc-44ca-ad56-a889b9f0f97b',
        name: 'Raise it',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [3060, 220],
    })
    RaiseIt = {
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
        this.Hourly.out(0).to(this.SearchForMentions.in(0));
        this.SearchForMentions.out(0).to(this.OneItemPerMention.in(0));
        this.OneItemPerMention.out(0).to(this.AlreadySeen.in(0));
        this.AlreadySeen.out(0).to(this.KeepTheUnseen.in(0));
        this.KeepTheUnseen.out(0).to(this.RememberIt.in(0));
        this.RememberIt.out(0).to(this.NewMention.in(0));
        this.NewMention.out(0).to(this.ReadTheTone.in(0));
        this.ReadTheTone.out(0).to(this.ReadTheVerdict.in(0));
        this.ReadTheVerdict.out(0).to(this.NeedsAttention.in(0));
        this.NeedsAttention.out(0).to(this.WriteTheAlert.in(0));
        this.WriteTheAlert.out(0).to(this.RaiseIt.in(0));

        this.ReadTheTone.uses({
            ai_languageModel: this.ReadTheToneGpt.output,
            ai_outputParser: this.ReadTheToneShape.output,
        });
    }
}
