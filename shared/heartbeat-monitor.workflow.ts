import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Heartbeat monitor
// Nodes   : 5  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// EveryHour                          scheduleTrigger
// ReadHeartbeats                     httpRequest                [retry]
// FindTheOverdue                     code
// Alert                              httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// EveryHour
//    → ReadHeartbeats
//      → FindTheOverdue
//        → Alert
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reliability · Heartbeat monitor',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ReliabilityHeartbeatMonitorWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '61f4f4bc-2c60-4191-ac81-58f50014ce5a',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Reliability · Heartbeat monitor
Notices the failure nobody reports: a scheduled workflow that silently stopped running. Each one checks in, and this alerts when a check-in is overdue.

**Needs:** ALERT_CHANNEL, CHAT_API_KEY, CHAT_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '2e9a4e97-913b-4c43-a7d6-574aed1f7d85',
        name: 'Every hour',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    EveryHour = {
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
        id: '51a204d2-fda6-4401-a753-f0385df5b7b4',
        name: 'Read heartbeats',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadHeartbeats = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/heartbeats',
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
        id: 'aec6adc1-e8aa-4d54-a4e9-fed809e33636',
        name: 'Find the overdue',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
    })
    FindTheOverdue = {
        jsCode: `const now = Date.now();
const overdue = $input.all()
  .map((i) => i.json)
  .filter((h) => h.name && h.last_seen)
  .filter((h) => now - new Date(h.last_seen).getTime() > (h.max_gap_minutes ?? 90) * 60000)
  .map((h) => ({ json: { name: h.name, last_seen: h.last_seen, hours_silent: Math.round((now - new Date(h.last_seen).getTime()) / 36e5) } }));
return overdue;`,
    };

    @node({
        id: 'bd1916cf-eab1-43cb-aa23-144449178675',
        name: 'Alert',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Alert = {
        method: 'POST',
        url: '={{ $env.CHAT_BASE_URL }}/chat.postMessage',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CHAT_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ channel: $env.ALERT_CHANNEL, text: ':zzz: ' + $json.name + ' has not run for ' + $json.hours_silent + 'h (last seen ' + $json.last_seen + ').' }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.EveryHour.out(0).to(this.ReadHeartbeats.in(0));
        this.ReadHeartbeats.out(0).to(this.FindTheOverdue.in(0));
        this.FindTheOverdue.out(0).to(this.Alert.in(0));
    }
}
