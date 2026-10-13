import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Monitoring · Uptime checks
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every5Minutes                      scheduleTrigger
// SitesToWatch                       supabase                   [creds] [alwaysOutput] [retry]
// RequestTheSite                     httpRequest                [onError→regular]
// DecideTheState                     code
// SaveTheState                       supabase                   [creds] [retry]
// AlertsForChanges                   code
// Alert                              executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every5Minutes
//    → SitesToWatch
//      → RequestTheSite
//        → DecideTheState
//          → SaveTheState
//            → AlertsForChanges
//              → Alert
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Monitoring · Uptime checks',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class MonitoringUptimeChecksWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '59e5e93c-2ace-49b5-add9-3535944a2fcc',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Monitoring · Uptime checks
Checks each site every five minutes, alerts after two failures in a row, and reports how long it was down once it recovers.

**Platforms:** Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/monitoring\``,
    };

    @node({
        id: 'f70bf48d-283c-4a2c-aaae-ab4901535896',
        name: 'Every 5 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    Every5Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 5,
                },
            ],
        },
    };

    @node({
        id: 'a59acde9-ea44-4855-a081-a100d1ac6563',
        name: 'Sites to watch',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SitesToWatch = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'monitors',
        returnAll: true,
    };

    @node({
        id: '1fabe702-b581-4673-ad5c-e47b93ef8aad',
        name: 'Request the site',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 90],
        onError: 'continueRegularOutput',
    })
    RequestTheSite = {
        method: 'GET',
        url: '={{ $json.url }}',
        options: {
            timeout: 15000,
            response: {
                response: {
                    fullResponse: true,
                    neverError: true,
                },
            },
        },
    };

    @node({
        id: 'b8d7f84e-5c1d-41fd-a7d1-1442adc92d5b',
        name: 'Decide the state',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 90],
    })
    DecideTheState = {
        jsCode: `const monitors = $("Sites to watch").all();
return $input.all().map((item, i) => {
  const m = monitors[i]?.json;
  if (!m?.url) return null;
  const status = item.json.statusCode ?? 0;
  const up = status >= 200 && status < 400;
  const failures = up ? 0 : (m.failures ?? 0) + 1;
  // Two in a row before it counts as down: one slow response is not an outage.
  const state = up ? "up" : failures >= 2 ? "down" : (m.state ?? "up");
  const changed = state !== (m.state ?? "up");
  const downSince = state === "down" ? (m.down_since ?? new Date().toISOString()) : null;
  const minutesDown = changed && state === "up" && m.down_since ? Math.round((Date.now() - new Date(m.down_since).getTime()) / 60000) : null;
  return { json: { id: m.id, name: m.name ?? m.url, url: m.url, status, state, failures, changed, down_since: downSince, minutes_down: minutesDown } };
}).filter(Boolean);`,
    };

    @node({
        id: 'b14e6c12-3537-4eca-afb3-6e53b4eab7c5',
        name: 'Save the state',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1040, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheState = {
        resource: 'row',
        operation: 'update',
        tableId: 'monitors',
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
                    fieldId: 'state',
                    fieldValue: '={{ $json.state }}',
                },
                {
                    fieldId: 'failures',
                    fieldValue: '={{ $json.failures }}',
                },
                {
                    fieldId: 'down_since',
                    fieldValue: '={{ $json.down_since }}',
                },
                {
                    fieldId: 'checked_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '2f6e9f36-8e0c-4e5a-ac57-36920a51e703',
        name: 'Alerts for changes',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 90],
    })
    AlertsForChanges = {
        jsCode: 'return $("Decide the state").all().map((i) => i.json).filter((m) => m.changed).map((m) => ({ json: { level: m.state === "down" ? "critical" : "info", text: m.state === "down" ? m.name + " is down (" + (m.status || "no response") + "). " + m.url : m.name + " is back up after " + m.minutes_down + " min." } }));',
    };

    @node({
        id: '747d0dc2-60f6-4abf-a7c2-6331437b5a66',
        name: 'Alert',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1560, 90],
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
        this.Every5Minutes.out(0).to(this.SitesToWatch.in(0));
        this.SitesToWatch.out(0).to(this.RequestTheSite.in(0));
        this.RequestTheSite.out(0).to(this.DecideTheState.in(0));
        this.DecideTheState.out(0).to(this.SaveTheState.in(0));
        this.SaveTheState.out(0).to(this.AlertsForChanges.in(0));
        this.AlertsForChanges.out(0).to(this.Alert.in(0));
    }
}
