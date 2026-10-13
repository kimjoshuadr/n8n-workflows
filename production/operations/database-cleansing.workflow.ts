import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Data · Database cleansing
// Nodes   : 9  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Execute                            manualTrigger
// GetObjects1                        bubble                     [creds] [retry]
// RemoveDuplicates                   removeDuplicates
// FilterCriteria1                    filter
// Aggregate                          aggregate                  [alwaysOutput]
// GetObjects2                        bubble                     [creds] [retry]
// FilterCriteria3                    filter
// DeleteObject                       bubble                     [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Execute
//    → GetObjects1
//      → RemoveDuplicates
//        → FilterCriteria1
//          → Aggregate
//            → GetObjects2
//              → FilterCriteria3
//                → DeleteObject
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Data · Database cleansing',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class DataDatabaseCleansingWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '6ec51746-c0da-4b2c-a895-ba0c158363f9',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Data · Database cleansing
On demand, reads every object of one type from the Bubble database, keeps the first of each set of duplicates as the master, and deletes the rest.

**Platforms:** Bubble
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/operations\``,
    };

    @node({
        id: '4678c1af-411e-44da-a913-3f8380f5c285',
        name: 'execute',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 90],
    })
    Execute = {};

    @node({
        id: 'e0a4b6c1-232e-4341-a64d-377d838a0929',
        name: 'get_objects_1',
        type: 'n8n-nodes-base.bubble',
        version: 1,
        position: [260, 90],
        credentials: { bubbleApi: { id: '__CRED:bubble__', name: 'Bubble' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetObjects1 = {
        resource: 'object',
        operation: 'getAll',
        typeName: 'contact',
        returnAll: true,
        options: {
            filters: {
                filter: [
                    {
                        key: 'email',
                        constraint_type: 'is_not_empty',
                    },
                ],
            },
        },
    };

    @node({
        id: '1faeb64c-f3cb-4b95-a56c-140dffc93134',
        name: 'remove_duplicates',
        type: 'n8n-nodes-base.removeDuplicates',
        version: 2,
        position: [520, 90],
    })
    RemoveDuplicates = {
        compare: 'selectedFields',
        fieldsToCompare: 'email',
        options: {},
    };

    @node({
        id: 'e4370c4f-1aae-4fd5-afc7-e292ffe21263',
        name: 'filter_criteria_1',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [780, 90],
    })
    FilterCriteria1 = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '3b6bba6f-5056-42c8-a1ec-d61057b9d384',
                    leftValue: '={{ !!$json.email }}',
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
        id: 'c23c6770-dda2-49c3-ad31-a73499a5ad9d',
        name: 'aggregate',
        type: 'n8n-nodes-base.aggregate',
        version: 1,
        position: [1040, 90],
        alwaysOutputData: true,
    })
    Aggregate = {
        aggregate: 'aggregateIndividualFields',
        fieldsToAggregate: {
            fieldToAggregate: [
                {
                    fieldToAggregate: '_id',
                    renameField: true,
                    outputFieldName: 'master_ids',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '2faa7a93-bba9-4639-a21a-feaa5cbc5559',
        name: 'get_objects_2',
        type: 'n8n-nodes-base.bubble',
        version: 1,
        position: [1300, 90],
        credentials: { bubbleApi: { id: '__CRED:bubble__', name: 'Bubble' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetObjects2 = {
        resource: 'object',
        operation: 'getAll',
        typeName: 'contact',
        returnAll: true,
        options: {},
    };

    @node({
        id: '90daf67a-9f21-4e21-a3b0-171bdbc46fdf',
        name: 'filter_criteria_3',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1560, 90],
    })
    FilterCriteria3 = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c9c4ab9b-f879-41de-ac71-f6dbe80553b2',
                    leftValue: "={{ !!$json.email && !$('aggregate').first().json.master_ids.includes($json._id) }}",
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
        id: '7374f5fc-33f9-425c-a85d-233506cf0382',
        name: 'delete_object',
        type: 'n8n-nodes-base.bubble',
        version: 1,
        position: [1820, 90],
        credentials: { bubbleApi: { id: '__CRED:bubble__', name: 'Bubble' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DeleteObject = {
        resource: 'object',
        operation: 'delete',
        typeName: 'contact',
        objectId: '={{ $json._id }}',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Execute.out(0).to(this.GetObjects1.in(0));
        this.GetObjects1.out(0).to(this.RemoveDuplicates.in(0));
        this.RemoveDuplicates.out(0).to(this.FilterCriteria1.in(0));
        this.FilterCriteria1.out(0).to(this.Aggregate.in(0));
        this.Aggregate.out(0).to(this.GetObjects2.in(0));
        this.GetObjects2.out(0).to(this.FilterCriteria3.in(0));
        this.FilterCriteria3.out(0).to(this.DeleteObject.in(0));
    }
}
