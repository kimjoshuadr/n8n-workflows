import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Events · Unified event API
// Nodes   : 13  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionAuthentication              stickyNote
// SectionGetEvents                   stickyNote
// SectionDataManipulation            stickyNote
// GetRequest                         webhook
// PlatformLogin                      httpRequest                [retry]
// GetEvents                          httpRequest                [retry]
// GetExternalEvents                  googleSheets               [creds] [alwaysOutput] [executeOnce] [retry]
// SetData                            set                        [executeOnce]
// SplitData                          splitOut                   [alwaysOutput]
// CheckActive                        filter                     [alwaysOutput]
// DataManipulation                   set
// Respond                            respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// GetRequest
//    → PlatformLogin
//      → GetEvents
//        → GetExternalEvents
//          → SetData
//            → SplitData
//              → CheckActive
//                → DataManipulation
//                  → Respond
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Events · Unified event API',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class EventsUnifiedEventApiWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '63a221d2-0663-4a9f-aa82-8be36b9c523e',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Events · Unified event API
One web address that returns every active event. It signs in to the self-hosted event platform, reads its events, adds the Luma events kept in a Google Sheet, drops the past and inactive ones, and answers with one list in one format.

**Platforms:** Google Sheets
**Settings:** EVENTS_BASE_URL, EVENTS_EMAIL, EVENTS_PASSWORD
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/operations\``,
    };

    @node({
        id: '885a9093-e17d-4c21-acd6-a9f72098e211',
        name: 'Section: Authentication',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionAuthentication = {
        width: 640,
        height: 330,
        color: 4,
        content: '## 1. Authentication',
    };

    @node({
        id: '6932a946-649b-4e87-a01a-04182110dd0e',
        name: 'Section: Get events',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 410],
    })
    SectionGetEvents = {
        width: 640,
        height: 330,
        color: 5,
        content: '## 2. Get events',
    };

    @node({
        id: '55dbe601-2b2b-4f0e-a35a-e0bd8b417707',
        name: 'Section: Data manipulation',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 820],
    })
    SectionDataManipulation = {
        width: 1420,
        height: 330,
        color: 6,
        content: '## 3. Data manipulation',
    };

    @node({
        id: '2e80bfda-bba6-4882-a447-133e2e37d3cf',
        webhookId: '18d8040b-1558-4ab6-afe4-dd0562477f53',
        name: 'get_request',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 200],
    })
    GetRequest = {
        httpMethod: 'GET',
        path: 'events',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '8d11d7c5-946b-4d0f-a137-aef32a279609',
        name: 'platform_login',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 200],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PlatformLogin = {
        method: 'POST',
        url: "={{ $env.EVENTS_BASE_URL + '/api/auth/login' }}",
        options: {
            timeout: 15000,
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ email: $env.EVENTS_EMAIL, password: $env.EVENTS_PASSWORD }) }}',
    };

    @node({
        id: 'b99ac373-60fc-4706-a627-ecf65b310d6b',
        name: 'get_events',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [0, 610],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetEvents = {
        method: 'GET',
        url: "={{ $env.EVENTS_BASE_URL + '/api/events' }}",
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $json.token }}",
                },
            ],
        },
    };

    @node({
        id: '429afe79-acf6-40d4-a18d-4e8737d01416',
        name: 'get_external_events',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [260, 610],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetExternalEvents = {
        resource: 'sheet',
        operation: 'read',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'luma-events-sheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Luma events',
        },
        options: {},
    };

    @node({
        id: '7a37757b-8213-4240-a036-2c9828bbe38d',
        name: 'set_data',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 1020],
        executeOnce: true,
    })
    SetData = {
        assignments: {
            assignments: [
                {
                    id: 'fb8962da-845e-4aaa-abbb-90d5eed420dd',
                    name: 'events',
                    value: "={{ ($('get_events').first().json.events ?? []).map((e) => Object.assign({}, e, { source: 'platform' })).concat($('get_external_events').all().map((i) => i.json).filter((e) => e.name).map((e) => ({ id: e.api_id, title: e.name, starts_at: e.start_at, ends_at: e.end_at, url: e.url, status: 'active', source: 'luma' }))) }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '336d905d-ce8e-4d50-af95-5443162d327e',
        name: 'split_data',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [260, 1020],
        alwaysOutputData: true,
    })
    SplitData = {
        fieldToSplitOut: 'events',
        options: {},
    };

    @node({
        id: '28d7ad51-a7ac-47a9-a652-8b0f319cf48e',
        name: 'check_active',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [520, 1020],
        alwaysOutputData: true,
    })
    CheckActive = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '85b70de1-70df-4fd2-a789-e2ea92880498',
                    leftValue:
                        "={{ $json.status === 'active' && new Date($json.ends_at ?? $json.starts_at) >= new Date() }}",
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
        id: '7c6e2160-3e70-4594-abbe-30d41960c2e0',
        name: 'data_manipulation',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 1020],
    })
    DataManipulation = {
        assignments: {
            assignments: [
                {
                    id: 'c8f9ba69-f965-42e8-a75b-fd04bd5ded15',
                    name: 'id',
                    value: '={{ $json.id }}',
                    type: 'string',
                },
                {
                    id: 'fb389d2d-3d27-43cd-a7c7-f73b5a171495',
                    name: 'title',
                    value: '={{ $json.title }}',
                    type: 'string',
                },
                {
                    id: 'e9a58e66-cc80-4abb-ab8c-c5c75c0bb74a',
                    name: 'starts_at',
                    value: '={{ $json.starts_at }}',
                    type: 'string',
                },
                {
                    id: '678563f8-85a0-487a-a607-8baa75dbafdc',
                    name: 'ends_at',
                    value: "={{ $json.ends_at ?? '' }}",
                    type: 'string',
                },
                {
                    id: 'd008bc6a-16e5-4fab-ada9-ca8912b95d4e',
                    name: 'url',
                    value: "={{ $json.url ?? '' }}",
                    type: 'string',
                },
                {
                    id: 'd8fd12a1-03b9-4cc1-a760-68f9bc27346b',
                    name: 'source',
                    value: '={{ $json.source }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'ff30ab46-046e-4c04-a15a-49918f756d40',
        name: 'respond',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1040, 1020],
    })
    Respond = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ count: $input.all().filter((i) => i.json.id).length, events: $input.all().map((i) => i.json).filter((e) => e.id) }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.GetRequest.out(0).to(this.PlatformLogin.in(0));
        this.PlatformLogin.out(0).to(this.GetEvents.in(0));
        this.GetEvents.out(0).to(this.GetExternalEvents.in(0));
        this.GetExternalEvents.out(0).to(this.SetData.in(0));
        this.SetData.out(0).to(this.SplitData.in(0));
        this.SplitData.out(0).to(this.CheckActive.in(0));
        this.CheckActive.out(0).to(this.DataManipulation.in(0));
        this.DataManipulation.out(0).to(this.Respond.in(0));
    }
}
