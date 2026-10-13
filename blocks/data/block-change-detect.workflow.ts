import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Has this changed since last time?
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// LastCopy                           supabase                   [creds] [alwaysOutput] [retry]
// Compare                            code
// StoreThisCopy                      httpRequest                [creds] [retry]
// Answer                             set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → LastCopy
//      → Compare
//        → StoreThisCopy
//          → Answer
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Has this changed since last time?',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockHasThisChangedSinceLastTimeWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '172aaace-5e4d-46ba-aeff-9ab4fb7772d7',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Has this changed since last time?
Compares a record with the copy stored last run and reports which fields changed, so downstream work only happens on a real change.

**Platforms:** Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: '02c67ad5-888a-4e3a-a8f4-bb6bba708814',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '5fb4ec90-8354-4a87-a45d-c8790a5615ab',
        name: 'Last copy',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LastCopy = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'snapshots',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'key',
                    condition: 'eq',
                    keyValue: '={{ $json.key }}',
                },
            ],
        },
    };

    @node({
        id: '692aaa04-53ea-44f6-ac2d-d448361b6deb',
        name: 'Compare',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    Compare = {
        jsCode: `const now = $("When called").first().json;
const before = $input.first().json.data ?? null;
const fields = Object.keys({ ...(before ?? {}), ...now.data });
const changed = before === null ? fields : fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(now.data[f]));
return [{ json: { key: now.key, data: now.data, first_seen: before === null, changed, has_changes: changed.length > 0 } }];`,
    };

    @node({
        id: '62205f27-328b-4074-a301-b75394c0ecbc',
        name: 'Store this copy',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    StoreThisCopy = {
        method: 'POST',
        url: "={{ 'https://acme.supabase.co/rest/v1/snapshots' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'supabaseApi',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Prefer',
                    value: "={{ 'resolution=merge-duplicates,return=representation' }}",
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'key' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ key: $json.key, data: $json.data }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '4672e0d3-5b8e-4b68-abb9-3ed657a11084',
        name: 'Answer',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1040, 90],
    })
    Answer = {
        assignments: {
            assignments: [
                {
                    id: 'bd00b1f0-d370-4b9b-a75a-9fe3fd5bfedd',
                    name: 'has_changes',
                    value: "={{ $('Compare').first().json.has_changes }}",
                    type: 'string',
                },
                {
                    id: '0d63e140-efcb-4619-a94e-5b03f11e0f7b',
                    name: 'changed',
                    value: "={{ $('Compare').first().json.changed.join(',') }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.LastCopy.in(0));
        this.LastCopy.out(0).to(this.Compare.in(0));
        this.Compare.out(0).to(this.StoreThisCopy.in(0));
        this.StoreThisCopy.out(0).to(this.Answer.in(0));
    }
}
