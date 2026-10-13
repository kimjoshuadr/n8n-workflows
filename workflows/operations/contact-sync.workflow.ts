import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Data · CRM to email list sync
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every15Minutes                     scheduleTrigger
// ReadTheBookmark                    httpRequest                [alwaysOutput] [retry]
// StartFrom                          code
// ChangedContacts                    httpRequest                [retry]
// ShapeForTheList                    code
// AnythingChanged                    if
// UpsertToTheList                    httpRequest                [retry]
// MoveTheBookmark                    httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every15Minutes
//    → ReadTheBookmark
//      → StartFrom
//        → ChangedContacts
//          → ShapeForTheList
//            → AnythingChanged
//              → UpsertToTheList
//                → MoveTheBookmark
//             .out(1) → MoveTheBookmark (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Data · CRM to email list sync',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class DataCrmToEmailListSyncWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '4ee8e489-1f9f-4fc0-a3e8-3717252f268e',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Data · CRM to email list sync
Copies contacts changed since the last run from the CRM to the email platform, page by page, and only moves its bookmark forward when a run finishes.

**Platforms:** none, this is logic only
**Settings:** CRM_API_KEY, CRM_BASE_URL, DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/operations\``,
    };

    @node({
        id: '31cf76fa-79f6-4a1a-a75a-bd45f2507f43',
        name: 'Every 15 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    Every15Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 15,
                },
            ],
        },
    };

    @node({
        id: '5211d1f3-4653-42dc-a18a-68cafffa7f2a',
        name: 'Read the bookmark',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadTheBookmark = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/sync_cursors',
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
                    name: 'name',
                    value: "={{ 'eq.crm-to-email' }}",
                },
            ],
        },
    };

    @node({
        id: 'a55fb70f-c8e8-4d21-a637-f6933b556ef2',
        name: 'Start from',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    StartFrom = {
        jsCode: 'return [{ json: { since: $input.first().json.value ?? "1970-01-01T00:00:00Z", started_at: new Date().toISOString() } }];',
    };

    @node({
        id: 'fd0e52ca-6250-41aa-ac4c-2337ef587b59',
        name: 'Changed contacts',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ChangedContacts = {
        method: 'POST',
        url: '={{ $env.CRM_BASE_URL }}/crm/v3/objects/contacts/search',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CRM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ modified_since: $json.since, limit: 200 }) }}',
    };

    @node({
        id: '6f78b527-4253-4050-acd8-0779ebb82370',
        name: 'Shape for the list',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 90],
    })
    ShapeForTheList = {
        jsCode: `const rows = ($input.first().json.results ?? []).filter((c) => c.email);
return [{ json: { count: rows.length, contacts: rows.map((c) => ({ email: String(c.email).toLowerCase(), first_name: c.firstname ?? "", tags: [c.lifecyclestage].filter(Boolean), unsubscribed: c.unsubscribed === true })) } }];`,
    };

    @node({
        id: '711c4171-b7c0-448b-a51c-2b72b72e96d6',
        name: 'Anything changed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1300, 90],
    })
    AnythingChanged = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'de3b020d-865c-4a64-a65a-927ca4a2ce35',
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
        id: 'fb8ea85e-2e1a-499b-a923-117a3a52782c',
        name: 'Upsert to the list',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpsertToTheList = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/audiences/contacts/batch',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.EMAIL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ contacts: $json.contacts }) }}',
    };

    @node({
        id: '47dc46b7-b811-4c01-a5b9-df2020ad4bf9',
        name: 'Move the bookmark',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MoveTheBookmark = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/sync_cursors',
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
                {
                    name: 'Prefer',
                    value: 'resolution=merge-duplicates',
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'name' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ name: 'crm-to-email', value: $('Start from').first().json.started_at }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Every15Minutes.out(0).to(this.ReadTheBookmark.in(0));
        this.ReadTheBookmark.out(0).to(this.StartFrom.in(0));
        this.StartFrom.out(0).to(this.ChangedContacts.in(0));
        this.ChangedContacts.out(0).to(this.ShapeForTheList.in(0));
        this.ShapeForTheList.out(0).to(this.AnythingChanged.in(0));
        this.AnythingChanged.out(0).to(this.UpsertToTheList.in(0));
        this.AnythingChanged.out(1).to(this.MoveTheBookmark.in(0));
        this.UpsertToTheList.out(0).to(this.MoveTheBookmark.in(0));
    }
}
