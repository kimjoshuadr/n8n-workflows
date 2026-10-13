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
// Chat                               slack                      [onError→regular] [creds] [retry]
// Email                              sendGrid                   [onError→regular] [creds] [retry]
// Sms                                twilio                     [onError→regular] [creds] [retry]
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

**Platforms:** Slack, SendGrid, Twilio
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
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [260, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Chat = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#general' }}",
        },
        text: '={{ $json.text }}',
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'f3ca4c32-3691-404a-af90-893f391fe04a',
        name: 'Email',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [520, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Email = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('When called').item.json.email }}",
        subject: "={{ 'Notice' }}",
        dynamicTemplate: false,
        contentType: 'text/plain',
        contentValue: "={{ $('When called').item.json.text }}",
        additionalFields: {},
    };

    @node({
        id: 'b02d9e72-5abb-4a3f-a51a-636fd8586fe0',
        name: 'SMS',
        type: 'n8n-nodes-base.twilio',
        version: 1,
        position: [780, 90],
        credentials: { twilioApi: { id: '__CRED:twilio__', name: 'Twilio' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Sms = {
        resource: 'sms',
        operation: 'send',
        from: '+15550000',
        to: "={{ $('When called').item.json.phone }}",
        message: "={{ $('When called').item.json.text.slice(0, 160) }}",
        options: {},
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
