import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Limit actions per key per hour
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// ThisHourSBucket                    code
// ReadTheCount                       httpRequest                [alwaysOutput] [retry]
// Decide                             code
// CountTheAttempt                    httpRequest                [retry]
// Answer                             set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → ThisHourSBucket
//      → ReadTheCount
//        → Decide
//          → CountTheAttempt
//            → Answer
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Limit actions per key per hour',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockLimitActionsPerKeyPerHourWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'ed49f3e2-6332-4b97-ace8-778814ba3891',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Limit actions per key per hour
Answers whether a key (a user, an IP, a customer) is still under its hourly limit, and counts the attempt.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/reliability\``,
    };

    @node({
        id: '34f3edb1-256a-48bb-a696-3d6ab172a696',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '50c28140-dbf5-4e8a-aafe-fded0ba360f0',
        name: "This hour's bucket",
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 90],
    })
    ThisHourSBucket = {
        jsCode: 'return $input.all().map((i) => ({ json: { ...i.json, limit: i.json.limit ?? 5, bucket: i.json.key + ":" + new Date().toISOString().slice(0, 13) } }));',
    };

    @node({
        id: '5589a8f5-8015-481b-af5e-180d6874f8d5',
        name: 'Read the count',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadTheCount = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/throttle',
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
                    name: 'bucket',
                    value: "={{ 'eq.' + $json.bucket }}",
                },
            ],
        },
    };

    @node({
        id: '476bcae2-c494-44ba-ae25-066f7ad5f163',
        name: 'Decide',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 90],
    })
    Decide = {
        jsCode: `const req = $("This hour's bucket").first().json;
const count = Number($input.first().json.count ?? 0);
return [{ json: { ...req, count: count + 1, allowed: count < req.limit } }];`,
    };

    @node({
        id: 'b12cd4bf-990b-42d7-a31d-22fe96b96da7',
        name: 'Count the attempt',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CountTheAttempt = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/throttle',
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
                    value: "={{ 'bucket' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ bucket: $json.bucket, count: $json.count }) }}',
    };

    @node({
        id: '7c828451-7e60-4ebc-ae4f-59b487b09bde',
        name: 'Answer',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1300, 90],
    })
    Answer = {
        assignments: {
            assignments: [
                {
                    id: '410f3ca5-db24-4aad-a779-0f07feb9b8dd',
                    name: 'allowed',
                    value: "={{ $('Decide').first().json.allowed }}",
                    type: 'string',
                },
                {
                    id: 'caa55494-501a-40b0-a115-c03aaf309557',
                    name: 'count',
                    value: "={{ $('Decide').first().json.count }}",
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
        this.WhenCalled.out(0).to(this.ThisHourSBucket.in(0));
        this.ThisHourSBucket.out(0).to(this.ReadTheCount.in(0));
        this.ReadTheCount.out(0).to(this.Decide.in(0));
        this.Decide.out(0).to(this.CountTheAttempt.in(0));
        this.CountTheAttempt.out(0).to(this.Answer.in(0));
    }
}
