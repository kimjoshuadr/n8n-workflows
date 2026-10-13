import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Lead intake · Follow up the unbooked
// Nodes   : 9  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// EveryMorning                       scheduleTrigger
// UnbookedLeads                      supabase                   [creds] [alwaysOutput] [retry]
// WhoIsDue                           code
// NudgesLeft                         if
// SendTheNudge                       sendGrid                   [creds] [retry]
// RecordTheNudge                     supabase                   [creds] [retry]
// MarkCold                           supabase                   [creds] [retry]
// CheckIn                            supabase                   [onError→regular] [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// EveryMorning
//    → UnbookedLeads
//      → WhoIsDue
//        → NudgesLeft
//          → SendTheNudge
//            → RecordTheNudge
//         .out(1) → MarkCold
//    → CheckIn
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Lead intake · Follow up the unbooked',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class LeadIntakeFollowUpTheUnbookedWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '00756567-1278-40f7-aed3-eddf96a4534e',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Lead intake · Follow up the unbooked
Each morning, writes to qualified leads who have not booked. Three nudges, two days apart, then the lead is marked cold and left alone.

**Platforms:** Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/lead-intake\``,
    };

    @node({
        id: 'fc6eff86-5da9-4143-acd2-26d5040e967c',
        name: 'Every morning',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
    })
    EveryMorning = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 9 * * 1-5',
                },
            ],
        },
    };

    @node({
        id: '6a9921e9-7fa6-45c6-ac0b-cfb0ec3a0779',
        name: 'Unbooked leads',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UnbookedLeads = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'leads',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'status',
                    condition: 'eq',
                    keyValue: "={{ 'qualified' }}",
                },
                {
                    keyName: 'booked',
                    condition: 'eq',
                    keyValue: "={{ 'false' }}",
                },
            ],
        },
    };

    @node({
        id: '61e3f413-9ae6-437e-a724-f2f2648ffa16',
        name: 'Who is due?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 180],
    })
    WhoIsDue = {
        jsCode: `const now = Date.now();
const TWO_DAYS = 2 * 864e5;
return $input.all().map((i) => i.json).filter((l) => l.email)
  .filter((l) => now - new Date(l.last_contact_at ?? l.received_at).getTime() >= TWO_DAYS)
  .map((l) => ({ json: { ...l, next: (l.follow_ups ?? 0) + 1, give_up: (l.follow_ups ?? 0) >= 3 } }));`,
    };

    @node({
        id: 'e434ad25-0e23-4e43-a77c-47f6e56e389e',
        name: 'Nudges left?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
    })
    NudgesLeft = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '308a4ea2-73a0-47d7-a94a-55bb747651f2',
                    leftValue: '={{ !$json.give_up }}',
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
        id: '7db1d3b9-5dba-4640-ab26-33f25dbc4bd2',
        name: 'Send the nudge',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1040, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheNudge = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.email }}',
        dynamicTemplate: true,
        templateId: "={{ 'd-follow-up-' + $json.next }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'name',
                    value: '={{ $json.name }}',
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: '28ef7e12-6f90-4c26-aee4-f1a41f98ec10',
        name: 'Record the nudge',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheNudge = {
        resource: 'row',
        operation: 'update',
        tableId: 'leads',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'email',
                    condition: 'eq',
                    keyValue: "={{ $('Nudges left?').item.json.email }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'follow_ups',
                    fieldValue: "={{ $('Nudges left?').item.json.next }}",
                },
                {
                    fieldId: 'last_contact_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'ecd9d818-37af-490c-ae0f-f099acb906af',
        name: 'Mark cold',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1040, 270],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkCold = {
        resource: 'row',
        operation: 'update',
        tableId: 'leads',
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
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'status',
                    fieldValue: "={{ 'cold' }}",
                },
            ],
        },
    };

    @node({
        id: 'a9dbff5c-ca38-4410-a3e2-7e657defbe85',
        name: 'Check in',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 270],
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
                    keyValue: "={{ 'lead-follow-up' }}",
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
        this.EveryMorning.out(0).to(this.UnbookedLeads.in(0));
        this.EveryMorning.out(0).to(this.CheckIn.in(0));
        this.UnbookedLeads.out(0).to(this.WhoIsDue.in(0));
        this.WhoIsDue.out(0).to(this.NudgesLeft.in(0));
        this.NudgesLeft.out(0).to(this.SendTheNudge.in(0));
        this.NudgesLeft.out(1).to(this.MarkCold.in(0));
        this.SendTheNudge.out(0).to(this.RecordTheNudge.in(0));
    }
}
