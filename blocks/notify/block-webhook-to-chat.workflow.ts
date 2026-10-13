import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Event to a chat message
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Event                              webhook
// PostIt                             httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Event
//    → PostIt
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Event to a chat message',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockEventToAChatMessageWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'e1e0090b-4b1e-464f-a108-d01749b9748f',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Event to a chat message
Turns any event into one readable chat message.

**Platforms:** none, this is logic only
**Settings:** CHAT_API_KEY, CHAT_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/notify\``,
    };

    @node({
        id: 'dd111805-efd3-4ef4-af70-b962b7f6d573',
        webhookId: '10a775c6-7bd7-4e85-aeae-c8ad63d39e99',
        name: 'Event',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 90],
    })
    Event = {
        httpMethod: 'POST',
        path: 'block-to-chat',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '3e9d4ca4-0f9b-4783-a7e0-3d5785d3b519',
        name: 'Post it',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostIt = {
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
            "={{ JSON.stringify({ channel: $json.body.channel ?? '#general', text: ($json.body.title ? '*' + $json.body.title + '*\\n' : '') + String($json.body.text ?? '').slice(0, 3000) }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Event.out(0).to(this.PostIt.in(0));
    }
}
