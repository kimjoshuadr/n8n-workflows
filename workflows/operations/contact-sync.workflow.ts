import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Data · CRM to email list sync
// Nodes   : 12  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every15Minutes                     scheduleTrigger
// ReadTheBookmark                    supabase                   [creds] [alwaysOutput] [retry]
// StartFrom                          code
// ChangedContacts                    httpRequest                [creds] [retry]
// ShapeForTheList                    code
// AnythingChanged                    if
// UpsertToTheList                    httpRequest                [creds] [retry]
// MoveTheBookmark                    supabase                   [creds] [alwaysOutput] [retry]
// HadABookmark                       if
// StartTheBookmark                   supabase                   [creds] [retry]
// BookmarkMoved                      noOp
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
//                  → HadABookmark
//                    → BookmarkMoved
//                   .out(1) → StartTheBookmark
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

**Platforms:** Supabase, HubSpot, Mailchimp
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/operations\``,
    };

    @node({
        id: '31cf76fa-79f6-4a1a-a75a-bd45f2507f43',
        name: 'Every 15 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadTheBookmark = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'sync_cursors',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'name',
                    condition: 'eq',
                    keyValue: "={{ 'crm-to-email' }}",
                },
            ],
        },
    };

    @node({
        id: 'a55fb70f-c8e8-4d21-a637-f6933b556ef2',
        name: 'Start from',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 180],
    })
    StartFrom = {
        jsCode: 'return [{ json: { since: $input.first().json.value ?? "1970-01-01T00:00:00Z", started_at: new Date().toISOString() } }];',
    };

    @node({
        id: 'fd0e52ca-6250-41aa-ac4c-2337ef587b59',
        name: 'Changed contacts',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 180],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ChangedContacts = {
        method: 'POST',
        url: "={{ 'https://api.hubapi.com/crm/v3/objects/contacts/search' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'hubspotAppToken',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: $json.since }] }], properties: ['email', 'firstname', 'lifecyclestage', 'hs_email_optout'], limit: 100 }) }}",
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '6f78b527-4253-4050-acd8-0779ebb82370',
        name: 'Shape for the list',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 180],
    })
    ShapeForTheList = {
        jsCode: `const rows = ($input.first().json.results ?? []).map((c) => c.properties ?? {}).filter((c) => c.email);
// An opt-out in HubSpot travels with the contact, so Mailchimp never mails someone the CRM says not to.
return [{ json: { count: rows.length, members: rows.map((c) => ({ email_address: String(c.email).toLowerCase(), status: String(c.hs_email_optout) === "true" ? "unsubscribed" : "subscribed", merge_fields: { FNAME: c.firstname ?? "" }, tags: [c.lifecyclestage].filter(Boolean) })) } }];`,
    };

    @node({
        id: '711c4171-b7c0-448b-a51c-2b72b72e96d6',
        name: 'Anything changed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1300, 180],
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
        position: [1560, 180],
        credentials: { mailchimpApi: { id: '__CRED:mailchimp__', name: 'Mailchimp' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpsertToTheList = {
        method: 'POST',
        url: "={{ 'https://us1.api.mailchimp.com/3.0/lists/main-list' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'mailchimpApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ members: $json.members, update_existing: true }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '47dc46b7-b811-4c01-a5b9-df2020ad4bf9',
        name: 'Move the bookmark',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1820, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MoveTheBookmark = {
        resource: 'row',
        operation: 'update',
        tableId: 'sync_cursors',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'name',
                    condition: 'eq',
                    keyValue: "={{ 'crm-to-email' }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'value',
                    fieldValue: "={{ $('Start from').first().json.started_at }}",
                },
            ],
        },
    };

    @node({
        id: '5c0a4934-d20a-4101-a9a1-379e3cc2471c',
        name: 'Had a bookmark?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2080, 180],
    })
    HadABookmark = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '0053a14e-c2ea-45a0-af15-03a51e486e70',
                    leftValue: '={{ !!$json.name }}',
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
        id: 'c5686ce7-6581-4732-a3c6-96b9385a041e',
        name: 'Start the bookmark',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2340, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    StartTheBookmark = {
        resource: 'row',
        operation: 'create',
        tableId: 'sync_cursors',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'name',
                    fieldValue: "={{ 'crm-to-email' }}",
                },
                {
                    fieldId: 'value',
                    fieldValue: "={{ $('Start from').first().json.started_at }}",
                },
            ],
        },
    };

    @node({
        id: '3baa9c25-5c30-476a-a699-97b4553b388c',
        name: 'Bookmark moved',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [2340, 270],
    })
    BookmarkMoved = {};

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
        this.MoveTheBookmark.out(0).to(this.HadABookmark.in(0));
        this.HadABookmark.out(0).to(this.BookmarkMoved.in(0));
        this.HadABookmark.out(1).to(this.StartTheBookmark.in(0));
    }
}
