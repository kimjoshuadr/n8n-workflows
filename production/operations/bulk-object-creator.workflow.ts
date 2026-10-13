import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Data · Bulk object creator
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenClickingExecuteWorkflow        manualTrigger
// GetData                            googleSheets               [creds] [retry]
// ForEachData                        splitInBatches
// CreateObject                       bubble                     [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenClickingExecuteWorkflow
//    → GetData
//      → ForEachData
//       .out(1) → CreateObject
//          → ForEachData (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Data · Bulk object creator',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class DataBulkObjectCreatorWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'c3a9ae35-94b8-4e1e-aa27-1fbf69e2959c',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Data · Bulk object creator
One click reads every row of a sheet and creates an object in the Bubble database for each, one at a time.

**Platforms:** Google Sheets, Bubble
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/operations\``,
    };

    @node({
        id: '172e4f8d-0c27-4f34-a4a5-0f99feac11d2',
        name: "When clicking 'Execute workflow'",
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 90],
    })
    WhenClickingExecuteWorkflow = {};

    @node({
        id: 'a4c917e4-7e21-46ab-ad09-0307344dea8a',
        name: 'get_data',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [260, 90],
        credentials: { googleSheetsOAuth2Api: { id: '__CRED:googleSheets__', name: 'Google Sheets' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetData = {
        resource: 'sheet',
        operation: 'read',
        documentId: {
            __rl: true,
            mode: 'id',
            value: 'import-sheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Import',
        },
        options: {},
    };

    @node({
        id: 'd3822949-6a0d-4bdb-aa74-5ebf285c7fe7',
        name: 'for_each_data',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [520, 90],
    })
    ForEachData = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'd54183a3-64bc-49e6-acb4-7b71ec4ad911',
        name: 'create_object',
        type: 'n8n-nodes-base.bubble',
        version: 1,
        position: [780, 90],
        credentials: { bubbleApi: { id: '__CRED:bubble__', name: 'Bubble' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateObject = {
        resource: 'object',
        operation: 'create',
        typeName: 'event',
        properties: {
            property: [
                {
                    key: 'title',
                    value: '={{ $json.title }}',
                },
                {
                    key: 'date',
                    value: "={{ $json.date ?? '' }}",
                },
                {
                    key: 'location',
                    value: "={{ $json.location ?? '' }}",
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenClickingExecuteWorkflow.out(0).to(this.GetData.in(0));
        this.GetData.out(0).to(this.ForEachData.in(0));
        this.ForEachData.out(1).to(this.CreateObject.in(0));
        this.CreateObject.out(0).to(this.ForEachData.in(0));
    }
}
