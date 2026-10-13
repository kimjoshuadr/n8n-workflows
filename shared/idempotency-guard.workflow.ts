import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Idempotency guard
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// BuildTheKey                        code
// ClaimTheKey                        supabase                   [onError→out(1)] [creds]
// FirstTime                          code
// AlreadyClaimed                     if
// SeenBefore                         code
// CouldNotCheck                      stopAndError
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → BuildTheKey
//      → ClaimTheKey
//        → FirstTime
//       .out(1) → AlreadyClaimed
//          → SeenBefore
//         .out(1) → CouldNotCheck
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reliability · Idempotency guard',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ReliabilityIdempotencyGuardWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b0ad604f-dd81-43ad-a81b-0f5c81eef252',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reliability · Idempotency guard
Answers one question for a caller: has this event been handled before? Webhooks are delivered more than once; a unique key in Supabase is what makes that safe.

**Platforms:** Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: 'c47be24e-4697-4571-a345-0057e8485a07',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '04c7cece-c13f-45d1-a348-92716649141a',
        name: 'Build the key',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    BuildTheKey = {
        jsCode: `return $input.all().map((item) => {
  const { scope, key } = item.json;
  if (!scope || !key) throw new Error("idempotency-guard needs { scope, key }");
  return { json: { ...item.json, idempotency_key: scope + ":" + key } };
});`,
    };

    @node({
        id: '76375043-ec78-48c8-a260-7ac720ad762e',
        name: 'Claim the key',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueErrorOutput',
    })
    ClaimTheKey = {
        resource: 'row',
        operation: 'create',
        tableId: 'idempotency_keys',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'idempotency_key',
                    fieldValue: '={{ $json.idempotency_key }}',
                },
                {
                    fieldId: 'claimed_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '9f04f3f0-5e11-4edb-a1db-2fd74def4e08',
        name: 'First time',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 90],
    })
    FirstTime = {
        jsCode: `const before = $("Build the key").all();
return $input.all().map((_, i) => ({ json: { ...before[i].json, duplicate: false } }));`,
    };

    @node({
        id: 'c489cd8f-25af-40ef-a752-dae7c51c303d',
        name: 'Already claimed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 270],
    })
    AlreadyClaimed = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '176585e2-4fac-4168-a128-a4d77974b982',
                    leftValue: "={{ /duplicate key|23505/.test(String($json.error ?? '')) }}",
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
        id: '8a86d7b8-0700-41ff-a2b5-1159baf72211',
        name: 'Seen before',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 90],
    })
    SeenBefore = {
        jsCode: 'return $input.all().map((item) => { const { error, ...rest } = item.json; return { json: { ...rest, duplicate: true } }; });',
    };

    @node({
        id: '641764ba-382a-4ff0-a76c-54227c4efc70',
        name: 'Could not check',
        type: 'n8n-nodes-base.stopAndError',
        version: 1,
        position: [1040, 270],
    })
    CouldNotCheck = {
        errorMessage: "={{ String($json.error ?? 'The idempotency key could not be claimed') }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.BuildTheKey.in(0));
        this.BuildTheKey.out(0).to(this.ClaimTheKey.in(0));
        this.ClaimTheKey.out(0).to(this.FirstTime.in(0));
        this.ClaimTheKey.out(1).to(this.AlreadyClaimed.in(0));
        this.AlreadyClaimed.out(0).to(this.SeenBefore.in(0));
        this.AlreadyClaimed.out(1).to(this.CouldNotCheck.in(0));
    }
}
