import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Payments · Post-purchase email
// Nodes   : 7  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionGetCheckoutDetails          stickyNote
// SectionEmail                       stickyNote
// OnCheckoutSuccess                  stripeTrigger              [creds]
// GetLineItems                       httpRequest                [creds] [retry]
// IfProduct                          filter
// SendEmail                          httpRequest                [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OnCheckoutSuccess
//    → GetLineItems
//      → IfProduct
//        → SendEmail
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Payments · Post-purchase email',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PaymentsPostPurchaseEmailWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '3f88b958-eb66-4e70-a5b5-c8ce0128e090',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Payments · Post-purchase email
When a Stripe checkout completes, reads the line items, checks which product was bought, and sends that product's email through SendGrid. A purchase of anything else sends nothing.

**Platforms:** Stripe, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/operations\``,
    };

    @node({
        id: 'c15b1a37-e5b0-4569-ab20-46f04f63329d',
        name: 'Section: Get checkout details',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionGetCheckoutDetails = {
        width: 640,
        height: 330,
        color: 4,
        content: '## 1. Get checkout details',
    };

    @node({
        id: '8e3d8f9b-5665-4603-ae79-b6d5fdb8d576',
        name: 'Section: Email',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 410],
    })
    SectionEmail = {
        width: 640,
        height: 330,
        color: 5,
        content: '## 2. Email',
    };

    @node({
        id: '6e55e9c4-30ac-4d78-af8c-8066de8b052a',
        webhookId: 'fe41609e-2a01-4adf-a012-17bac055fd69',
        name: 'on_checkout_success',
        type: 'n8n-nodes-base.stripeTrigger',
        version: 1,
        position: [0, 200],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
    })
    OnCheckoutSuccess = {
        events: ['checkout.session.completed'],
    };

    @node({
        id: '421f6a19-a37d-4341-a293-916b408460a2',
        name: 'get_line_items',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 200],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetLineItems = {
        method: 'GET',
        url: "={{ 'https://api.stripe.com/v1/checkout/sessions/' + $json.data.object.id + '/line_items' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'stripeApi',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'd1858bd8-c2ec-4634-a88e-9c91e52d54b4',
        name: 'if_product',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [0, 610],
    })
    IfProduct = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd57c50a8-1afe-465a-a5ba-5827ffd92ba0',
                    leftValue: "={{ ($json.data ?? []).some((line) => line.price?.product === 'prod_course') }}",
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
        id: 'e956560d-c7c0-4504-a6f6-66f761977cb3',
        name: 'send_email',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 610],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendEmail = {
        method: 'POST',
        url: "={{ 'https://api.sendgrid.com/v3/mail/send' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'sendGridApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ from: { email: 'hello@example.com', name: 'Acme' }, template_id: 'd-course-welcome', personalizations: [ { to: [ { email: $('on_checkout_success').first().json.data.object.customer_details.email } ], dynamic_template_data: { name: $('on_checkout_success').first().json.data.object.customer_details.name ?? '' } } ] }) }}",
        options: {
            timeout: 15000,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.OnCheckoutSuccess.out(0).to(this.GetLineItems.in(0));
        this.GetLineItems.out(0).to(this.IfProduct.in(0));
        this.IfProduct.out(0).to(this.SendEmail.in(0));
    }
}
