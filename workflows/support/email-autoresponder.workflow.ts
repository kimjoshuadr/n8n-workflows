import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support · Inbox triage and first reply
// Nodes   : 13  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// EmailReceived                      gmailTrigger               [creds]
// ReadTheEmail                       code
// FromAPerson                        if
// ArchiveIt                          gmail                      [creds] [retry]
// WhatIsItAsking                     agent                      [AI] [onError→regular]
// WhatIsItAskingGpt                  lmChatOpenAi               [creds] [ai_languageModel]
// WhatIsItAskingShape                outputParserStructured     [ai_outputParser]
// ReadTheIntent                      code
// AFixedAnswerQuestion               if
// SendTheStandardReply               sendGrid                   [creds] [retry]
// LabelAsAnswered                    gmail                      [onError→regular] [creds] [retry]
// LeaveForAPerson                    zendesk                    [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// EmailReceived
//    → ReadTheEmail
//      → FromAPerson
//        → WhatIsItAsking
//          → ReadTheIntent
//            → AFixedAnswerQuestion
//              → SendTheStandardReply
//                → LabelAsAnswered
//             .out(1) → LeaveForAPerson
//       .out(1) → ArchiveIt
//
// AI CONNECTIONS
// WhatIsItAsking.uses({ ai_languageModel: WhatIsItAskingGpt, ai_outputParser: WhatIsItAskingShape })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Support · Inbox triage and first reply',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SupportInboxTriageAndFirstReplyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '39f6a91a-0e41-485a-a8f0-540fb093d5c7',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Support · Inbox triage and first reply
Sorts the shared inbox: answers the handful of questions that have a fixed answer, files newsletters and receipts, and leaves everything else for a person.

**Platforms:** Gmail, OpenAI, SendGrid, Zendesk
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/support\``,
    };

    @node({
        id: '3f7b9eab-f73c-4bae-a39a-5fb5bb509649',
        name: 'Email received',
        type: 'n8n-nodes-base.gmailTrigger',
        version: 1.2,
        position: [0, 310],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
    })
    EmailReceived = {
        pollTimes: {
            item: [
                {
                    mode: 'everyMinute',
                },
            ],
        },
        simple: true,
        filters: {
            readStatus: 'unread',
        },
    };

    @node({
        id: '3fffe216-4bbc-4ff0-ab69-6419df3bf306',
        name: 'Read the email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 310],
    })
    ReadTheEmail = {
        jsCode: `const m = $input.first().json ?? {};
const from = (/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/.exec(String(m.From ?? m.from ?? "").toLowerCase()) ?? [""])[0];
const auto = /no-?reply|mailer-daemon|notifications?@|newsletter/.test(from) || !!m.headers?.["auto-submitted"] || !!m.headers?.["list-unsubscribe"];
return [{ json: { id: String(m.id), from, subject: String(m.Subject ?? m.subject ?? ""), text: String(m.text ?? m.snippet ?? "").slice(0, 3000), auto } }];`,
    };

    @node({
        id: '881bc208-f9ee-4cd0-ae33-179c2b3f916c',
        name: 'From a person?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 310],
    })
    FromAPerson = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd04ba8d9-2748-4dd8-aa5a-affb78d49ee8',
                    leftValue: '={{ !$json.auto }}',
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
        id: '95e0eb93-a0f2-4785-a029-af48ba64748d',
        name: 'Archive it',
        type: 'n8n-nodes-base.gmail',
        version: 2.1,
        position: [880, 90],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ArchiveIt = {
        resource: 'message',
        operation: 'removeLabels',
        messageId: '={{ $json.id }}',
        labelIds: ['INBOX'],
    };

    @node({
        id: 'f16bc1e7-80cf-4fd6-a52f-2c1331b1a456',
        name: 'What is it asking?',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [880, 270],
        onError: 'continueRegularOutput',
    })
    WhatIsItAsking = {
        promptType: 'define',
        text: "={{ $json.subject + '\\n\\n' + $json.text }}",
        hasOutputParser: true,
        options: {
            systemMessage:
                "[task:classify-intent] Classify this email. Reply with JSON: { intent: 'opening_hours'|'pricing'|'reset_password'|'other', confident: boolean }. Use 'other' unless the email is plainly and only asking that one thing.",
            maxIterations: 2,
        },
    };

    @node({
        id: '541badc6-df20-4c07-ac51-1e9ac0e6199a',
        name: 'What is it asking? · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [780, 490],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    WhatIsItAskingGpt = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'gpt-4o-mini',
        },
        options: {
            temperature: 0,
        },
    };

    @node({
        id: 'd021447f-d76b-4b42-aea4-1972772b64ac',
        name: 'What is it asking? · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [980, 490],
    })
    WhatIsItAskingShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "intent": "other",
  "confident": false
}`,
    };

    @node({
        id: '76dd5537-8f50-436d-afee-cb0960475ee5',
        name: 'Read the intent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1240, 310],
    })
    ReadTheIntent = {
        jsCode: `const before = $("From a person?").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : {"intent":"other","confident":false}), parse_error: !ok } });
}
return out;`,
    };

    @node({
        id: '0dbffd99-c923-4469-a808-a283219c1739',
        name: 'A fixed-answer question?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1500, 310],
    })
    AFixedAnswerQuestion = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6bc90c78-4bd2-483e-a808-fa7d208ed0b7',
                    leftValue:
                        "={{ $json.confident === true && ['opening_hours', 'pricing', 'reset_password'].includes($json.intent) }}",
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
        id: 'cb18c537-3f8a-4656-adde-32ca7e1ea845',
        name: 'Send the standard reply',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [1760, 220],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendTheStandardReply = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: '={{ $json.from }}',
        dynamicTemplate: true,
        templateId: "={{ 'd-faq-' + $json.intent }}",
        dynamicTemplateFields: {
            fields: [
                {
                    key: 'subject',
                    value: '={{ $json.subject }}',
                },
            ],
        },
        additionalFields: {},
    };

    @node({
        id: '61936198-2dd8-47cb-aa85-04c3879a8f47',
        name: 'Label as answered',
        type: 'n8n-nodes-base.gmail',
        version: 2.1,
        position: [2020, 310],
        credentials: { gmailOAuth2: { id: '__CRED:gmail__', name: 'Gmail' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LabelAsAnswered = {
        resource: 'message',
        operation: 'addLabels',
        messageId: "={{ $('A fixed-answer question?').first().json.id }}",
        labelIds: ['Label_auto_answered'],
    };

    @node({
        id: 'd2ffd372-0eb1-4b45-aae4-858e0bf68533',
        name: 'Leave for a person',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [1760, 400],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LeaveForAPerson = {
        resource: 'ticket',
        operation: 'create',
        description: "={{ 'From ' + $json.from + ':\\n\\n' + $json.text }}",
        additionalFields: {
            subject: '={{ $json.subject }}',
            tags: ['from-email'],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.EmailReceived.out(0).to(this.ReadTheEmail.in(0));
        this.ReadTheEmail.out(0).to(this.FromAPerson.in(0));
        this.FromAPerson.out(0).to(this.WhatIsItAsking.in(0));
        this.FromAPerson.out(1).to(this.ArchiveIt.in(0));
        this.WhatIsItAsking.out(0).to(this.ReadTheIntent.in(0));
        this.ReadTheIntent.out(0).to(this.AFixedAnswerQuestion.in(0));
        this.AFixedAnswerQuestion.out(0).to(this.SendTheStandardReply.in(0));
        this.AFixedAnswerQuestion.out(1).to(this.LeaveForAPerson.in(0));
        this.SendTheStandardReply.out(0).to(this.LabelAsAnswered.in(0));

        this.WhatIsItAsking.uses({
            ai_languageModel: this.WhatIsItAskingGpt.output,
            ai_outputParser: this.WhatIsItAskingShape.output,
        });
    }
}
