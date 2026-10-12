import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CRM · Meeting notes and next steps
// Nodes   : 16  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// TranscriptReady                    webhook
// ReadTheTranscript                  code
// EnoughToSummarise                  if
// Extract                            httpRequest                [retry]
// ReadTheNotes                       code
// Readable                           if
// AddTheCrmNote                      httpRequest                [retry]
// OneItemPerAction                   code
// HasAnOwner                         if
// CreateTheTask                      httpRequest                [retry]
// UnownedMessage                     code
// AskWhoOwnsThem                     executeWorkflow
// UnreadableMessage                  code
// FlagForAManualRead                 executeWorkflow
// TooShortToSummarise                noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TranscriptReady
//    → ReadTheTranscript
//      → EnoughToSummarise
//        → Extract
//          → ReadTheNotes
//            → Readable
//              → AddTheCrmNote
//                → OneItemPerAction
//                  → HasAnOwner
//                    → CreateTheTask
//                   .out(1) → UnownedMessage
//                      → AskWhoOwnsThem
//             .out(1) → UnreadableMessage
//                → FlagForAManualRead
//       .out(1) → TooShortToSummarise
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'CRM · Meeting notes and next steps',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CrmMeetingNotesAndNextStepsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'd9c05372-4544-44d9-a9cc-9c718f98e3ff',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-40, -390],
    })
    AboutThisWorkflow = {
        width: 620,
        height: 220,
        content: `## CRM · Meeting notes and next steps
Turns a call transcript into a CRM note and dated follow-up tasks, and asks a person when it cannot tell who owns a task.

**Needs:** CRM_API_KEY, CRM_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/sales\``,
    };

    @node({
        id: '89d5d99b-d1a8-4be2-acb3-2a0c5160c8f2',
        webhookId: '55e84f32-124e-485e-a0ac-1f0e24ded91a',
        name: 'Transcript ready',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    TranscriptReady = {
        httpMethod: 'POST',
        path: 'transcript-ready',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '4ed514a7-68d5-4a4e-aba2-eb3705ee0a9b',
        name: 'Read the transcript',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 0],
    })
    ReadTheTranscript = {
        jsCode: `const b = $input.first().json.body ?? {};
const text = String(b.transcript ?? "");
return [{ json: { deal_id: String(b.deal_id ?? ""), title: b.title ?? "Call", transcript: text.slice(0, 24000), too_short: text.split(/\\s+/).length < 40 } }];`,
    };

    @node({
        id: '38b511b8-9151-4494-afdb-05daa8bbed60',
        name: 'Enough to summarise?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [480, 0],
    })
    EnoughToSummarise = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c983206a-777b-4b15-abc2-569539a8b8f4',
                    leftValue: '={{ !$json.too_short }}',
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
        id: 'b7667011-3f07-4670-a9b3-91645c7912fa',
        name: 'Extract',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [720, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Extract = {
        method: 'POST',
        url: '={{ $env.LLM_BASE_URL }}/chat/completions',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.LLM_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{ JSON.stringify({
  model: $env.LLM_MODEL,
  temperature: 0.2,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "[task:meeting-notes] From this call transcript reply with JSON: { summary: string (max 120 words), decisions: string[], actions: [{ task: string, owner: string|null, due: 'YYYY-MM-DD'|null }] }. Only include what was actually said." },
    { role: "user", content: $json.transcript }
  ]
}) }}`,
    };

    @node({
        id: 'a31fe1e3-10bc-4f72-a5ab-0a5bd295c83a',
        name: 'Read the notes',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [960, 0],
    })
    ReadTheNotes = {
        jsCode: `const before = $("Read the transcript").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"summary":"","decisions":[],"actions":[]};
  let parse_error = false;
  try {
    reply = JSON.parse(item.json.choices[0].message.content);
  } catch (e) {
    parse_error = true;
  }
  out.push({ json: { ...(before[i]?.json ?? {}), ...reply, parse_error } });
}
return out;`,
    };

    @node({
        id: '60ceff31-c889-4a0c-af71-0b80b800d015',
        name: 'Readable?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1200, 0],
    })
    Readable = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '79f7e742-64c9-4856-a8e4-9766e817be53',
                    leftValue: '={{ !$json.parse_error && $json.summary.length > 0 }}',
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
        id: 'd39c264b-f7d0-43a8-a2e1-01ab7848ca1c',
        name: 'Add the CRM note',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1440, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    AddTheCrmNote = {
        method: 'POST',
        url: '={{ $env.CRM_BASE_URL }}/crm/v3/objects/notes',
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
            "={{ JSON.stringify({ deal_id: $json.deal_id, body: $json.summary + '\\n\\nDecisions:\\n' + ($json.decisions ?? []).map(d => '- ' + d).join('\\n') }) }}",
    };

    @node({
        id: '349fdf55-f0a1-4531-a182-fcc3961c229d',
        name: 'One item per action',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1680, -90],
    })
    OneItemPerAction = {
        jsCode: `const n = $("Readable?").first().json;
return (n.actions ?? []).filter((a) => a && a.task).map((a) => ({ json: { deal_id: n.deal_id, task: a.task, owner: a.owner ?? null, due: a.due ?? null } }));`,
    };

    @node({
        id: 'f0d17471-7e3f-4050-a0b2-0fa9abdfacc6',
        name: 'Has an owner?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1920, 0],
    })
    HasAnOwner = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '379fd8a5-a6bf-48db-a1fe-e6fa6cc70941',
                    leftValue: '={{ !!$json.owner }}',
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
        id: '755e768e-965a-4deb-a5ff-f00904cf9125',
        name: 'Create the task',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2160, -90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CreateTheTask = {
        method: 'POST',
        url: '={{ $env.CRM_BASE_URL }}/crm/v3/objects/tasks',
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
            '={{ JSON.stringify({ deal_id: $json.deal_id, subject: $json.task, owner: $json.owner, due: $json.due }) }}',
    };

    @node({
        id: 'ac3c0469-71fd-410e-ae46-f48a618093f7',
        name: 'Unowned message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2160, 90],
    })
    UnownedMessage = {
        jsCode: 'return [{ json: { level: "warn", text: $input.all().length + " action(s) from the call have no clear owner: " + $input.all().map((i) => i.json.task).join("; ") } }];',
    };

    @node({
        id: 'fc89948a-14d3-421d-abb9-e40604311a8d',
        name: 'Ask who owns them',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2400, 0],
    })
    AskWhoOwnsThem = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '6061f6ba-43ec-4201-a4ce-aadc9ed24909',
        name: 'Unreadable message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1440, 90],
    })
    UnreadableMessage = {
        jsCode: 'return [{ json: { level: "warn", text: "Notes could not be extracted from \\"" + $("Read the transcript").first().json.title + "\\". The transcript is attached to the deal for a manual read." } }];',
    };

    @node({
        id: '3ef2c099-2440-4a09-aa9b-d9cb64bcd115',
        name: 'Flag for a manual read',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1680, 90],
    })
    FlagForAManualRead = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: '379a765f-8821-40df-a491-92e8e494382f',
        name: 'Too short to summarise',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [720, 90],
    })
    TooShortToSummarise = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TranscriptReady.out(0).to(this.ReadTheTranscript.in(0));
        this.ReadTheTranscript.out(0).to(this.EnoughToSummarise.in(0));
        this.EnoughToSummarise.out(0).to(this.Extract.in(0));
        this.EnoughToSummarise.out(1).to(this.TooShortToSummarise.in(0));
        this.Extract.out(0).to(this.ReadTheNotes.in(0));
        this.ReadTheNotes.out(0).to(this.Readable.in(0));
        this.Readable.out(0).to(this.AddTheCrmNote.in(0));
        this.Readable.out(1).to(this.UnreadableMessage.in(0));
        this.AddTheCrmNote.out(0).to(this.OneItemPerAction.in(0));
        this.OneItemPerAction.out(0).to(this.HasAnOwner.in(0));
        this.HasAnOwner.out(0).to(this.CreateTheTask.in(0));
        this.HasAnOwner.out(1).to(this.UnownedMessage.in(0));
        this.UnreadableMessage.out(0).to(this.FlagForAManualRead.in(0));
        this.UnownedMessage.out(0).to(this.AskWhoOwnsThem.in(0));
    }
}
