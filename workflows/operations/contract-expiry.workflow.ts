import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Contracts · Expiry reminders
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Monday0900                         scheduleTrigger
// ActiveContracts                    supabase                   [creds] [alwaysOutput] [retry]
// WhichWarningIsDue                  code
// WarnTheOwner                       sendGrid                   [creds] [retry]
// RecordTheWarning                   supabase                   [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Monday0900
//    → ActiveContracts
//      → WhichWarningIsDue
//        → WarnTheOwner
//          → RecordTheWarning
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Contracts · Expiry reminders',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ContractsExpiryRemindersWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '73bb3114-76cf-4870-abf0-fbbfa3815ab2',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Contracts · Expiry reminders
Warns the owner of each contract 60, 30 and 7 days before it ends, so renewals are a decision and never an accident.

**Platforms:** Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/operations\``,
    };

    @node({
        id: '7bd67fa1-8654-4e8a-a7a7-626f90c3f5fb',
        name: 'Monday 09:00',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    Monday0900 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 9 * * 1',
                },
            ],
        },
    };

    @node({
        id: '88d0cbd0-8640-4b5c-a523-473a3b2ee1ef',
        name: 'Active contracts',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ActiveContracts = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'contracts',
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
            ],
        },
    };

    @node({
        id: '6d080424-87dd-4da7-a5ca-bb31cd68a699',
        name: 'Which warning is due?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    WhichWarningIsDue = {
        jsCode: `const MARKS = [60, 30, 7];
const now = Date.now();
return $input.all().map((i) => i.json).filter((c) => c.ends_on && c.owner_email).map((c) => {
  const days = Math.ceil((new Date(c.ends_on).getTime() - now) / 864e5);
  const mark = MARKS.filter((m) => days <= m).pop();
  return { ...c, days, mark };
}).filter((c) => c.days >= 0 && c.mark && c.mark < (c.last_warning ?? 999)).map((json) => ({ json }));`,
    };

    @node({
        id: '275001f5-3bcb-47dd-a1c8-3bb2e7022143',
        name: 'Warn the owner',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [780, 90],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    WarnTheOwner = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.owner_email }}',
        dynamicTemplate: true,
        templateId: "={{ 'd-contract-expiry' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'name',
                    value: '={{ $json.name }}',
                },
                {
                    key: 'ends_on',
                    value: '={{ $json.ends_on }}',
                },
                {
                    key: 'auto_renews',
                    value: '={{ $json.auto_renews === true }}',
                },
                {
                    key: 'notice_days',
                    value: '={{ $json.notice_days }}',
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: '2ecddad7-4372-4f22-acd2-c41b5093bfbb',
        name: 'Record the warning',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1040, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheWarning = {
        resource: 'row',
        operation: 'update',
        tableId: 'contracts',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Which warning is due?').item.json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'last_warning',
                    fieldValue: "={{ $('Which warning is due?').item.json.mark }}",
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Monday0900.out(0).to(this.ActiveContracts.in(0));
        this.ActiveContracts.out(0).to(this.WhichWarningIsDue.in(0));
        this.WhichWarningIsDue.out(0).to(this.WarnTheOwner.in(0));
        this.WarnTheOwner.out(0).to(this.RecordTheWarning.in(0));
    }
}
