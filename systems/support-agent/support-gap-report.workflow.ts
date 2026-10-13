import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support agent · Weekly gap report
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Monday0800                         scheduleTrigger
// UnansweredLastWeek                 httpRequest                [alwaysOutput] [retry]
// GatherTheQuestions                 code
// AnyGaps                            if
// GroupIntoTopics                    httpRequest                [retry]
// PostTheReport                      httpRequest                [retry]
// PostAllClear                       httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Monday0800
//    → UnansweredLastWeek
//      → GatherTheQuestions
//        → AnyGaps
//          → GroupIntoTopics
//            → PostTheReport
//         .out(1) → PostAllClear
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Support agent · Weekly gap report',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SupportAgentWeeklyGapReportWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '545ae2af-fdac-4c91-adb6-877fb99f72aa',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Support agent · Weekly gap report
Every Monday, reads what the agent could not answer last week and tells the team which help articles are missing.

**Platforms:** none, this is logic only
**Settings:** CHAT_API_KEY, CHAT_BASE_URL, DB_API_KEY, DB_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/support-agent\``,
    };

    @node({
        id: '53f670c1-891f-4239-a05a-8d68c1337288',
        name: 'Monday 08:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
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
        id: '670118fd-c33c-425b-a4ce-bf135d4af0a5',
        name: 'Unanswered last week',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UnansweredLastWeek = {
        method: 'GET',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'answered',
                    value: "={{ 'eq.false' }}",
                },
                {
                    name: 'at',
                    value: "={{ 'gte.' + $now.minus({ days: 7 }).toISO() }}",
                },
            ],
        },
    };

    @node({
        id: 'a8eb664c-7df9-407a-ae73-efefc86805a7',
        name: 'Gather the questions',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 180],
    })
    GatherTheQuestions = {
        jsCode: `const qs = $input.all().map((i) => i.json.question).filter(Boolean);
return [{ json: { count: qs.length, questions: qs.slice(0, 80).map((q) => "- " + String(q).slice(0, 200)).join("\\n") } }];`,
    };

    @node({
        id: '7ead2bda-48fb-41ac-aa14-09eb047577d8',
        name: 'Any gaps?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
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
        id: '7d797618-81eb-4794-a9c9-5663c0c21007',
        name: 'Group into topics',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GroupIntoTopics = {
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
    { role: "system", content: "[task:summarise] Group these unanswered support questions into at most five topics. For each, give the topic, how many questions, and the help article that would have answered them. Plain text." },
    { role: "user", content: $json.questions }
  ]
}) }}`,
    };

    @node({
        id: '8b53cf61-0843-4d92-aa2f-b44070a00f4f',
        name: 'Post the report',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheReport = {
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
            "={{ JSON.stringify({ channel: '#support', text: ':books: ' + $('Gather the questions').first().json.count + ' questions went to a person last week.\\n' + $json.choices[0].message.content }) }}",
    };

    @node({
        id: '73384992-fd9b-42be-aa60-427db5c956b3',
        name: 'Post all clear',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostAllClear = {
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
            "={{ JSON.stringify({ channel: '#support', text: ':white_check_mark: The agent answered everything it was asked last week.' }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Monday0800.out(0).to(this.UnansweredLastWeek.in(0));
        this.UnansweredLastWeek.out(0).to(this.GatherTheQuestions.in(0));
        this.GatherTheQuestions.out(0).to(this.AnyGaps.in(0));
        this.AnyGaps.out(0).to(this.GroupIntoTopics.in(0));
        this.AnyGaps.out(1).to(this.PostAllClear.in(0));
        this.GroupIntoTopics.out(0).to(this.PostTheReport.in(0));
    }
}
