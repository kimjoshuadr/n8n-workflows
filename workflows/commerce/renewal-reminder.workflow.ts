import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Subscriptions · Renewal reminders
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _0800Daily                         scheduleTrigger
// ActiveSubscriptions                supabase                   [creds] [alwaysOutput] [retry]
// RenewingInAWeek                    code
// SendTheNotice                      sendGrid                   [creds] [retry]
// MarkReminded                       supabase                   [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _0800Daily
//    → ActiveSubscriptions
//      → RenewingInAWeek
//        → SendTheNotice
//          → MarkReminded
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Subscriptions · Renewal reminders',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SubscriptionsRenewalRemindersWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b2a7687c-efa6-4565-a1c3-68f28ce1b514',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Subscriptions · Renewal reminders
Tells subscribers a week before an annual renewal, once, with the amount and the date, so the charge is never a surprise.

**Platforms:** Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/commerce\``,
    };

    @node({
        id: '1edddb14-9cdf-4006-a0e2-d1a2e31e0f3c',
        name: '08:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    _0800Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 8 * * *',
                },
            ],
        },
    };

    @node({
        id: 'ad792b75-15ae-418c-ac43-2afaa3873c22',
        name: 'Active subscriptions',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ActiveSubscriptions = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'subscriptions',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'active' }}",
                },
                {
                    keyName: 'interval',
                    condition: 'eq',
                    keyValue: "={{ 'year' }}",
                },
            ],
        },
    };

    @node({
        id: 'a75161ec-ba9d-4a9c-ac63-bdef70d7803f',
        name: 'Renewing in a week',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    RenewingInAWeek = {
        jsCode: `const now = Date.now();
return $input.all().map((i) => i.json).filter((s) => s.email && s.renews_at).filter((s) => {
  const days = (new Date(s.renews_at).getTime() - now) / 864e5;
  return days > 0 && days <= 7 && s.reminded_for !== s.renews_at;
}).map((json) => ({ json }));`,
    };

    @node({
        id: 'a23c2148-c86f-40f1-a64c-d266c6082ec6',
        name: 'Send the notice',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [780, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheNotice = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.email }}',
        dynamicTemplate: true,
        templateId: "={{ 'd-renewal-notice' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'amount',
                    value: '={{ $json.amount }}',
                },
                {
                    key: 'currency',
                    value: '={{ $json.currency }}',
                },
                {
                    key: 'renews_at',
                    value: '={{ $json.renews_at }}',
                },
                {
                    key: 'manage_url',
                    value: '={{ $json.manage_url }}',
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: 'af87ac3d-445b-4495-a5df-98a64360233b',
        name: 'Mark reminded',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1040, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkReminded = {
        resource: 'row',
        operation: 'update',
        tableId: 'subscriptions',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Renewing in a week').item.json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'reminded_for',
                    fieldValue: "={{ $('Renewing in a week').item.json.renews_at }}",
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this._0800Daily.out(0).to(this.ActiveSubscriptions.in(0));
        this.ActiveSubscriptions.out(0).to(this.RenewingInAWeek.in(0));
        this.RenewingInAWeek.out(0).to(this.SendTheNotice.in(0));
        this.SendTheNotice.out(0).to(this.MarkReminded.in(0));
    }
}
