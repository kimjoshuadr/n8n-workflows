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
// PostToSlack                        slack                      [onError→out(1)] [creds] [retry]
// DeliveredBySlack                   set
// EmailInstead                       sendGrid                   [creds] [retry]
// DeliveredByEmail                   set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Compose
//      → PostToSlack
//        → DeliveredBySlack
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
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reliability · Notify
The one place alerts leave from. Posts to Slack, and falls back to a SendGrid email when Slack is down, so an outage cannot hide its own alert.

**Platforms:** Slack, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`shared\``,
    };

    @node({
        id: '26f9ecb8-11e0-4e4e-aadf-28060c93d6d5',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '91932aa0-2f70-454f-a3cf-dbe4552ccb8d',
        name: 'Compose',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [260, 180],
    })
    Compose = {
        assignments: {
            assignments: [
                {
                    id: 'cce3708b-632e-413d-ae7b-8d97df6d8604',
                    name: 'channel',
                    value: "={{ $json.channel ?? '#ops-alerts' }}",
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
        id: '8996d357-98cb-4aa8-a03c-0101debf7713',
        name: 'Post to Slack',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [520, 180],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostToSlack = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: '={{ $json.channel }}',
        },
        text: '={{ $json.text }}',
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '13c8f07f-3a66-4c92-a260-350203014922',
        name: 'Delivered by Slack',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 90],
    })
    DeliveredBySlack = {
        assignments: {
            assignments: [
                {
                    id: '682d65d0-762f-4c72-a079-09e95c7494a2',
                    name: 'delivered',
                    value: "={{ 'slack' }}",
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
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [780, 270],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    EmailInstead = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ 'ops@example.com' }}",
        subject: "={{ 'Alert (Slack unavailable)' }}",
        dynamicTemplate: false,
        contentType: 'text/plain',
        contentValue: "={{ $('Compose').item.json.text }}",
        additionalFields: {},
    };

    @node({
        id: '17a0749d-9962-4fa5-ab48-39fbafd917dd',
        name: 'Delivered by email',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1040, 180],
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
        this.Compose.out(0).to(this.PostToSlack.in(0));
        this.PostToSlack.out(0).to(this.DeliveredBySlack.in(0));
        this.PostToSlack.out(1).to(this.EmailInstead.in(0));
        this.EmailInstead.out(0).to(this.DeliveredByEmail.in(0));
    }
}
