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
// OpenCarts                          httpRequest                [alwaysOutput] [retry]
// OldEnoughWithAnEmail               code
// OrderedSince                       httpRequest                [alwaysOutput] [retry]
// KeepTheOnesWhoDidNot               code
// SendTheReminder                    httpRequest                [retry]
// MarkReminded                       httpRequest                [retry]
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
        position: [-40, -300],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Order ops · Abandoned cart recovery
Every half hour, writes once to people who left a cart over an hour ago and have not ordered since.

**Needs:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/order-ops\``,
    };

    @node({
        id: 'bf374b17-7bf5-455e-aa1b-cd26e7b0b724',
        name: 'Every 30 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenCarts = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/carts',
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
                    name: 'recovered',
                    value: "={{ 'eq.false' }}",
                },
                {
                    name: 'reminded',
                    value: "={{ 'eq.false' }}",
                },
            ],
        },
    };

    @node({
        id: 'f596ebf9-a01e-4790-a4f2-6e03f5bd4c6e',
        name: 'Old enough, with an email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, 0],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OrderedSince = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/orders',
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
                    name: 'email',
                    value: "={{ 'eq.' + $json.email }}",
                },
                {
                    name: 'limit',
                    value: "={{ '1' }}",
                },
            ],
        },
    };

    @node({
        id: '4bd795cf-d826-4fed-abe3-f96e4f87ce3f',
        name: 'Keep the ones who did not',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [960, 0],
    })
    KeepTheOnesWhoDidNot = {
        jsCode: `const carts = $("Old enough, with an email").all();
return $input.all().map((item, i) => ({ cart: carts[i]?.json, ordered: !!item.json.order_id }))
  .filter((x) => x.cart && !x.ordered).map((x) => ({ json: x.cart }));`,
    };

    @node({
        id: '7a6181b9-c613-4c6f-aaf1-dc55d26ca9a6',
        name: 'Send the reminder',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, 0],
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
            "={{ JSON.stringify({ to: $json.email, subject: 'You left something behind', template: 'cart-reminder', data: { items: $json.items, cart_url: $json.cart_url } }) }}",
    };

    @node({
        id: 'bffa7485-a137-422c-a30b-1fc7f3ea835d',
        name: 'Mark reminded',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkReminded = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/carts',
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
                    value: "={{ 'eq.' + $('Keep the ones who did not').item.json.id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ reminded: true, reminded_at: $now.toISO() }) }}',
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
