import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reliability · Notify
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Compose                            set
// PostToChat                         httpRequest                [onError→out(1)] [retry]
// DeliveredByChat                    set
// EmailInstead                       httpRequest                [retry]
// DeliveredByEmail                   set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Compose
//      → PostToChat
//        → DeliveredByChat
//       .out(1) → EmailInstead
//          → DeliveredByEmail
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reliability · Notify',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ReliabilityNotifyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '9026b30c-a622-4a29-a60a-b48868580672',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Reliability · Notify
The one place alerts leave from. Posts to chat, and falls back to email when chat is down, so an outage cannot hide its own alert.

**Needs:** ALERT_CHANNEL, CHAT_API_KEY, CHAT_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '26f9ecb8-11e0-4e4e-aadf-28060c93d6d5',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 0],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '91932aa0-2f70-454f-a3cf-dbe4552ccb8d',
        name: 'Compose',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [240, 0],
    })
    Compose = {
        assignments: {
            assignments: [
                {
                    id: 'cce3708b-632e-413d-ae7b-8d97df6d8604',
                    name: 'channel',
                    value: '={{ $json.channel ?? $env.ALERT_CHANNEL }}',
                    type: 'string',
                },
                {
                    id: 'de16a74d-9302-4dbb-a57d-150cb5d90c18',
                    name: 'text',
                    value: "={{ ($json.level === 'critical' ? ':red_circle: ' : $json.level === 'warn' ? ':warning: ' : ':information_source: ') + $json.text }}",
                    type: 'string',
                },
                {
                    id: '8ce9ad01-2c26-4069-a047-3458b36f19a2',
                    name: 'level',
                    value: "={{ $json.level ?? 'info' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '180af92a-833b-42a7-a5f8-97c455ab1340',
        name: 'Post to chat',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, 0],
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostToChat = {
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
        jsonBody: '={{ JSON.stringify({ channel: $json.channel, text: $json.text }) }}',
    };

    @node({
        id: 'f9988700-4056-45dc-a754-58072e82e41f',
        name: 'Delivered by chat',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [720, -90],
    })
    DeliveredByChat = {
        assignments: {
            assignments: [
                {
                    id: '7918710d-13df-494d-a3bd-c1d1cb07df58',
                    name: 'delivered',
                    value: "={{ 'chat' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'bc694fe5-059b-4dc6-a962-80a0ff8706f4',
        name: 'Email instead',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    EmailInstead = {
        method: 'POST',
        url: '={{ $env.EMAIL_BASE_URL }}/emails',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.EMAIL_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ to: 'ops@example.com', subject: 'Alert (chat unavailable)', text: $('Compose').item.json.text }) }}",
    };

    @node({
        id: '17a0749d-9962-4fa5-ab48-39fbafd917dd',
        name: 'Delivered by email',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [960, 0],
    })
    DeliveredByEmail = {
        assignments: {
            assignments: [
                {
                    id: '254caa7b-30b4-441c-a47b-eca106e173f6',
                    name: 'delivered',
                    value: "={{ 'email' }}",
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
        this.WhenCalled.out(0).to(this.Compose.in(0));
        this.Compose.out(0).to(this.PostToChat.in(0));
        this.PostToChat.out(0).to(this.DeliveredByChat.in(0));
        this.PostToChat.out(1).to(this.EmailInstead.in(0));
        this.EmailInstead.out(0).to(this.DeliveredByEmail.in(0));
    }
}
