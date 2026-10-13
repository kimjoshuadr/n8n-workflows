import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Reviews · Ask after delivery
// Nodes   : 8  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _1000Daily                         scheduleTrigger
// DeliveredOrders                    httpRequest                [alwaysOutput] [retry]
// DeliveredAWeekAgo                  code
// OpenConversation                   httpRequest                [alwaysOutput] [retry]
// HappyCustomersOnly                 code
// AskForAReview                      httpRequest                [retry]
// MarkAsked                          httpRequest                [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _1000Daily
//    → DeliveredOrders
//      → DeliveredAWeekAgo
//        → OpenConversation
//          → HappyCustomersOnly
//            → AskForAReview
//              → MarkAsked
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Reviews · Ask after delivery',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ReviewsAskAfterDeliveryWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'e1a25c00-2ac1-4aac-a0ee-e9fe84f25bc7',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Reviews · Ask after delivery
A week after an order is delivered, asks for a review once. Customers with an open support conversation are not asked.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/sales\``,
    };

    @node({
        id: '209749a1-72c4-4469-a637-e9e634c1c82e',
        name: '10:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    _1000Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 10 * * *',
                },
            ],
        },
    };

    @node({
        id: '588c8bb6-ae47-4ea1-a866-7fb00092c8d6',
        name: 'Delivered orders',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DeliveredOrders = {
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
                    name: 'status',
                    value: "={{ 'eq.delivered' }}",
                },
                {
                    name: 'review_requested',
                    value: "={{ 'is.null' }}",
                },
            ],
        },
    };

    @node({
        id: '750c9e07-a331-4b34-a4ed-b7434a4e43de',
        name: 'Delivered a week ago',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    DeliveredAWeekAgo = {
        jsCode: `const now = Date.now();
return $input.all().map((i) => i.json).filter((o) => o.email && o.delivered_at)
  .filter((o) => { const d = (now - new Date(o.delivered_at).getTime()) / 864e5; return d >= 7 && d < 30; })
  .map((json) => ({ json }));`,
    };

    @node({
        id: '114943dd-33dd-4235-a5cb-60a812fcfd28',
        name: 'Open conversation?',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenConversation = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/support_conversations',
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
                    name: 'status',
                    value: "={{ 'eq.open' }}",
                },
                {
                    name: 'limit',
                    value: "={{ '1' }}",
                },
            ],
        },
    };

    @node({
        id: 'c2b70183-35d4-421a-a733-a998bc8059a1',
        name: 'Happy customers only',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 90],
    })
    HappyCustomersOnly = {
        jsCode: `const orders = $("Delivered a week ago").all();
return $input.all().map((item, i) => ({ order: orders[i]?.json, open: !!item.json.email })).filter((x) => x.order && !x.open).map((x) => ({ json: x.order }));`,
    };

    @node({
        id: 'b8a8cda5-898f-4c8b-a116-4c314605eb46',
        name: 'Ask for a review',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AskForAReview = {
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
            "={{ JSON.stringify({ to: $json.email, subject: 'How was your order?', template: 'review-request', data: { order_id: $json.order_id } }) }}",
    };

    @node({
        id: '6dceb0d3-ec0d-4c4c-a36a-8e05da7c8222',
        name: 'Mark asked',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkAsked = {
        method: 'PATCH',
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
                    name: 'order_id',
                    value: "={{ 'eq.' + $('Happy customers only').item.json.order_id }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ review_requested: true }) }}',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this._1000Daily.out(0).to(this.DeliveredOrders.in(0));
        this.DeliveredOrders.out(0).to(this.DeliveredAWeekAgo.in(0));
        this.DeliveredAWeekAgo.out(0).to(this.OpenConversation.in(0));
        this.OpenConversation.out(0).to(this.HappyCustomersOnly.in(0));
        this.HappyCustomersOnly.out(0).to(this.AskForAReview.in(0));
        this.AskForAReview.out(0).to(this.MarkAsked.in(0));
    }
}
