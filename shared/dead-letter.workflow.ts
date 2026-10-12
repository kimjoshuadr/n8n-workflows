import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Dead letter
// Nodes   : 5  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// WrapThePayload                     code
// ParkIt                             httpRequest                [retry]
// SaySo                              httpRequest                [onError→regular] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → WrapThePayload
//      → ParkIt
//        → SaySo
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reliability · Dead letter',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ReliabilityDeadLetterWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'cba9137a-5af3-48fd-ab6e-522f522b7250',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Reliability · Dead letter
Keeps the payload of work that could not be finished, with the reason, so nothing is lost when a downstream system is down.

**Needs:** ALERT_CHANNEL, CHAT_API_KEY, CHAT_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '51b1753e-88e4-47c4-ad51-2bc7b034ea35',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '41727648-c0ea-4b8e-a9de-b466b2fd9545',
        name: 'Wrap the payload',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    WrapThePayload = {
        jsCode: `return $input.all().map((item) => ({ json: {
  source: item.json.source ?? "unknown",
  replay_url: item.json.replay_url ?? null,
  reason: String(item.json.reason ?? "unspecified").slice(0, 300),
  payload: item.json.payload ?? {},
  status: "pending",
  attempts: 0,
  parked_at: new Date().toISOString(),
} }));`,
    };

    @node({
        id: 'f865655c-5809-4329-a2a5-7f7061fbc9b2',
        name: 'Park it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ParkIt = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/dead_letters',
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
        jsonBody: '={{ JSON.stringify($json) }}',
    };

    @node({
        id: 'a3568f07-eb3f-40ed-a9fe-f1ddbb1d0f23',
        name: 'Say so',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 0],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaySo = {
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
            "={{ JSON.stringify({ channel: $env.ALERT_CHANNEL, text: ':inbox_tray: Parked 1 item from ' + $('Wrap the payload').item.json.source + ': ' + $('Wrap the payload').item.json.reason }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.WrapThePayload.in(0));
        this.WrapThePayload.out(0).to(this.ParkIt.in(0));
        this.ParkIt.out(0).to(this.SaySo.in(0));
    }
}
