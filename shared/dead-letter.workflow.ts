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
// ParkIt                             supabase                   [creds] [retry]
// SaySo                              slack                      [onError→regular] [creds] [retry]
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
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reliability · Dead letter
Keeps the payload of work that could not be finished in Supabase, with the reason, so nothing is lost when a platform is down.

**Platforms:** Supabase, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '51b1753e-88e4-47c4-ad51-2bc7b034ea35',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '41727648-c0ea-4b8e-a9de-b466b2fd9545',
        name: 'Wrap the payload',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 90],
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
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ParkIt = {
        resource: 'row',
        operation: 'create',
        tableId: 'dead_letters',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'source',
                    fieldValue: '={{ $json.source }}',
                },
                {
                    fieldId: 'replay_url',
                    fieldValue: '={{ $json.replay_url }}',
                },
                {
                    fieldId: 'reason',
                    fieldValue: '={{ $json.reason }}',
                },
                {
                    fieldId: 'payload',
                    fieldValue: '={{ $json.payload }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: '={{ $json.status }}',
                },
                {
                    fieldId: 'attempts',
                    fieldValue: '={{ $json.attempts }}',
                },
                {
                    fieldId: 'parked_at',
                    fieldValue: '={{ $json.parked_at }}',
                },
            ],
        },
    };

    @node({
        id: 'a3568f07-eb3f-40ed-a9fe-f1ddbb1d0f23',
        name: 'Say so',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [780, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaySo = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#ops-alerts' }}",
        },
        text: "={{ ':inbox_tray: Parked 1 item from ' + $('Wrap the payload').item.json.source + ': ' + $('Wrap the payload').item.json.reason }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
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
