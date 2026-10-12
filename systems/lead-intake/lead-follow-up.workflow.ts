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
// UnbookedLeads                      httpRequest                [alwaysOutput] [retry]
// WhoIsDue                           code
// NudgesLeft                         if
// SendTheNudge                       httpRequest                [retry]
// RecordTheNudge                     httpRequest                [retry]
// MarkCold                           httpRequest                [retry]
// CheckIn                            httpRequest                [onError→regular] [retry]
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
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## Lead intake · Follow up the unbooked
Each morning, writes to qualified leads who have not booked. Three nudges, two days apart, then the lead is marked cold and left alone.

**Needs:** DB_API_KEY, DB_BASE_URL, EMAIL_API_KEY, EMAIL_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/lead-intake\``,
    };

    @node({
        id: 'fc6eff86-5da9-4143-acd2-26d5040e967c',
        name: 'Every morning',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, -90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UnbookedLeads = {
        method: 'GET',
        url: '={{ $env.DB_BASE_URL }}/leads',
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
                    value: "={{ 'eq.qualified' }}",
                },
                {
                    name: 'booked',
                    value: "={{ 'eq.false' }}",
                },
            ],
        },
    };

    @node({
        id: '61e3f413-9ae6-437e-a724-f2f2648ffa16',
        name: 'Who is due?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [480, 0],
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
        position: [720, 0],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheNudge = {
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
            "={{ JSON.stringify({ to: $json.email, subject: ['Still thinking it over?', 'A quick question', 'Closing the loop'][$json.next - 1], template: 'follow-up-' + $json.next, data: { name: $json.name } }) }}",
    };

    @node({
        id: '28ef7e12-6f90-4c26-aee4-f1a41f98ec10',
        name: 'Record the nudge',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1200, 0],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheNudge = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/leads',
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
                    value: "={{ 'eq.' + $('Nudges left?').item.json.email }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ follow_ups: $('Nudges left?').item.json.next, last_contact_at: $now.toISO() }) }}",
    };

    @node({
        id: 'ecd9d818-37af-490c-ae0f-f099acb906af',
        name: 'Mark cold',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [960, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkCold = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/leads',
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
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ status: 'cold' }) }}",
    };

    @node({
        id: 'a9dbff5c-ca38-4410-a3e2-7e657defbe85',
        name: 'Check in',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [240, 90],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CheckIn = {
        method: 'PATCH',
        url: '={{ $env.DB_BASE_URL }}/heartbeats',
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
                    name: 'name',
                    value: "={{ 'eq.lead-follow-up' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ last_seen: $now.toISO() }) }}',
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
