import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Idempotency guard
// Nodes   : 5  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// BuildTheKey                        code
// ClaimTheKey                        httpRequest                [retry]
// Report                             code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → BuildTheKey
//      → ClaimTheKey
//        → Report
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
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Reliability · Idempotency guard
Answers one question for a caller: has this event been handled before? Webhooks are delivered more than once; this is what makes that safe.

**Needs:** DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: 'c47be24e-4697-4571-a345-0057e8485a07',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '04c7cece-c13f-45d1-a348-92716649141a',
        name: 'Build the key',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimTheKey = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/idempotency_keys',
        options: {
            timeout: 15000,
            response: {
                response: {
                    fullResponse: true,
                    neverError: true,
                },
            },
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
                    value: 'resolution=ignore-duplicates,return=representation',
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'idempotency_key' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ idempotency_key: $json.idempotency_key, claimed_at: $now.toISO() }) }}',
    };

    @node({
        id: '0441a50f-c140-4915-a28e-80ed5a31574f',
        name: 'Report',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [720, 0],
    })
    Report = {
        jsCode: `const before = $("Build the key").all();
return $input.all().map((item, i) => {
  const rows = Array.isArray(item.json.body) ? item.json.body : [];
  return { json: { ...before[i].json, duplicate: rows.length === 0 } };
});`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.BuildTheKey.in(0));
        this.BuildTheKey.out(0).to(this.ClaimTheKey.in(0));
        this.ClaimTheKey.out(0).to(this.Report.in(0));
    }
}
