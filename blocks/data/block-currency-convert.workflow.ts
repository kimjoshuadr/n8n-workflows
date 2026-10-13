import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Convert a currency amount
// Nodes   : 4  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// TodaySRate                         httpRequest                [onError→regular] [creds] [retry]
// Convert                            code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → TodaySRate
//      → Convert
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Convert a currency amount',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockConvertACurrencyAmountWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'af6c0d6b-1356-4993-a26a-4726d9bcc5f0',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Convert a currency amount
Converts an amount with today's rate, rounds like money, and says so when the rate could not be fetched instead of returning a wrong number.

**Platforms:** Stripe
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: 'ebe25fb7-4a24-45b5-ac09-7d05b40a2dcc',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: 'b8eae34c-eba4-46dd-a24f-bfcfa705a611',
        name: "Today's rate",
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TodaySRate = {
        method: 'GET',
        url: "={{ 'https://api.stripe.com/v1/exchange_rates/' + String($json.from).toLowerCase() }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'stripeApi',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: 'f0da4299-28e6-4bb4-af0c-d9a913e8d62b',
        name: 'Convert',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    Convert = {
        jsCode: `const req = $("When called").first().json;
const rate = $input.first().json.rates?.[String(req.to).toLowerCase()];
if (typeof rate !== "number") return [{ json: { ...req, converted: null, ok: false, reason: "No rate available for " + req.from + " to " + req.to } }];
return [{ json: { ...req, rate, converted: Math.round(req.amount * rate * 100) / 100, ok: true } }];`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.TodaySRate.in(0));
        this.TodaySRate.out(0).to(this.Convert.in(0));
    }
}
