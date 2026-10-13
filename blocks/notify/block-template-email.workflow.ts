import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Templated email
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// FillTheTemplate                    code
// ReadyToSend                        if
// Send                               sendGrid                   [creds] [retry]
// Sent                               set
// HeldBack                           set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → FillTheTemplate
//      → ReadyToSend
//        → Send
//          → Sent
//       .out(1) → HeldBack
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Templated email',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockTemplatedEmailWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'eb5632a9-3959-4e04-a0a5-0c11b647df15',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Templated email
One place to send an email from: fills a template, refuses to send with a placeholder left unfilled.

**Platforms:** SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/notify\``,
    };

    @node({
        id: '6b47409a-4454-4a99-a978-ef50174df98b',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '35e8a58f-2759-4770-a724-fcdf6b28c1f4',
        name: 'Fill the template',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    FillTheTemplate = {
        jsCode: `return $input.all().map((item) => {
  const { to, subject, body, data = {} } = item.json;
  const fill = (s) => String(s ?? "").replace(/{{\\s*(\\w+)\\s*}}/g, (m, k) => (data[k] === undefined || data[k] === null ? m : String(data[k])));
  const out = { to, subject: fill(subject), text: fill(body) };
  const unfilled = [...(out.subject + out.text).matchAll(/{{\\s*(\\w+)\\s*}}/g)].map((m) => m[1]);
  return { json: { ...out, unfilled, ready: unfilled.length === 0 && !!to } };
});`,
    };

    @node({
        id: 'd7a5ac31-1188-4015-a330-b96f686905fe',
        name: 'Ready to send?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
    })
    ReadyToSend = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '89cf5f47-ba83-44e8-a3d4-fab35a839aee',
                    leftValue: '={{ $json.ready }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '094f1562-bd7c-4de6-ab93-a31f9c07baac',
        name: 'Send',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [780, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Send = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.to }}',
        subject: '={{ $json.subject }}',
        dynamicTemplate: false,
        contentType: 'text/plain',
        contentValue: '={{ $json.text }}',
        additionalFields: {},
    };

    @node({
        id: 'a19e9332-07d8-4ece-a6a9-dc5f20f37db9',
        name: 'Sent',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1040, 180],
    })
    Sent = {
        assignments: {
            assignments: [
                {
                    id: '1d28585d-7429-43c0-a063-2e6eebb5b158',
                    name: 'sent',
                    value: '={{ true }}',
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'd5b32bf5-641b-4a2c-a514-b919cd01d922',
        name: 'Held back',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 270],
    })
    HeldBack = {
        assignments: {
            assignments: [
                {
                    id: '2c081bd6-f05b-4700-aef1-a579bc924424',
                    name: 'sent',
                    value: '={{ false }}',
                    type: 'string',
                },
                {
                    id: 'd14583a3-85a5-4862-ae99-7e33f9185816',
                    name: 'reason',
                    value: "={{ 'Unfilled placeholders: ' + $json.unfilled.join(', ') }}",
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
        this.WhenCalled.out(0).to(this.FillTheTemplate.in(0));
        this.FillTheTemplate.out(0).to(this.ReadyToSend.in(0));
        this.ReadyToSend.out(0).to(this.Send.in(0));
        this.ReadyToSend.out(1).to(this.HeldBack.in(0));
        this.Send.out(0).to(this.Sent.in(0));
    }
}
