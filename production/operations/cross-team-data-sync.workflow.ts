import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Data · Cross-team data sync
// Nodes   : 9  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Schedule                           scheduleTrigger
// GetClaims                          bubble                     [creds] [retry]
// GetUsers                           bubble                     [creds] [retry]
// Merge                              merge
// Sort                               sort
// ClearSheet                         googleSheets               [creds] [executeOnce] [retry]
// Merge2                             merge
// CreateRow                          googleSheets               [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Schedule
//    → GetClaims
//      → Merge
//        → Sort
//          → Merge2
//            → CreateRow
//          → ClearSheet
//            → Merge2.in(1) (↩ loop)
//    → GetUsers
//      → Merge.in(1) (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Data · Cross-team data sync',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class DataCrossTeamDataSyncWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'a750b304-5f65-45a9-ad15-ec8dbc186b73',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Data · Cross-team data sync
On a schedule, reads claims and users from the Bubble app's database, joins and sorts them, then clears a shared Google Sheet and refills it, so people without database access always see current data.

**Platforms:** Bubble, Google Sheets
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/operations\``,
    };

    @node({
        id: 'ef016fa3-41ba-4b7e-aa43-c90e79a78a0e',
        name: 'schedule',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
    })
    Schedule = {
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
        id: '50acb739-4101-4eb4-a852-31bfbf2f19de',
        name: 'get_claims',
        type: 'n8n-nodes-base.bubble',
        version: 1,
        position: [260, 90],
        credentials: { bubbleApi: { id: '__CRED:bubble__', name: 'Bubble' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetClaims = {
        resource: 'object',
        operation: 'getAll',
        typeName: 'claim',
        returnAll: true,
        options: {},
    };

    @node({
        id: '8b1fec26-243f-4110-a8d4-7e1432ff427d',
        name: 'get_users',
        type: 'n8n-nodes-base.bubble',
        version: 1,
        position: [260, 270],
        credentials: { bubbleApi: { id: '__CRED:bubble__', name: 'Bubble' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetUsers = {
        resource: 'object',
        operation: 'getAll',
        typeName: 'user',
        returnAll: true,
        options: {},
    };

    @node({
        id: '02f1d52a-8a68-41f8-ab88-3250ef4c8743',
        name: 'merge',
        type: 'n8n-nodes-base.merge',
        version: 3,
        position: [520, 180],
    })
    Merge = {
        mode: 'combine',
        combineBy: 'combineByFields',
        advanced: true,
        mergeByFields: {
            values: [
                {
                    field1: 'user',
                    field2: '_id',
                },
            ],
        },
        joinMode: 'enrichInput1',
        options: {
            clashHandling: {
                values: {
                    resolveClash: 'preferInput1',
                },
            },
        },
    };

    @node({
        id: '05ad149c-5730-42e0-a933-9e6e09000f2f',
        name: 'sort',
        type: 'n8n-nodes-base.sort',
        version: 1,
        position: [780, 180],
    })
    Sort = {
        type: 'simple',
        sortFieldsUi: {
            sortField: [
                {
                    fieldName: 'Created Date',
                    order: 'descending',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'dd648e83-0b3b-4f39-ab5e-230fa3772cec',
        name: 'clear_sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1040, 180],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClearSheet = {
        resource: 'sheet',
        operation: 'clear',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'team-dashboard-sheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Dashboard',
        },
        clear: 'wholeSheet',
        keepFirstRow: true,
    };

    @node({
        id: '56a94ebb-07d8-4a4d-a2a7-3fa03e1f5e24',
        name: 'merge_2',
        type: 'n8n-nodes-base.merge',
        version: 3,
        position: [1300, 180],
    })
    Merge2 = {
        mode: 'chooseBranch',
        chooseBranchMode: 'waitForAll',
        output: 'specifiedInput',
        useDataOfInput: 1,
    };

    @node({
        id: 'd882049e-4b2c-4692-a6e1-2467f71aaf14',
        name: 'create_row',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [1560, 180],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateRow = {
        resource: 'sheet',
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'team-dashboard-sheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Dashboard',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                claim_id: '={{ $json._id }}',
                email: "={{ $json.email ?? '' }}",
                status: "={{ $json.status ?? '' }}",
                amount: "={{ $json.amount ?? '' }}",
                created: "={{ $json['Created Date'] ?? '' }}",
            },
            matchingColumns: ['claim_id'],
            schema: [
                {
                    id: 'claim_id',
                    displayName: 'claim_id',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'email',
                    displayName: 'email',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'status',
                    displayName: 'status',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'amount',
                    displayName: 'amount',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'created',
                    displayName: 'created',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Schedule.out(0).to(this.GetClaims.in(0));
        this.Schedule.out(0).to(this.GetUsers.in(0));
        this.GetClaims.out(0).to(this.Merge.in(0));
        this.GetUsers.out(0).to(this.Merge.in(1));
        this.Merge.out(0).to(this.Sort.in(0));
        this.Sort.out(0).to(this.Merge2.in(0));
        this.Sort.out(0).to(this.ClearSheet.in(0));
        this.ClearSheet.out(0).to(this.Merge2.in(1));
        this.Merge2.out(0).to(this.CreateRow.in(0));
    }
}
