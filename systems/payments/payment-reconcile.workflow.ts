import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Payments · Daily reconciliation
// Nodes   : 12  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _0600Daily                         scheduleTrigger
// ProcessorCharges                   httpRequest                [creds] [retry]
// LedgerLines                        supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
// Compare                            code
// BooksAgree                         if
// PostAllClear                       slack                      [creds] [retry]
// OneItemPerIssue                    code
// RecordTheIssue                     supabase                   [creds] [retry]
// MismatchMessage                    code
// AlertFinance                       executeWorkflow
// CheckIn                            supabase                   [onError→regular] [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _0600Daily
//    → ProcessorCharges
//      → LedgerLines
//        → Compare
//          → BooksAgree
//            → PostAllClear
//              → CheckIn
//           .out(1) → OneItemPerIssue
//              → RecordTheIssue
//                → MismatchMessage
//                  → AlertFinance
//                    → CheckIn (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Payments · Daily reconciliation',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PaymentsDailyReconciliationWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'e43a88b1-c1da-468d-a0ea-8790748dbf5a',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Payments · Daily reconciliation
Each morning, compares yesterday's charges at the processor with the ledger and reports anything on one side and not the other.

**Platforms:** Stripe, Supabase, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/payments\``,
    };

    @node({
        id: '7d600885-f91c-4cc3-af82-fbd7ba4b927c',
        name: '06:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
    })
    _0600Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 6 * * *',
                },
            ],
        },
    };

    @node({
        id: 'c5917dc6-e8fc-478c-aee8-ae164a00f7dd',
        name: 'Processor charges',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ProcessorCharges = {
        method: 'GET',
        url: "={{ 'https://api.stripe.com/v1/charges' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'stripeApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'created[gte]',
                    value: "={{ $now.minus({ days: 1 }).startOf('day').toSeconds() }}",
                },
                {
                    name: 'created[lt]',
                    value: "={{ $now.startOf('day').toSeconds() }}",
                },
                {
                    name: 'limit',
                    value: "={{ '100' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '632b65b5-be2c-4acd-a058-db7eae07c639',
        name: 'Ledger lines',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LedgerLines = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'ledger',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'kind',
                    condition: 'eq',
                    keyValue: "={{ 'payment' }}",
                },
                {
                    keyName: 'at',
                    condition: 'gte',
                    keyValue: "={{ $now.minus({ days: 1 }).startOf('day').toISO() }}",
                },
            ],
        },
    };

    @node({
        id: '6c6469bd-515b-4991-a575-2aa0cf2cd9df',
        name: 'Compare',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 180],
    })
    Compare = {
        jsCode: `const charges = ($("Processor charges").first().json.data ?? []).filter((c) => c.paid !== false);
const ledger = $input.all().map((i) => i.json).filter((l) => l.charge_id);
const byCharge = new Map(ledger.map((l) => [l.charge_id, l]));
const seen = new Set();
const issues = [];
for (const c of charges) {
  const l = byCharge.get(c.id);
  seen.add(c.id);
  if (!l) issues.push({ charge_id: c.id, kind: "missing_in_ledger", processor_amount: c.amount / 100 });
  else if (Math.round(l.amount * 100) !== c.amount) issues.push({ charge_id: c.id, kind: "amount_mismatch", processor_amount: c.amount / 100, ledger_amount: l.amount });
}
for (const l of ledger) if (!seen.has(l.charge_id)) issues.push({ charge_id: l.charge_id, kind: "missing_at_processor", ledger_amount: l.amount });
return [{ json: { checked: charges.length, issues, clean: issues.length === 0, total: charges.reduce((s, c) => s + c.amount, 0) / 100 } }];`,
    };

    @node({
        id: '1ac26b73-71a4-402f-a332-4804406f7c4f',
        name: 'Books agree?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    BooksAgree = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6ad9315d-1aa2-4567-a265-0861ce46dcbb',
                    leftValue: '={{ $json.clean }}',
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
        id: '5e722fa8-bb0e-49f9-a03c-dc00632cb69c',
        name: 'Post all clear',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1300, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostAllClear = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#finance' }}",
        },
        text: "={{ ':white_check_mark: Reconciled ' + $json.checked + ' charges, ' + $json.total + ' total. Ledger matches.' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: 'f651870d-db74-4847-ae11-2d8699a41978',
        name: 'One item per issue',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 270],
    })
    OneItemPerIssue = {
        jsCode: 'return $input.first().json.issues.map((json) => ({ json: { ...json, found_at: new Date().toISOString(), status: "open" } }));',
    };

    @node({
        id: '5aec6bc4-13fd-4e1a-a9d4-15b8d2ece623',
        name: 'Record the issue',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1560, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheIssue = {
        resource: 'row',
        operation: 'create',
        tableId: 'reconciliation_issues',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'charge_id',
                    fieldValue: '={{ $json.charge_id }}',
                },
                {
                    fieldId: 'kind',
                    fieldValue: '={{ $json.kind }}',
                },
                {
                    fieldId: 'processor_amount',
                    fieldValue: '={{ $json.processor_amount ?? null }}',
                },
                {
                    fieldId: 'ledger_amount',
                    fieldValue: '={{ $json.ledger_amount ?? null }}',
                },
                {
                    fieldId: 'found_at',
                    fieldValue: '={{ $json.found_at }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: '={{ $json.status }}',
                },
            ],
        },
    };

    @node({
        id: 'bc5376cf-8aa8-4c91-a159-fb684999e867',
        name: 'Mismatch message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 180],
    })
    MismatchMessage = {
        jsCode: `const r = $("Compare").first().json;
return [{ json: { channel: "#finance", level: "critical", text: r.issues.length + " of " + r.checked + " charges do not match the ledger: " + r.issues.map((i) => i.charge_id + " (" + i.kind + ")").join(", ") } }];`,
    };

    @node({
        id: 'af4a34ba-439e-4109-aba9-7dc7789a4510',
        name: 'Alert finance',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2080, 180],
    })
    AlertFinance = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '72c516a4-1e98-46a0-ac10-4f4bf0c09399',
        name: 'Check in',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2340, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CheckIn = {
        resource: 'row',
        operation: 'update',
        tableId: 'heartbeats',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'name',
                    condition: 'eq',
                    keyValue: "={{ 'payment-reconcile' }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'last_seen',
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
        this._0600Daily.out(0).to(this.ProcessorCharges.in(0));
        this.ProcessorCharges.out(0).to(this.LedgerLines.in(0));
        this.LedgerLines.out(0).to(this.Compare.in(0));
        this.Compare.out(0).to(this.BooksAgree.in(0));
        this.BooksAgree.out(0).to(this.PostAllClear.in(0));
        this.BooksAgree.out(1).to(this.OneItemPerIssue.in(0));
        this.PostAllClear.out(0).to(this.CheckIn.in(0));
        this.OneItemPerIssue.out(0).to(this.RecordTheIssue.in(0));
        this.RecordTheIssue.out(0).to(this.MismatchMessage.in(0));
        this.MismatchMessage.out(0).to(this.AlertFinance.in(0));
        this.AlertFinance.out(0).to(this.CheckIn.in(0));
    }
}
