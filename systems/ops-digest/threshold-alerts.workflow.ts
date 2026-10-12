import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Ops digest · Threshold alerts
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Hourly                             scheduleTrigger
// WatchedMetrics                     httpRequest                [alwaysOutput] [retry]
// WhichChangedState                  code
// RememberTheState                   httpRequest                [retry]
// AlertText                          code
// Alert                              executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Hourly
//    → WatchedMetrics
//      → WhichChangedState
//        → RememberTheState
//          → AlertText
//            → Alert
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Ops digest · Threshold alerts',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class OpsDigestThresholdAlertsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '1cf17200-10f8-4a06-afed-3cff6965ac54',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Ops digest · Threshold alerts
Checks each watched number hourly and alerts when it crosses its line, and again when it recovers. It does not repeat itself in between.

**Needs:** DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/ops-digest\``,
    };

    @node({
        id: '1a6ad27d-7a53-4d76-a8c2-44f8b619a7b8',
        name: 'Hourly',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    Hourly = {
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
        id: 'ed15231e-e603-486a-a912-74d2e74361e2',
        name: 'Watched metrics',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WatchedMetrics = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/watched_metrics',
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
    };

    @node({
        id: '5be3ce3c-3733-4b61-ae89-0d385cc71629',
        name: 'Which changed state?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
    })
    WhichChangedState = {
        jsCode: `return $input.all().map((i) => i.json).filter((m) => m.name && typeof m.value === "number").map((m) => {
  const breached = m.direction === "below" ? m.value < m.threshold : m.value > m.threshold;
  const state = breached ? "breached" : "ok";
  return { ...m, state, changed: state !== (m.last_state ?? "ok") };
}).filter((m) => m.changed).map((json) => ({ json }));`,
    };

    @node({
        id: '92b216ff-2d58-4282-ad84-831c4797cf30',
        name: 'Remember the state',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RememberTheState = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/watched_metrics',
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
                    value: "={{ 'eq.' + $json.name }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ last_state: $json.state, state_changed_at: $now.toISO() }) }}',
    };

    @node({
        id: '4e3d101a-2c1a-4380-a90f-59dce9486914',
        name: 'Alert text',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [960, 0],
    })
    AlertText = {
        jsCode: `const before = $("Which changed state?").all();
return $input.all().map((item, i) => { const m = before[i].json; return { json: { level: m.state === "breached" ? "critical" : "info", text: m.state === "breached" ? m.name + " is " + m.value + ", " + m.direction + " its line of " + m.threshold + "." : m.name + " is back to normal at " + m.value + "." } }; });`,
    };

    @node({
        id: '354f2720-f0dc-410d-a01c-d2aa1e984f6c',
        name: 'Alert',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1200, 0],
    })
    Alert = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Hourly.out(0).to(this.WatchedMetrics.in(0));
        this.WatchedMetrics.out(0).to(this.WhichChangedState.in(0));
        this.WhichChangedState.out(0).to(this.RememberTheState.in(0));
        this.RememberTheState.out(0).to(this.AlertText.in(0));
        this.AlertText.out(0).to(this.Alert.in(0));
    }
}
