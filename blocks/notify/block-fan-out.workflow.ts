import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · One event, three channels
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Chat                               httpRequest                [onError→regular] [retry]
// Email                              httpRequest                [onError→regular] [retry]
// Sms                                httpRequest                [onError→regular] [retry]
// Report                             code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Chat
//      → Email
//        → Sms
//          → Report
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · One event, three channels',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockOneEventThreeChannelsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'fd0e7fec-5f0c-494e-a945-04bbfbce22a7',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · One event, three channels
Sends the same message by chat, email and SMS, where each channel failing leaves the other two untouched.

**Platforms:** none, this is logic only
**Settings:** CHAT_API_KEY, CHAT_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL, SMS_API_KEY, SMS_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/notify\``,
    };

    @node({
        id: 'e3a50d45-e58c-49b7-ad42-f3eae85432bc',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '25f408bd-0113-4440-a475-74d1d68017c2',
        name: 'Chat',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Chat = {
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
        jsonBody: "={{ JSON.stringify({ channel: '#general', text: $json.text }) }}",
    };

    @node({
        id: 'f3ca4c32-3691-404a-af90-893f391fe04a',
        name: 'Email',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Email = {
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
            "={{ JSON.stringify({ to: $('When called').item.json.email, subject: 'Notice', text: $('When called').item.json.text }) }}",
    };

    @node({
        id: 'b02d9e72-5abb-4a3f-a51a-636fd8586fe0',
        name: 'SMS',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Sms = {
        method: 'POST',
        url: '={{ $env.SMS_BASE_URL }}/Messages',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.SMS_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ To: $('When called').item.json.phone, Body: $('When called').item.json.text.slice(0, 160) }) }}",
    };

    @node({
        id: 'f882cc6b-f470-4b73-a97c-6606f4dadeac',
        name: 'Report',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 90],
    })
    Report = {
        jsCode: `const sent = (name) => { const j = $(name).first().json; return !!j && !j.error; };
return [{ json: { chat: sent("Chat"), email: sent("Email"), sms: sent("SMS") } }];`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Chat.in(0));
        this.Chat.out(0).to(this.Email.in(0));
        this.Email.out(0).to(this.Sms.in(0));
        this.Sms.out(0).to(this.Report.in(0));
    }
}
