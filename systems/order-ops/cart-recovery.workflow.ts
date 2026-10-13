import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Order ops · Abandoned cart recovery
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every30Minutes                     scheduleTrigger
// OpenCarts                          supabase                   [creds] [alwaysOutput] [retry]
// OldEnoughWithAnEmail               code
// OrderedSince                       supabase                   [creds] [alwaysOutput] [retry]
// KeepTheOnesWhoDidNot               code
// SendTheReminder                    sendGrid                   [creds] [retry]
// MarkReminded                       supabase                   [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every30Minutes
//    → OpenCarts
//      → OldEnoughWithAnEmail
//        → OrderedSince
//          → KeepTheOnesWhoDidNot
//            → SendTheReminder
//              → MarkReminded
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Order ops · Abandoned cart recovery',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class OrderOpsAbandonedCartRecoveryWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'f6f15c39-e5cc-4a24-af37-ea7a6d11700d',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Order ops · Abandoned cart recovery
Every half hour, writes once to people who left a cart over an hour ago and have not ordered since.

**Platforms:** Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/order-ops\``,
    };

    @node({
        id: 'bf374b17-7bf5-455e-aa1b-cd26e7b0b724',
        name: 'Every 30 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    Every30Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 30,
                },
            ],
        },
    };

    @node({
        id: 'ef20ccc2-6d8f-4926-a900-55032fbf7a07',
        name: 'Open carts',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenCarts = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'carts',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'recovered',
                    condition: 'eq',
                    keyValue: "={{ 'false' }}",
                },
                {
                    keyName: 'reminded',
                    condition: 'eq',
                    keyValue: "={{ 'false' }}",
                },
            ],
        },
    };

    @node({
        id: 'f596ebf9-a01e-4790-a4f2-6e03f5bd4c6e',
        name: 'Old enough, with an email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    OldEnoughWithAnEmail = {
        jsCode: `const now = Date.now();
return $input.all().map((i) => i.json).filter((c) => c.email && c.updated_at)
  .filter((c) => now - new Date(c.updated_at).getTime() > 36e5)
  .filter((c) => now - new Date(c.updated_at).getTime() < 3 * 864e5)
  .map((json) => ({ json }));`,
    };

    @node({
        id: '45339362-e072-4837-af59-ff251cb63367',
        name: 'Ordered since?',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OrderedSince = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'orders',
        returnAll: false,
        limit: 1,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'email',
                    condition: 'eq',
                    keyValue: '={{ $json.email }}',
                },
            ],
        },
    };

    @node({
        id: '4bd795cf-d826-4fed-abe3-f96e4f87ce3f',
        name: 'Keep the ones who did not',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 90],
    })
    KeepTheOnesWhoDidNot = {
        jsCode: `const carts = $("Old enough, with an email").all();
return $input.all().map((item, i) => ({ cart: carts[i]?.json, ordered: !!item.json.order_id }))
  .filter((x) => x.cart && !x.ordered).map((x) => ({ json: x.cart }));`,
    };

    @node({
        id: '7a6181b9-c613-4c6f-aaf1-dc55d26ca9a6',
        name: 'Send the reminder',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1300, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheReminder = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.email }}',
        dynamicTemplate: true,
        templateId: "={{ 'd-cart-reminder' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'items',
                    value: '={{ $json.items }}',
                },
                {
                    key: 'cart_url',
                    value: '={{ $json.cart_url }}',
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: 'bffa7485-a137-422c-a30b-1fc7f3ea835d',
        name: 'Mark reminded',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1560, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkReminded = {
        resource: 'row',
        operation: 'update',
        tableId: 'carts',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Keep the ones who did not').item.json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'reminded',
                    fieldValue: '={{ true }}',
                },
                {
                    fieldId: 'reminded_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Every30Minutes.out(0).to(this.OpenCarts.in(0));
        this.OpenCarts.out(0).to(this.OldEnoughWithAnEmail.in(0));
        this.OldEnoughWithAnEmail.out(0).to(this.OrderedSince.in(0));
        this.OrderedSince.out(0).to(this.KeepTheOnesWhoDidNot.in(0));
        this.KeepTheOnesWhoDidNot.out(0).to(this.SendTheReminder.in(0));
        this.SendTheReminder.out(0).to(this.MarkReminded.in(0));
    }
}
