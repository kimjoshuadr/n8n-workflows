import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SEO · Broken link check
// Nodes   : 8  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Sunday2300                         scheduleTrigger
// PagesToCheck                       httpRequest                [alwaysOutput] [retry]
// VisitThePage                       httpRequest                [onError→regular]
// FindTheBrokenOnes                  code
// AnyBroken                          if
// ReportThem                         httpRequest                [retry]
// SaveTheRun                         httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Sunday2300
//    → PagesToCheck
//      → VisitThePage
//        → FindTheBrokenOnes
//          → AnyBroken
//            → ReportThem
//              → SaveTheRun
//           .out(1) → SaveTheRun (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'SEO · Broken link check',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SeoBrokenLinkCheckWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '1899a43d-f976-47a6-add6-a7c84a792a69',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## SEO · Broken link check
Every Sunday night, visits each page in the sitemap list and reports the ones that no longer load, with the status each returned.

**Platforms:** none, this is logic only
**Settings:** CHAT_API_KEY, CHAT_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/content\``,
    };

    @node({
        id: '64bf7497-7acb-4077-ac69-ddb08c528331',
        name: 'Sunday 23:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    Sunday2300 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 23 * * 0',
                },
            ],
        },
    };

    @node({
        id: '8fa0038a-a8b3-4563-aa94-abf2505256d6',
        name: 'Pages to check',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PagesToCheck = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/site_pages',
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
        id: 'f6a14775-0815-4ee8-a343-bc8acbc85627',
        name: 'Visit the page',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 90],
        onError: 'continueRegularOutput',
    })
    VisitThePage = {
        method: 'GET',
        url: '={{ $json.url }}',
        options: {
            timeout: 15000,
            response: {
                response: {
                    fullResponse: true,
                    neverError: true,
                },
            },
        },
    };

    @node({
        id: '690182e4-2c28-4f58-a0fd-666bed0f6d85',
        name: 'Find the broken ones',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 90],
    })
    FindTheBrokenOnes = {
        jsCode: `const pages = $("Pages to check").all();
const results = $input.all().map((item, i) => ({ url: pages[i]?.json.url, status: item.json.statusCode ?? 0 })).filter((r) => r.url);
const broken = results.filter((r) => r.status === 0 || r.status >= 400);
return [{ json: { checked: results.length, broken, any: broken.length > 0, text: broken.length + " of " + results.length + " pages are broken:\\n" + broken.map((b) => "- " + b.url + " (" + (b.status || "no response") + ")").join("\\n") } }];`,
    };

    @node({
        id: '450bc51c-1ede-4a2f-ae89-2fbba4be183c',
        name: 'Any broken?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 90],
    })
    AnyBroken = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'cb0ed925-8588-45a1-a4c2-bfe199fdbc84',
                    leftValue: '={{ $json.any }}',
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
        id: '8b399977-3748-4f85-a978-495a85a9dd35',
        name: 'Report them',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReportThem = {
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
        jsonBody: "={{ JSON.stringify({ channel: '#website', text: ':link: ' + $json.text }) }}",
    };

    @node({
        id: '457c27ef-751e-4d52-a4d3-dd43cc695c91',
        name: 'Save the run',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheRun = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/link_checks',
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
            "={{ JSON.stringify({ checked: $('Find the broken ones').first().json.checked, broken: $('Find the broken ones').first().json.broken.length, at: $now.toISO() }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Sunday2300.out(0).to(this.PagesToCheck.in(0));
        this.PagesToCheck.out(0).to(this.VisitThePage.in(0));
        this.VisitThePage.out(0).to(this.FindTheBrokenOnes.in(0));
        this.FindTheBrokenOnes.out(0).to(this.AnyBroken.in(0));
        this.AnyBroken.out(0).to(this.ReportThem.in(0));
        this.AnyBroken.out(1).to(this.SaveTheRun.in(0));
        this.ReportThem.out(0).to(this.SaveTheRun.in(0));
    }
}
