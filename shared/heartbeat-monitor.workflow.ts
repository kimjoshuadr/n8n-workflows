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
// ReadHeartbeats                     supabase                   [creds] [alwaysOutput] [retry]
// FindTheOverdue                     code
// Alert                              slack                      [creds] [retry]
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
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reliability · Heartbeat monitor
Notices the failure nobody reports: a scheduled workflow that silently stopped running. Each one checks in to Supabase, and this alerts Slack when a check-in is overdue.

**Platforms:** Supabase, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '2e9a4e97-913b-4c43-a7d6-574aed1f7d85',
        name: 'Every hour',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ReadHeartbeats = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'heartbeats',
        returnAll: true,
    };

    @node({
        id: 'aec6adc1-e8aa-4d54-a4e9-fed809e33636',
        name: 'Find the overdue',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    FindTheOverdue = {
        jsCode: `const now = Date.now();
return $input.all()
  .map((i) => i.json)
  .filter((h) => h.name && h.last_seen)
  .filter((h) => now - new Date(h.last_seen).getTime() > (h.max_gap_minutes ?? 90) * 60000)
  .map((h) => ({ json: { name: h.name, last_seen: h.last_seen, hours_silent: Math.round((now - new Date(h.last_seen).getTime()) / 36e5) } }));`,
    };

    @node({
        id: 'bd1916cf-eab1-43cb-aa23-144449178675',
        name: 'Alert',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [780, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Alert = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#ops-alerts' }}",
        },
        text: "={{ ':zzz: ' + $json.name + ' has not run for ' + $json.hours_silent + 'h (last seen ' + $json.last_seen + ').' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
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
