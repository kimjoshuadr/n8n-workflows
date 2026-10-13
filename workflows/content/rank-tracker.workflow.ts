import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SEO · Keyword rank tracker
// Nodes   : 11  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _0500Daily                         scheduleTrigger
// TrackedKeywords                    httpRequest                [alwaysOutput] [retry]
// SearchForIt                        httpRequest                [onError→regular] [retry]
// FindOurPosition                    code
// GotAResult                         if
// RecordToday                        httpRequest                [retry]
// UpdateTheKeyword                   httpRequest                [retry]
// GatherTheDrops                     code
// Alert                              executeWorkflow
// SearchFailedKeepYesterday          noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _0500Daily
//    → TrackedKeywords
//      → SearchForIt
//        → FindOurPosition
//          → GotAResult
//            → RecordToday
//              → UpdateTheKeyword
//                → GatherTheDrops
//                  → Alert
//           .out(1) → SearchFailedKeepYesterday
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'SEO · Keyword rank tracker',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SeoKeywordRankTrackerWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'd0c1473d-46df-4478-ab66-a7b8d05afaaf',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## SEO · Keyword rank tracker
Records where the site ranks for each tracked keyword every day, and alerts when one falls five places or drops off the first page.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, SEARCH_API_KEY, SEARCH_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/content\``,
    };

    @node({
        id: '7088e2ba-68f5-463b-aa23-ed2f4b1464bc',
        name: '05:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
    })
    _0500Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 5 * * *',
                },
            ],
        },
    };

    @node({
        id: '93568259-4da4-4912-aec0-7288e35a5379',
        name: 'Tracked keywords',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TrackedKeywords = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/keywords',
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
    };

    @node({
        id: '46728195-3a4d-41e7-a6a9-fb7b6af5d707',
        name: 'Search for it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 180],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SearchForIt = {
        method: 'POST',
        url: '={{ $env.SEARCH_BASE_URL }}/serp',
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
        jsonBody: '={{ JSON.stringify({ query: $json.keyword, num: 30 }) }}',
    };

    @node({
        id: '16c88ff0-1d72-41d0-a1d8-08d2967004cb',
        name: 'Find our position',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 180],
    })
    FindOurPosition = {
        jsCode: `const kws = $("Tracked keywords").all();
return $input.all().map((item, i) => {
  const k = kws[i]?.json;
  if (!k?.keyword) return null;
  const results = item.json.results;
  if (!Array.isArray(results)) return { json: { ...k, position: null, checked: false } };
  const idx = results.findIndex((r) => String(r.url ?? "").includes(k.domain));
  const position = idx === -1 ? null : idx + 1;
  const before = k.last_position ?? null;
  const fell = before !== null && (position === null || position - before >= 5);
  const offFirstPage = before !== null && before <= 10 && (position === null || position > 10);
  return { json: { ...k, position, before, checked: true, alert: fell || offFirstPage } };
}).filter(Boolean);`,
    };

    @node({
        id: '80c5ba5f-d592-497d-a633-63c769914243',
        name: 'Got a result?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    GotAResult = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '736a0f7e-147b-4f5c-a53a-b3694398cd04',
                    leftValue: '={{ $json.checked }}',
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
        id: '7fb769f1-eae5-43e7-ad02-ccf615078f6b',
        name: 'Record today',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordToday = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/rank_history',
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
        jsonBody: '={{ JSON.stringify({ keyword: $json.keyword, position: $json.position, at: $now.toISO() }) }}',
    };

    @node({
        id: 'e47b9f1c-9133-4c51-aef5-2819eb56261b',
        name: 'Update the keyword',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpdateTheKeyword = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/keywords',
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
                    name: 'keyword',
                    value: "={{ 'eq.' + $('Got a result?').item.json.keyword }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ last_position: $('Got a result?').item.json.position, checked_at: $now.toISO() }) }}",
    };

    @node({
        id: 'db1a4d9a-0c7c-4beb-a80e-dc9f3c0f0c54',
        name: 'Gather the drops',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 180],
    })
    GatherTheDrops = {
        jsCode: `const drops = $("Got a result?").all().map((i) => i.json).filter((k) => k.alert);
if (!drops.length) return [];
return [{ json: { channel: "#seo", level: "warn", text: drops.length + " keyword(s) dropped: " + drops.map((d) => "\\"" + d.keyword + "\\" " + d.before + " to " + (d.position ?? "not in top 30")).join("; ") } }];`,
    };

    @node({
        id: 'd7a6ee0b-7089-424c-a59b-c0209e3b07ad',
        name: 'Alert',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2080, 180],
    })
    Alert = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '8dda734b-cae2-4de8-a5a5-42069bc76550',
        name: 'Search failed, keep yesterday',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    SearchFailedKeepYesterday = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this._0500Daily.out(0).to(this.TrackedKeywords.in(0));
        this.TrackedKeywords.out(0).to(this.SearchForIt.in(0));
        this.SearchForIt.out(0).to(this.FindOurPosition.in(0));
        this.FindOurPosition.out(0).to(this.GotAResult.in(0));
        this.GotAResult.out(0).to(this.RecordToday.in(0));
        this.GotAResult.out(1).to(this.SearchFailedKeepYesterday.in(0));
        this.RecordToday.out(0).to(this.UpdateTheKeyword.in(0));
        this.UpdateTheKeyword.out(0).to(this.GatherTheDrops.in(0));
        this.GatherTheDrops.out(0).to(this.Alert.in(0));
    }
}
