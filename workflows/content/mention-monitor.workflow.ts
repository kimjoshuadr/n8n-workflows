import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Brand · Mention monitor
// Nodes   : 11  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Hourly                             scheduleTrigger
// SearchForMentions                  httpRequest                [retry]
// OneItemPerMention                  code
// ClaimAsSeen                        httpRequest                [alwaysOutput] [retry]
// NewMention                         if
// ReadTheTone                        httpRequest                [onError→regular] [retry]
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
//        → ClaimAsSeen
//          → NewMention
//            → ReadTheTone
//              → ReadTheVerdict
//                → NeedsAttention
//                  → WriteTheAlert
//                    → RaiseIt
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

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, SEARCH_API_KEY, SEARCH_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/content\``,
    };

    @node({
        id: '783f890a-1f56-4274-a82b-85b36463e9ff',
        name: 'Hourly',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
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
        position: [260, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SearchForMentions = {
        method: 'POST',
        url: '={{ $env.SEARCH_BASE_URL }}/mentions',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.SEARCH_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ query: 'YourBrand', since_hours: 2 }) }}",
    };

    @node({
        id: '5aa5a603-f41c-4f9a-aa3b-de47c512dc3c',
        name: 'One item per mention',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    OneItemPerMention = {
        jsCode: 'return ($input.first().json.mentions ?? []).filter((m) => m.url && m.text).map((m) => ({ json: { url: m.url, text: String(m.text).slice(0, 1500), author: m.author ?? "unknown" } }));',
    };

    @node({
        id: '0d4086c4-ba23-454c-a9bf-93759237988d',
        name: 'Claim as seen',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimAsSeen = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/seen_mentions',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'url' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ url: $json.url, text: $json.text, author: $json.author }) }}',
    };

    @node({
        id: '9f0e05e0-d6d4-41ba-a9e4-7c45edf88955',
        name: 'New mention?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 90],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadTheTone = {
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
    { role: "system", content: "[task:classify] Classify a public mention of a brand. Reply with JSON: { label: string, urgent: boolean, sentiment: 'negative'|'neutral'|'positive' }." },
    { role: "user", content: $json.text }
  ]
}) }}`,
    };

    @node({
        id: 'a33254dd-9d01-4f63-afb8-8192e282cd8a',
        name: 'Read the verdict',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 90],
    })
    ReadTheVerdict = {
        jsCode: `const before = $("New mention?").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"sentiment":"unknown"};
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
        id: 'c611beb0-43ce-4506-ae34-bb8a59e94758',
        name: 'Needs attention?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1820, 90],
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
        position: [2080, 90],
    })
    WriteTheAlert = {
        jsCode: 'return $input.all().map((i) => ({ json: { channel: "#brand", level: "warn", text: (i.json.sentiment === "unknown" ? "Unclassified" : "Negative") + " mention by " + i.json.author + ": \\"" + i.json.text.slice(0, 240) + "\\" " + i.json.url } }));',
    };

    @node({
        id: 'a257aad1-dddc-44ca-ad56-a889b9f0f97b',
        name: 'Raise it',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2340, 90],
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
        this.OneItemPerMention.out(0).to(this.ClaimAsSeen.in(0));
        this.ClaimAsSeen.out(0).to(this.NewMention.in(0));
        this.NewMention.out(0).to(this.ReadTheTone.in(0));
        this.ReadTheTone.out(0).to(this.ReadTheVerdict.in(0));
        this.ReadTheVerdict.out(0).to(this.NeedsAttention.in(0));
        this.NeedsAttention.out(0).to(this.WriteTheAlert.in(0));
        this.WriteTheAlert.out(0).to(this.RaiseIt.in(0));
    }
}
