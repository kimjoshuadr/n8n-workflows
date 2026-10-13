import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Incremental sync with a bookmark
// Nodes   : 9  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// RunManually                        manualTrigger
// ReadBookmark                       httpRequest                [alwaysOutput] [retry]
// FetchNewer                         httpRequest                [retry]
// NewestId                           code
// AnythingNew                        if
// WriteRows                          httpRequest                [retry]
// MoveBookmark                       httpRequest                [retry]
// UpToDate                           noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// RunManually
//    → ReadBookmark
//      → FetchNewer
//        → NewestId
//          → AnythingNew
//            → WriteRows
//              → MoveBookmark
//           .out(1) → UpToDate
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Incremental sync with a bookmark',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockIncrementalSyncWithABookmarkWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '8e0f8dd2-fece-4669-a71a-6687f8d7c50a',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Incremental sync with a bookmark
The skeleton of every reliable sync: read the bookmark, fetch what is newer, write it, and only then move the bookmark.

**Platforms:** none, this is logic only
**Settings:** CRM_API_KEY, CRM_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: 'e24463a8-b568-48fe-ae05-15373c8370d7',
        name: 'Run manually',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 180],
    })
    RunManually = {};

    @node({
        id: '2b38276a-8f8a-4515-a388-aa41e4683216',
        name: 'Read bookmark',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadBookmark = {
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
                    value: "={{ 'eq.block-sync' }}",
                },
            ],
        },
    };

    @node({
        id: 'f960397b-b671-4a21-a236-1af63390f3d5',
        name: 'Fetch newer',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FetchNewer = {
        method: 'GET',
        url: '={{ $env.CRM_BASE_URL }}/changes',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'since',
                    value: "={{ $json.value ?? '0' }}",
                },
            ],
        },
    };

    @node({
        id: '69153129-555f-48c3-a271-e3794d2630a2',
        name: 'Newest id',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 180],
    })
    NewestId = {
        jsCode: `const rows = $input.first().json.results ?? [];
return [{ json: { rows, count: rows.length, newest: rows.length ? String(Math.max(...rows.map((r) => Number(r.id)))) : null } }];`,
    };

    @node({
        id: '465e900a-785f-4ea6-a5ce-3f51b223b853',
        name: 'Anything new?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    AnythingNew = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '8895fcd1-c460-45d2-aefa-96592b3fae89',
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
        id: '9917a8a6-4b99-4fa2-accd-0d230b8df6b9',
        name: 'Write rows',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WriteRows = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/synced',
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
        jsonBody: '={{ JSON.stringify($json.rows) }}',
    };

    @node({
        id: '6129f980-4786-4109-a7e0-76b4286ca43f',
        name: 'Move bookmark',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 180],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MoveBookmark = {
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
        jsonBody: "={{ JSON.stringify({ name: 'block-sync', value: $('Newest id').first().json.newest }) }}",
    };

    @node({
        id: '5a6a3488-b574-404b-ae2c-acbd61dbb79b',
        name: 'Up to date',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    UpToDate = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.RunManually.out(0).to(this.ReadBookmark.in(0));
        this.ReadBookmark.out(0).to(this.FetchNewer.in(0));
        this.FetchNewer.out(0).to(this.NewestId.in(0));
        this.NewestId.out(0).to(this.AnythingNew.in(0));
        this.AnythingNew.out(0).to(this.WriteRows.in(0));
        this.AnythingNew.out(1).to(this.UpToDate.in(0));
        this.WriteRows.out(0).to(this.MoveBookmark.in(0));
    }
}
