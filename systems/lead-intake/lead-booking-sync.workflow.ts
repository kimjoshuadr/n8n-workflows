import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Lead intake · Booking sync
// Nodes   : 13  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// BookingCreated                     webhook
// ReadTheBooking                     code
// SeenBefore                         executeWorkflow
// NewBooking                         if
// MarkLeadBooked                     httpRequest                [alwaysOutput] [retry]
// KnownLead                          if
// OpenCrmDeal                        httpRequest                [retry]
// BookedMessage                      code
// TellSales                          executeWorkflow
// UnknownMessage                     code
// FlagIt                             executeWorkflow
// AlreadyHandled                     noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// BookingCreated
//    → ReadTheBooking
//      → SeenBefore
//        → NewBooking
//          → MarkLeadBooked
//            → KnownLead
//              → OpenCrmDeal
//                → BookedMessage
//                  → TellSales
//             .out(1) → UnknownMessage
//                → FlagIt
//         .out(1) → AlreadyHandled
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Lead intake · Booking sync',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class LeadIntakeBookingSyncWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '0f3410d9-ac39-4b6f-a612-0b7656ed8b5d',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Lead intake · Booking sync
When a call is booked, moves the lead forward everywhere at once: the lead record, the CRM deal and the sales channel.

**Platforms:** none, this is logic only
**Settings:** CRM_API_KEY, CRM_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/lead-intake\``,
    };

    @node({
        id: 'eb5c4352-6a48-4ebf-a77f-145bcb91c5a1',
        webhookId: 'd49bdb06-49d1-42c9-a8ca-322db50b2b75',
        name: 'Booking created',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    BookingCreated = {
        httpMethod: 'POST',
        path: 'booking-created',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '3b3c3936-85d6-4201-a037-354c8fd65b78',
        name: 'Read the booking',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheBooking = {
        jsCode: `const b = $input.first().json.body ?? {};
const p = b.payload ?? b;
const email = String(p.attendees?.[0]?.email ?? p.email ?? "").toLowerCase();
if (!email) throw new Error("Booking has no attendee email");
return [{ json: { email, starts_at: p.startTime ?? p.start_time, booking_id: String(p.uid ?? p.id), scope: "booking", key: String(p.uid ?? p.id) } }];`,
    };

    @node({
        id: '28f64dbc-4b63-438a-a19c-bf0f10c46640',
        name: 'Seen before?',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [520, 180],
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
        id: 'd101f8ed-5c3c-417e-a845-ff8bbdc29094',
        name: 'New booking?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
    })
    NewBooking = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '905ac9a6-715e-42ad-ad5e-66e5d287f613',
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
        id: '0857e053-49af-4f1b-a87f-19a8aedeb853',
        name: 'Mark lead booked',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 90],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    MarkLeadBooked = {
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
        jsonBody: "={{ JSON.stringify({ booked: true, status: 'booked', call_at: $json.starts_at }) }}",
    };

    @node({
        id: 'f67ef109-1e4f-4987-a57e-83259f3a24cd',
        name: 'Known lead?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1300, 180],
    })
    KnownLead = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '666d7309-0368-4e20-a1de-7a40c881a4e5',
                    leftValue: '={{ !!$json.email }}',
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
        id: 'f312fc35-ad53-4b12-a1e1-bb1bdbbf77a1',
        name: 'Open CRM deal',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    OpenCrmDeal = {
        method: 'POST',
        url: '={{ $env.CRM_BASE_URL }}/crm/v3/objects/deals',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.CRM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ properties: { dealname: 'Intro call: ' + $json.name, dealstage: 'appointmentscheduled', closedate: $json.call_at }, contact_email: $json.email }) }}",
    };

    @node({
        id: '1aac9ee7-5844-42fb-affb-c6dd52e52f0b',
        name: 'Booked message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 90],
    })
    BookedMessage = {
        jsCode: `const l = $("Known lead?").first().json;
return [{ json: { text: l.name + " booked a call for " + l.call_at + ".", level: "info" } }];`,
    };

    @node({
        id: '63d1eafa-c216-4878-a076-88d827d22cf7',
        name: 'Tell sales',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2080, 180],
    })
    TellSales = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'b799411b-9a9d-4f26-ac1a-c53ad0d89af4',
        name: 'Unknown message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 270],
    })
    UnknownMessage = {
        jsCode: 'return [{ json: { text: "A call was booked by " + $("New booking?").first().json.email + ", who is not in the leads table.", level: "warn" } }];',
    };

    @node({
        id: '53791f51-c7a4-42b9-a35f-b63ea06e0fb4',
        name: 'Flag it',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1820, 270],
    })
    FlagIt = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'b291f727-30fe-4fc6-ac3e-1cf644a1776e',
        name: 'Already handled',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 270],
    })
    AlreadyHandled = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.BookingCreated.out(0).to(this.ReadTheBooking.in(0));
        this.ReadTheBooking.out(0).to(this.SeenBefore.in(0));
        this.SeenBefore.out(0).to(this.NewBooking.in(0));
        this.NewBooking.out(0).to(this.MarkLeadBooked.in(0));
        this.NewBooking.out(1).to(this.AlreadyHandled.in(0));
        this.MarkLeadBooked.out(0).to(this.KnownLead.in(0));
        this.KnownLead.out(0).to(this.OpenCrmDeal.in(0));
        this.KnownLead.out(1).to(this.UnknownMessage.in(0));
        this.OpenCrmDeal.out(0).to(this.BookedMessage.in(0));
        this.BookedMessage.out(0).to(this.TellSales.in(0));
        this.UnknownMessage.out(0).to(this.FlagIt.in(0));
    }
}
