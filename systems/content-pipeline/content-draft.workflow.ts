import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Content pipeline · Research and draft
// Nodes   : 15  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Weekdays0700                       scheduleTrigger
// NextTopic                          httpRequest                [alwaysOutput] [retry]
// IsThereOne                         if
// ClaimTheTopic                      httpRequest                [retry]
// Research                           httpRequest                [onError→regular] [retry]
// CollectSources                     code
// Outline                            httpRequest                [retry]
// ReadTheOutline                     code
// UsableOutline                      if
// WriteTheDraft                      httpRequest                [retry]
// SaveTheDraft                       httpRequest                [retry]
// AskForApproval                     httpRequest                [retry]
// ReturnTheTopic                     httpRequest                [retry]
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
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Content pipeline · Research and draft
Takes the next topic off the list, researches it, drafts the article, and asks a person to approve it. Nothing is published from here.

**Needs:** CHAT_API_KEY, CHAT_BASE_URL, DB_API_KEY, DB_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, SEARCH_API_KEY, SEARCH_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/content-pipeline\``,
    };

    @node({
        id: '0d978302-c53c-4e6b-a20e-6a90f5e40a83',
        name: 'Weekdays 07:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    NextTopic = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/content_topics',
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
                    name: 'status',
                    value: "={{ 'eq.queued' }}",
                },
                {
                    name: 'limit',
                    value: "={{ '1' }}",
                },
            ],
        },
    };

    @node({
        id: '5bb76069-560f-4701-a855-641b3a766e57',
        name: 'Is there one?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [480, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimTheTopic = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/content_topics',
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
                    name: 'id',
                    value: "={{ 'eq.' + $json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'drafting' }) }}",
    };

    @node({
        id: 'd3ac425a-e1bc-494a-add7-70e6f4f1885f',
        name: 'Research',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, 0],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Research = {
        method: 'POST',
        url: '={{ $env.SEARCH_BASE_URL }}/search',
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
        jsonBody: "={{ JSON.stringify({ query: $('Is there one?').first().json.topic, max_results: 5 }) }}",
    };

    @node({
        id: '1e64b3ba-f22f-4d17-ac6b-1a969d4c1058',
        name: 'Collect sources',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1200, 0],
    })
    CollectSources = {
        jsCode: `const t = $("Is there one?").first().json;
const results = ($input.first().json.results ?? []).slice(0, 5);
return [{ json: { topic_id: t.id, topic: t.topic, sources: results.map((r) => ({ title: r.title, url: r.url })), notes: results.map((r) => "- " + r.title + ": " + String(r.content ?? "").slice(0, 400)).join("\\n") } }];`,
    };

    @node({
        id: 'a642d55a-764b-4c6f-a2bd-7c8be9a76bf0',
        name: 'Outline',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Outline = {
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
    { role: "system", content: "[task:outline] Write an article outline as JSON: { title: string, sections: string[], keywords: string[] }. Use only facts found in the research notes." },
    { role: "user", content: 'Topic: ' + $json.topic + '\\n\\nResearch notes:\\n' + ($json.notes || '(none)') }
  ]
}) }}`,
    };

    @node({
        id: '7006d8a4-39a7-470a-a65a-0c1014a71cf6',
        name: 'Read the outline',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1680, 0],
    })
    ReadTheOutline = {
        jsCode: `const before = $("Collect sources").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"title":null,"sections":[],"keywords":[]};
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
        id: '7abc4d7f-5b9f-4451-a167-84dd9078c1cc',
        name: 'Usable outline?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1920, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2160, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WriteTheDraft = {
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
  messages: [
    { role: "system", content: "[task:draft] Write the article in Markdown from this outline. Plain language, no invented statistics, cite only the sources listed." },
    { role: "user", content: JSON.stringify({ title: $json.title, sections: $json.sections, sources: $json.sources }) }
  ]
}) }}`,
    };

    @node({
        id: '18d3527e-aff3-483c-a15c-2ce30a62dee4',
        name: 'Save the draft',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2400, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheDraft = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/content_drafts',
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
            "={{ JSON.stringify({ topic_id: $('Usable outline?').first().json.topic_id, title: $('Usable outline?').first().json.title, keywords: $('Usable outline?').first().json.keywords, sources: $('Usable outline?').first().json.sources, body: $json.choices[0].message.content, status: 'awaiting_approval', created_at: $now.toISO() }) }}",
    };

    @node({
        id: '1f860db6-5ddb-4767-a6ac-e203553b5a11',
        name: 'Ask for approval',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2640, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AskForApproval = {
        method: 'POST',
        url: '={{ $env.CHAT_BASE_URL }}/chat.postMessage',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CHAT_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ channel: '#content', text: ':memo: Draft ready for review: \"' + $json.title + '\"', draft_id: $json.id, actions: ['approve', 'reject'] }) }}",
    };

    @node({
        id: '445a2090-f167-40c6-a5eb-f181b8dbe0f3',
        name: 'Return the topic',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2160, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReturnTheTopic = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/content_topics',
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
                    name: 'id',
                    value: "={{ 'eq.' + $json.topic_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'needs_brief' }) }}",
    };

    @node({
        id: 'a3d9e506-67df-42bb-afd9-49294a675833',
        name: 'Queue is empty',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [720, 90],
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
    }
}
