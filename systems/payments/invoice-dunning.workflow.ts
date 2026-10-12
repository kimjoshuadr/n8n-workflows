import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Payments · Overdue reminders
// Nodes   : 10  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _0900Daily                         scheduleTrigger
// OpenInvoices                       httpRequest                [alwaysOutput] [retry]
// WhichStepIsDue                     code
// StillAReminder                     if
// SendTheReminder                    httpRequest                [retry]
// RecordTheStep                      httpRequest                [retry]
// EscalationMessage                  code
// HandToAPerson                      executeWorkflow
// MarkEscalated                      httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _0900Daily
//    → OpenInvoices
//      → WhichStepIsDue
//        → StillAReminder
//          → SendTheReminder
//            → RecordTheStep
//         .out(1) → EscalationMessage
//            → HandToAPerson
//              → MarkEscalated
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Payments · Overdue reminders',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PaymentsOverdueRemindersWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '79840fb5-36d1-43a3-a05f-7e09f64fc170',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Payments · Overdue reminders
Each morning, reminds customers with overdue invoices at 3, 7 and 14 days, then hands the invoice to a person at 21.

**Needs:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/payments\``,
    };

    @node({
        id: 'ec326e65-c3bc-4948-ab62-880c7bc76984',
        name: '09:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    _0900Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 9 * * *',
                },
            ],
        },
    };

    @node({
        id: 'a3fea65c-604e-49da-af30-668ab48ec8bb',
        name: 'Open invoices',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenInvoices = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/invoices',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'status',
                    value: "={{ 'eq.open' }}",
                },
            ],
        },
    };

    @node({
        id: 'd89d4d11-6045-419c-a79a-a03f73268e36',
        name: 'Which step is due?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
    })
    WhichStepIsDue = {
        jsCode: `const STEPS = [3, 7, 14, 21];
const today = Math.floor(Date.now() / 864e5);
return $input.all().map((i) => i.json).filter((inv) => inv.due_date && inv.email).map((inv) => {
  const overdue = today - Math.floor(new Date(inv.due_date).getTime() / 864e5);
  const step = STEPS.filter((s) => overdue >= s).pop() ?? 0;
  return { ...inv, overdue, step };
}).filter((inv) => inv.step > (inv.last_reminder_step ?? 0)).map((json) => ({ json }));`,
    };

    @node({
        id: 'd97e4bfe-351d-406e-a652-7322fb3717a5',
        name: 'Still a reminder?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 0],
    })
    StillAReminder = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '714b7ce1-87e3-4a6a-a4cd-3d715d346f3c',
                    leftValue: '={{ $json.step < 21 }}',
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
        id: 'd1e2847d-7e25-4685-a26f-abc67b7d819d',
        name: 'Send the reminder',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheReminder = {
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
            "={{ JSON.stringify({ to: $json.email, subject: 'Invoice ' + $json.number + ' is ' + $json.overdue + ' days overdue', template: 'overdue-' + $json.step, data: { number: $json.number, amount: $json.amount, pay_url: $json.pay_url } }) }}",
    };

    @node({
        id: '28d0640a-b3f0-4b68-a581-6844dca138a2',
        name: 'Record the step',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheStep = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/invoices',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'id',
                    value: "={{ 'eq.' + $('Which step is due?').item.json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ last_reminder_step: $('Which step is due?').item.json.step, last_reminder_at: $now.toISO() }) }}",
    };

    @node({
        id: '96fbefc6-3619-4e39-a5bd-15e65425b541',
        name: 'Escalation message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [960, 90],
    })
    EscalationMessage = {
        jsCode: 'return $input.all().map((i) => ({ json: { id: i.json.id, channel: "#finance", level: "warn", text: "Invoice " + i.json.number + " (" + i.json.email + ", " + i.json.amount + ") is " + i.json.overdue + " days overdue after three reminders. It needs a call." } }));',
    };

    @node({
        id: 'f3bc8a96-49f6-4bf6-abe8-24df7358149d',
        name: 'Hand to a person',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1200, 90],
    })
    HandToAPerson = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '1bc9658f-4841-4f01-aa08-6e03d91749d1',
        name: 'Mark escalated',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkEscalated = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/invoices',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'id',
                    value: "={{ 'eq.' + $('Escalation message').item.json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ last_reminder_step: 21, status: 'escalated' }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this._0900Daily.out(0).to(this.OpenInvoices.in(0));
        this.OpenInvoices.out(0).to(this.WhichStepIsDue.in(0));
        this.WhichStepIsDue.out(0).to(this.StillAReminder.in(0));
        this.StillAReminder.out(0).to(this.SendTheReminder.in(0));
        this.StillAReminder.out(1).to(this.EscalationMessage.in(0));
        this.SendTheReminder.out(0).to(this.RecordTheStep.in(0));
        this.EscalationMessage.out(0).to(this.HandToAPerson.in(0));
        this.HandToAPerson.out(0).to(this.MarkEscalated.in(0));
    }
}
