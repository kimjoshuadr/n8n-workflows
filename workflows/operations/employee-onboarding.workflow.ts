import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : People · New hire onboarding
// Nodes   : 13  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// HireConfirmed                      webhook
// FetchTheEmployee                   httpRequest                [creds] [retry]
// ReadTheHire                        code
// SeenBefore                         executeWorkflow
// NewHire                            if
// BuildTheChecklist                  code
// SaveTheTask                        supabase                   [creds] [retry]
// BookFirstDayWelcome                googleCalendar             [onError→regular] [creds] [executeOnce] [retry]
// ScheduleTheWelcomeEmail            sendGrid                   [creds] [executeOnce] [retry]
// TeamMessage                        code
// TellTheTeam                        executeWorkflow
// AlreadySetUp                       noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// HireConfirmed
//    → FetchTheEmployee
//      → ReadTheHire
//        → SeenBefore
//          → NewHire
//            → BuildTheChecklist
//              → SaveTheTask
//                → BookFirstDayWelcome
//                  → ScheduleTheWelcomeEmail
//                    → TeamMessage
//                      → TellTheTeam
//           .out(1) → AlreadySetUp
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'People · New hire onboarding',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class PeopleNewHireOnboardingWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '83ae19e9-d3a2-435b-abae-ccca80e2d98c',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## People · New hire onboarding
When someone is hired, creates their checklist, books their first-week meetings, tells the people who need to act, and sends the welcome email on the right morning.

**Platforms:** BambooHR, Supabase, Google Calendar, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/operations\``,
    };

    @node({
        id: '8113f1d6-a5f3-49f6-ae85-f81d6ba7f5b2',
        webhookId: '44ca58c7-e7c5-4bbd-a832-5923bf9dfcda',
        name: 'Hire confirmed',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    HireConfirmed = {
        httpMethod: 'POST',
        path: 'hire-confirmed',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '1df97c2a-f2ba-4be0-a209-7820c30f4841',
        name: 'Fetch the employee',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        credentials: { bambooHrApi: { id: '__CRED:bamboohr__', name: 'BambooHR' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    FetchTheEmployee = {
        method: 'GET',
        url: "={{ 'https://api.bamboohr.com/api/gateway.php/acme/v1/employees/' + $json.body.id }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'bambooHrApi',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Accept',
                    value: "={{ 'application/json' }}",
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'fields',
                    value: "={{ 'firstName,lastName,workEmail,jobTitle,supervisorEmail,hireDate,location' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '1a62c906-18bd-447c-ac2f-9912c625a41d',
        name: 'Read the hire',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 180],
    })
    ReadTheHire = {
        jsCode: `const h = $input.first().json ?? {};
if (!h.workEmail || !h.hireDate) throw new Error("A hire needs a work email and a hire date in BambooHR");
return [{ json: { employee_id: String(h.id), email: String(h.workEmail).toLowerCase(), name: [h.firstName, h.lastName].filter(Boolean).join(" ") || "New hire", role: h.jobTitle ?? "", manager: h.supervisorEmail ?? null, start_date: h.hireDate, remote: /remote/i.test(h.location ?? ""), scope: "hire", key: String(h.id) } }];`,
    };

    @node({
        id: '65548fa8-317c-4ea7-a95f-d6b42eaa3634',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [780, 180],
    })
    SeenBefore = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:idempotency-guard__',
        },
        options: {},
    };

    @node({
        id: '7170f6de-c6ea-4cea-a13f-bc9d478fd1f7',
        name: 'New hire?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    NewHire = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'fc31d1b4-3200-4c6c-a4c2-071a88240df8',
                    leftValue: '={{ !$json.duplicate }}',
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
        id: '40b8a0dc-f966-4500-a35d-ffd255c93d5c',
        name: 'Build the checklist',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 90],
    })
    BuildTheChecklist = {
        jsCode: `const h = $input.first().json;
const day = (offset) => new Date(new Date(h.start_date).getTime() + offset * 864e5).toISOString().slice(0, 10);
const tasks = [
  { owner: "it", task: "Create accounts and order a laptop", due: day(-5) },
  { owner: "it", task: h.remote ? "Ship the laptop" : "Prepare a desk", due: day(-3) },
  { owner: "hr", task: "Send the contract and collect documents", due: day(-7) },
  { owner: "manager", task: "Write the 30-day plan", due: day(-1) },
  { owner: "manager", task: "First one-to-one", due: day(0) },
  { owner: "hr", task: "Day 30 check-in", due: day(30) },
];
return tasks.map((t) => ({ json: { ...t, employee_id: h.employee_id, employee: h.name, status: "open" } }));`,
    };

    @node({
        id: '00c9cf76-60fb-4b61-a133-14df519df8c2',
        name: 'Save the task',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1560, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SaveTheTask = {
        resource: 'row',
        operation: 'create',
        tableId: 'onboarding_tasks',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'owner',
                    fieldValue: '={{ $json.owner }}',
                },
                {
                    fieldId: 'task',
                    fieldValue: '={{ $json.task }}',
                },
                {
                    fieldId: 'due',
                    fieldValue: '={{ $json.due }}',
                },
                {
                    fieldId: 'employee_id',
                    fieldValue: '={{ $json.employee_id }}',
                },
                {
                    fieldId: 'employee',
                    fieldValue: '={{ $json.employee }}',
                },
                {
                    fieldId: 'status',
                    fieldValue: '={{ $json.status }}',
                },
            ],
        },
    };

    @node({
        id: 'dcae3ec7-e95d-47e4-adbc-f00f76c29366',
        name: 'Book first-day welcome',
        type: 'n8n-nodes-base.googleCalendar',
        version: 1.3,
        position: [1820, 180],
        credentials: { googleCalendarOAuth2Api: { id: '__CRED:googleCalendar__', name: 'Google Calendar' } },
        onError: 'continueRegularOutput',
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    BookFirstDayWelcome = {
        resource: 'event',
        operation: 'create',
        calendar: {
            __rl: true,
            mode: 'id',
            value: 'kim@example.com',
        },
        start: "={{ $('New hire?').first().json.start_date + 'T09:30:00' }}",
        end: "={{ $('New hire?').first().json.start_date + 'T10:00:00' }}",
        additionalFields: {
            summary: "={{ 'Welcome, ' + $('New hire?').first().json.name }}",
            attendees: [
                "={{ [$('New hire?').first().json.email, $('New hire?').first().json.manager].filter(Boolean).join(',') }}",
            ],
        },
    };

    @node({
        id: '6de40182-e2bc-4e5e-a6a3-53f294f5ebf2',
        name: 'Schedule the welcome email',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [2080, 180],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ScheduleTheWelcomeEmail = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ $('New hire?').first().json.email }}",
        dynamicTemplate: true,
        templateId: "={{ 'd-welcome-new-hire' }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'name',
                    value: "={{ $('New hire?').first().json.name }}",
                },
                {
                    key: 'role',
                    value: "={{ $('New hire?').first().json.role }}",
                },
            ],
        },
        additionalFields: {
            sendAt: "={{ $('New hire?').first().json.start_date + 'T08:00:00' }}",
        },
    };

    @node({
        id: '272112a1-ed06-441c-a9d3-18023bfc6f3e',
        name: 'Team message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2340, 180],
    })
    TeamMessage = {
        jsCode: `const h = $("New hire?").first().json;
return [{ json: { channel: "#people", level: "info", text: h.name + " (" + h.role + ") starts on " + h.start_date + ". Six onboarding tasks are assigned to IT, HR and their manager." } }];`,
    };

    @node({
        id: '5bec1bc9-bc60-400c-af8f-490bf7c8691a',
        name: 'Tell the team',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2600, 180],
    })
    TellTheTeam = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'e7aa6956-3546-4538-a9d7-551909492b49',
        name: 'Already set up',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    AlreadySetUp = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.HireConfirmed.out(0).to(this.FetchTheEmployee.in(0));
        this.FetchTheEmployee.out(0).to(this.ReadTheHire.in(0));
        this.ReadTheHire.out(0).to(this.SeenBefore.in(0));
        this.SeenBefore.out(0).to(this.NewHire.in(0));
        this.NewHire.out(0).to(this.BuildTheChecklist.in(0));
        this.NewHire.out(1).to(this.AlreadySetUp.in(0));
        this.BuildTheChecklist.out(0).to(this.SaveTheTask.in(0));
        this.SaveTheTask.out(0).to(this.BookFirstDayWelcome.in(0));
        this.BookFirstDayWelcome.out(0).to(this.ScheduleTheWelcomeEmail.in(0));
        this.ScheduleTheWelcomeEmail.out(0).to(this.TeamMessage.in(0));
        this.TeamMessage.out(0).to(this.TellTheTeam.in(0));
    }
}
