import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Events · Webinar registration and reminders
// Nodes   : 16  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Registration                       webhook
// ReadTheForm                        code
// Valid                              if
// Invalid                            respondToWebhook
// LoadTheWebinar                     supabase                   [creds] [alwaysOutput] [retry]
// SeatsLeft                          if
// Register                           supabase                   [onError→out(1)] [creds]
// RegisteredAlready                  if
// TryAgain                           respondToWebhook
// CountTheSeat                       supabase                   [creds] [retry]
// SendTheInvite                      sendGrid                   [creds] [retry]
// Confirmed                          respondToWebhook
// AlreadyRegistered                  respondToWebhook
// AddToWaitlist                      supabase                   [creds] [retry]
// Waitlisted                         respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Registration
//    → ReadTheForm
//      → Valid
//        → LoadTheWebinar
//          → SeatsLeft
//            → Register
//              → CountTheSeat
//                → SendTheInvite
//                  → Confirmed
//             .out(1) → RegisteredAlready
//                → AlreadyRegistered
//               .out(1) → TryAgain
//           .out(1) → AddToWaitlist
//              → Waitlisted
//       .out(1) → Invalid
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Events · Webinar registration and reminders',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class EventsWebinarRegistrationAndRemindersWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '94b9bb57-e865-4777-a101-c40bc4d3a993',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Events · Webinar registration and reminders
Registers someone for a webinar, sends the calendar invite, and reminds them a day and an hour before. Full sessions get a waitlist reply.

**Platforms:** Supabase, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/sales\``,
    };

    @node({
        id: '84fdd34d-0acb-4d79-afc1-890f3c149c2b',
        webhookId: '45ead164-37b3-49fe-a3a4-6f6df1b0b1fa',
        name: 'Registration',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 270],
    })
    Registration = {
        httpMethod: 'POST',
        path: 'webinar-register',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'a4de99b5-a706-4a2f-a431-d8138de2aa91',
        name: 'Read the form',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 270],
    })
    ReadTheForm = {
        jsCode: `const b = $input.first().json.body ?? {};
const email = String(b.email ?? "").trim().toLowerCase();
return [{ json: { valid: /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email) && !!b.webinar_id, email, name: String(b.name ?? "").trim(), webinar_id: String(b.webinar_id ?? "") } }];`,
    };

    @node({
        id: '6ac60d43-855b-4256-ab86-5cb748269af3',
        name: 'Valid?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 270],
    })
    Valid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '8ba548b6-353c-474e-a581-189fba03a955',
                    leftValue: '={{ $json.valid }}',
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
        id: '969476db-290f-4136-add8-c2187d38051d',
        name: 'Invalid',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [780, 180],
    })
    Invalid = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: false, error: 'A valid email and a webinar are required' }) }}",
        options: {
            responseCode: 400,
        },
    };

    @node({
        id: 'f5a5fd9d-6142-41d4-afdc-9431895facb9',
        name: 'Load the webinar',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 360],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LoadTheWebinar = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'webinars',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: '={{ $json.webinar_id }}',
                },
            ],
        },
    };

    @node({
        id: '52b5b9dd-0c38-4456-a42a-11d8c20516df',
        name: 'Seats left?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 270],
    })
    SeatsLeft = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '29a8c670-2e15-429a-af52-6794689dbd48',
                    leftValue: '={{ !!$json.id && ($json.registered ?? 0) < $json.capacity }}',
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
        id: '5a5f949e-b610-4c2b-aafc-11893dadaadc',
        name: 'Register',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueErrorOutput',
    })
    Register = {
        resource: 'row',
        operation: 'create',
        tableId: 'registrations',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'key',
                    fieldValue:
                        "={{ $('Read the form').first().json.webinar_id + ':' + $('Read the form').first().json.email }}",
                },
                {
                    fieldId: 'webinar_id',
                    fieldValue: "={{ $('Read the form').first().json.webinar_id }}",
                },
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('Read the form').first().json.email }}",
                },
                {
                    fieldId: 'name',
                    fieldValue: "={{ $('Read the form').first().json.name }}",
                },
                {
                    fieldId: 'reminded_day',
                    fieldValue: '={{ false }}',
                },
                {
                    fieldId: 'reminded_hour',
                    fieldValue: '={{ false }}',
                },
            ],
        },
    };

    @node({
        id: 'b6e25c6d-ac45-4ebe-a974-d7bff37afbcf',
        name: 'Registered already?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 90],
    })
    RegisteredAlready = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '9f291673-cc31-41db-aa79-28029678fc00',
                    leftValue: "={{ /duplicate key|23505/.test(String($json.error ?? '')) }}",
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
        id: '4906bd42-13fa-4320-af48-dfa69a248875',
        name: 'Try again',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1820, 90],
    })
    TryAgain = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ ok: false, error: 'Registration is unavailable for a moment. Please try again.' }) }}",
        options: {
            responseCode: 503,
        },
    };

    @node({
        id: '39d1899e-d1cd-4cf0-a1ba-c4c5c3b8a480',
        name: 'Count the seat',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1560, 270],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CountTheSeat = {
        resource: 'row',
        operation: 'update',
        tableId: 'webinars',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'id',
                    condition: 'eq',
                    keyValue: "={{ $('Load the webinar').first().json.id }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'registered',
                    fieldValue: "={{ ($('Load the webinar').first().json.registered ?? 0) + 1 }}",
                },
            ],
        },
    };

    @node({
        id: '5ddd5294-a794-4b65-ab8d-b5b27a9c8270',
        name: 'Send the invite',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1820, 270],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheInvite = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('Read the form').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-webinar-confirmed' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'title',
                    value: "={{ $('Load the webinar').first().json.title }}",
                },
                {
                    key: 'starts_at',
                    value: "={{ $('Load the webinar').first().json.starts_at }}",
                },
                {
                    key: 'join_url',
                    value: "={{ $('Load the webinar').first().json.join_url }}",
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: '4ff542d0-6946-47aa-a546-25dd5a54921d',
        name: 'Confirmed',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2080, 270],
    })
    Confirmed = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'registered' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'e75c8f15-5b89-4a39-aa36-d441b6d50f68',
        name: 'Already registered',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1820, 450],
    })
    AlreadyRegistered = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'already_registered' }) }}",
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'be848488-61d4-47e6-ab84-78065c63d285',
        name: 'Add to waitlist',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 360],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AddToWaitlist = {
        resource: 'row',
        operation: 'create',
        tableId: 'waitlist',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'webinar_id',
                    fieldValue: "={{ $('Read the form').first().json.webinar_id }}",
                },
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('Read the form').first().json.email }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'f0100853-d664-47d8-ad8a-fa1dfa6be095',
        name: 'Waitlisted',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1560, 450],
    })
    Waitlisted = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify({ ok: true, status: 'waitlisted' }) }}",
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Registration.out(0).to(this.ReadTheForm.in(0));
        this.ReadTheForm.out(0).to(this.Valid.in(0));
        this.Valid.out(0).to(this.LoadTheWebinar.in(0));
        this.Valid.out(1).to(this.Invalid.in(0));
        this.LoadTheWebinar.out(0).to(this.SeatsLeft.in(0));
        this.SeatsLeft.out(0).to(this.Register.in(0));
        this.SeatsLeft.out(1).to(this.AddToWaitlist.in(0));
        this.Register.out(0).to(this.CountTheSeat.in(0));
        this.Register.out(1).to(this.RegisteredAlready.in(0));
        this.CountTheSeat.out(0).to(this.SendTheInvite.in(0));
        this.SendTheInvite.out(0).to(this.Confirmed.in(0));
        this.AddToWaitlist.out(0).to(this.Waitlisted.in(0));
        this.RegisteredAlready.out(0).to(this.AlreadyRegistered.in(0));
        this.RegisteredAlready.out(1).to(this.TryAgain.in(0));
    }
}
