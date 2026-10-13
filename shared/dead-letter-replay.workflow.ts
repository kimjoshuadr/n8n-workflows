import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Dead letter replay
// Nodes   : 13  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every15Minutes                     scheduleTrigger
// FetchPending                       supabase                   [creds] [alwaysOutput] [retry]
// AnythingParked                     if
// OneAtATime                         splitInBatches
// Replay                             httpRequest                [onError→out(1)]
// MarkReplayed                       supabase                   [creds] [alwaysOutput] [retry]
// CountTheAttempt                    code
// RecordTheAttempt                   supabase                   [creds] [alwaysOutput] [retry]
// GivenUp                            if
// Escalate                           slack                      [onError→regular] [creds] [retry]
// NothingToDo                        noOp
// AllReplayed                        noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every15Minutes
//    → FetchPending
//      → AnythingParked
//        → OneAtATime
//          → AllReplayed
//         .out(1) → Replay
//            → MarkReplayed
//              → OneAtATime (↩ loop)
//           .out(1) → CountTheAttempt
//              → RecordTheAttempt
//                → GivenUp
//                  → Escalate
//                    → OneAtATime (↩ loop)
//                 .out(1) → OneAtATime (↩ loop)
//       .out(1) → NothingToDo
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reliability · Dead letter replay',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ReliabilityDeadLetterReplayWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '51390283-77d8-4658-aa4a-4c9496c50dfb',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reliability · Dead letter replay
Every fifteen minutes, sends parked work back to where it came from. Gives up after five attempts and tells Slack.

**Platforms:** Supabase, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '6ecb0768-be6a-4159-a068-fb9249e95080',
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
        id: '6a15b899-4292-4e3e-a405-18955e12daa3',
        name: 'Fetch pending',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FetchPending = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'dead_letters',
        returnAll: false,
        limit: 50,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'pending' }}",
                },
            ],
        },
    };

    @node({
        id: '0c44ea74-afca-4e70-ad7a-3ff08337ff46',
        name: 'Anything parked?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
    })
    AnythingParked = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '212c49fc-794e-4c2b-a04b-e30f7f0254e3',
                    leftValue: '={{ !!$json.id }}',
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
        id: 'c5a6514a-7420-408c-a335-87a1788a469c',
        name: 'One at a time',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [780, 90],
    })
    OneAtATime = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'bfcc7750-e770-4975-a5c6-377cae385ed5',
        name: 'Replay',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 90],
        onError: 'continueErrorOutput',
    })
    Replay = {
        method: 'POST',
        url: '={{ $json.replay_url }}',
        options: {
            timeout: 15000,
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.payload) }}',
    };

    @node({
        id: '6f01597d-3c98-4da9-ae45-030a01f29c64',
        name: 'Mark replayed',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkReplayed = {
        resource: 'row',
        operation: 'update',
        tableId: 'dead_letters',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('One at a time').item.json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'replayed' }}",
                },
                {
                    fieldId: 'replayed_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '67836a8c-6504-4ce2-ac59-61302733c1a3',
        name: 'Count the attempt',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 270],
    })
    CountTheAttempt = {
        jsCode: `const row = $("One at a time").first().json;
const attempts = (row.attempts ?? 0) + 1;
return [{ json: { id: row.id, source: row.source, attempts, status: attempts >= 5 ? "abandoned" : "pending" } }];`,
    };

    @node({
        id: '3b850c43-2ea9-4152-a0be-a0641276bcc8',
        name: 'Record the attempt',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1560, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheAttempt = {
        resource: 'row',
        operation: 'update',
        tableId: 'dead_letters',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.id }}',
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'attempts',
                    fieldValue: '={{ $json.attempts }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: '={{ $json.status }}',
                },
            ],
        },
    };

    @node({
        id: 'ec7c9f2e-de30-4425-ab48-9b405ba33dee',
        name: 'Given up?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1820, 180],
    })
    GivenUp = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '4a494e35-6919-4f34-abbb-2e464b0a0208',
                    leftValue: "={{ $('Count the attempt').item.json.status === 'abandoned' }}",
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
        id: '03924ad1-204a-44ab-a577-a6aff4c8d80f',
        name: 'Escalate',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [2080, 180],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Escalate = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#ops-alerts' }}",
        },
        text: "={{ ':red_circle: Gave up replaying an item from ' + $('Count the attempt').item.json.source + ' after 5 attempts. It needs a person.' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '97169698-2ba2-4889-a68a-c87ed3d1d9fe',
        name: 'Nothing to do',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 270],
    })
    NothingToDo = {};

    @node({
        id: '1575c803-49ba-44ae-ac96-cc9c062eb19f',
        name: 'All replayed',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 270],
    })
    AllReplayed = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Every15Minutes.out(0).to(this.FetchPending.in(0));
        this.FetchPending.out(0).to(this.AnythingParked.in(0));
        this.AnythingParked.out(0).to(this.OneAtATime.in(0));
        this.AnythingParked.out(1).to(this.NothingToDo.in(0));
        this.OneAtATime.out(0).to(this.AllReplayed.in(0));
        this.OneAtATime.out(1).to(this.Replay.in(0));
        this.Replay.out(0).to(this.MarkReplayed.in(0));
        this.Replay.out(1).to(this.CountTheAttempt.in(0));
        this.MarkReplayed.out(0).to(this.OneAtATime.in(0));
        this.CountTheAttempt.out(0).to(this.RecordTheAttempt.in(0));
        this.RecordTheAttempt.out(0).to(this.GivenUp.in(0));
        this.GivenUp.out(0).to(this.Escalate.in(0));
        this.GivenUp.out(1).to(this.OneAtATime.in(0));
        this.Escalate.out(0).to(this.OneAtATime.in(0));
    }
}
