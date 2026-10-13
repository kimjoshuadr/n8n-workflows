import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Community ops · Message moderation
// Nodes   : 15  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// MessagePosted                      webhook
// ReadTheMessage                     code
// JudgeIt                            agent                      [AI] [onError→regular]
// JudgeItGpt                         lmChatOpenAi               [creds] [ai_languageModel]
// JudgeItShape                       outputParserStructured     [ai_outputParser]
// ReadTheVerdict                     code
// WhatToDo                           switch
// DeleteTheMessage                   discord                    [creds] [retry]
// TimeTheAuthorOut                   httpRequest                [onError→regular] [creds] [retry]
// LogTheAction                       supabase                   [creds] [retry]
// RemovedMessage                     code
// ReviewMessage                      code
// TellModerators                     executeWorkflow
// LeaveIt                            noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// MessagePosted
//    → ReadTheMessage
//      → JudgeIt
//        → ReadTheVerdict
//          → WhatToDo
//            → DeleteTheMessage
//              → TimeTheAuthorOut
//                → LogTheAction
//                  → RemovedMessage
//                    → TellModerators
//           .out(1) → ReviewMessage
//              → TellModerators (↩ loop)
//           .out(2) → LeaveIt
//
// AI CONNECTIONS
// JudgeIt.uses({ ai_languageModel: JudgeItGpt, ai_outputParser: JudgeItShape })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Community ops · Message moderation',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CommunityOpsMessageModerationWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '4ae7b133-d2e3-42a0-adda-0c5d6184399c',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Community ops · Message moderation
Checks each message, removes clear scams, sends borderline ones to moderators, and never removes anything when the model is unavailable.

**Platforms:** OpenAI, Discord, Supabase
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/community-ops\``,
    };

    @node({
        id: '33f2ea2b-1e10-4c10-a294-caf65a4127a1',
        webhookId: '42c0b335-8a60-43d0-ae21-bacba975d234',
        name: 'Message posted',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 270],
    })
    MessagePosted = {
        httpMethod: 'POST',
        path: 'message-posted',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '1b61e473-e7c9-426e-a31b-2b99e70f33ef',
        name: 'Read the message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 270],
    })
    ReadTheMessage = {
        jsCode: `const m = $input.first().json.body ?? {};
const roles = m.member?.roles ?? [];
if (m.author?.bot || roles.includes("moderator") || roles.includes("admin")) return [];
const content = String(m.content ?? "").trim();
if (!content) return [];
return [{ json: { message_id: String(m.id), channel_id: String(m.channel_id), user_id: String(m.author?.id), username: m.author?.username ?? "unknown", content: content.slice(0, 2000) } }];`,
    };

    @node({
        id: 'f207acb2-b765-4972-aaf0-3b903b66e2ba',
        name: 'Judge it',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [620, 140],
        onError: 'continueRegularOutput',
    })
    JudgeIt = {
        promptType: 'define',
        text: '={{ $json.content }}',
        hasOutputParser: true,
        options: {
            systemMessage:
                "[task:moderate] You moderate a community server. Reply with JSON: { action: 'allow'|'review'|'remove', reason: string }. Remove only clear scams, phishing links and threats. Use review for insults and anything you are unsure about. Disagreement and criticism are allowed.",
            maxIterations: 2,
        },
    };

    @node({
        id: '1eaf493c-5ccf-4d85-ab7b-965410461062',
        name: 'Judge it · GPT',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.2,
        position: [520, 360],
        credentials: { openAiApi: { id: '__CRED:openai__', name: 'OpenAI' } },
    })
    JudgeItGpt = {
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
        id: '720ca1dd-1af5-482f-af87-5825184e8430',
        name: 'Judge it · shape',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [720, 360],
    })
    JudgeItShape = {
        schemaType: 'fromJson',
        jsonSchemaExample: `{
  "action": "allow",
  "reason": "Why."
}`,
    };

    @node({
        id: 'c79361ed-de8f-4c6a-a2d9-91fc2ee5f564',
        name: 'Read the verdict',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [980, 270],
    })
    ReadTheVerdict = {
        jsCode: `const before = $("Read the message").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  const answer = item.json.output;
  const ok = answer && typeof answer === "object" && !Array.isArray(answer);
  out.push({ json: { ...(before[i]?.json ?? {}), ...(ok ? answer : {"action":"review","reason":"The model was unavailable, so a person should look."}), parse_error: !ok } });
}
return out;`,
    };

    @node({
        id: '2a9c7d7c-5aeb-4529-a878-b59740499487',
        name: 'What to do?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1240, 270],
    })
    WhatToDo = {
        rules: {
            values: [
                {
                    conditions: {
                        options: {
                            caseSensitive: true,
                            leftValue: '',
                            typeValidation: 'loose',
                            version: 2,
                        },
                        conditions: [
                            {
                                id: '95b7d632-94c2-427f-ab67-f8ffcd58fa6a',
                                leftValue: "={{ $json.action === 'remove' && !$json.parse_error }}",
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
                    renameOutput: true,
                    outputKey: 'remove',
                },
                {
                    conditions: {
                        options: {
                            caseSensitive: true,
                            leftValue: '',
                            typeValidation: 'loose',
                            version: 2,
                        },
                        conditions: [
                            {
                                id: '21dcef02-12cc-46f4-ad39-d844961aab82',
                                leftValue: "={{ $json.action === 'review' || $json.parse_error }}",
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
                    renameOutput: true,
                    outputKey: 'review',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '2cc4b682-85e5-4cf0-a678-272cd16265e0',
        name: 'Delete the message',
        type: 'n8n-nodes-base.discord',
        version: 2,
        position: [1500, 90],
        credentials: { discordBotApi: { id: '__CRED:discord__', name: 'Discord' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DeleteTheMessage = {
        authentication: 'botToken',
        resource: 'message',
        operation: 'deleteMessage',
        guildId: {
            __rl: true,
            mode: 'id',
            value: "={{ '100000000000000001' }}",
        },
        channelId: {
            __rl: true,
            mode: 'id',
            value: '={{ $json.channel_id }}',
        },
        messageId: '={{ $json.message_id }}',
    };

    @node({
        id: '6677c49a-18c8-444e-ace4-f2eb1aa9bd1b',
        name: 'Time the author out',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1760, 270],
        credentials: { discordBotApi: { id: '__CRED:discord__', name: 'Discord' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TimeTheAuthorOut = {
        method: 'PATCH',
        url: "={{ 'https://discord.com/api/v10/guilds/100000000000000001/members/' + $('What to do?').first().json.user_id }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'discordBotApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ communication_disabled_until: $now.plus({ minutes: 60 }).toISO() }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '42eba279-1d64-4fc0-a50d-b8316047edf6',
        name: 'Log the action',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2020, 270],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheAction = {
        resource: 'row',
        operation: 'create',
        tableId: 'moderation_log',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'message_id',
                    fieldValue: "={{ $('What to do?').first().json.message_id }}",
                },
                {
                    fieldId: 'user_id',
                    fieldValue: "={{ $('What to do?').first().json.user_id }}",
                },
                {
                    fieldId: 'action',
                    fieldValue: "={{ 'removed' }}",
                },
                {
                    fieldId: 'reason',
                    fieldValue: "={{ $('What to do?').first().json.reason }}",
                },
                {
                    fieldId: 'content',
                    fieldValue: "={{ $('What to do?').first().json.content }}",
                },
                {
                    fieldId: 'at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '6fd1f7c1-e801-4df2-a48c-41a1d530e9a1',
        name: 'Removed message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2280, 270],
    })
    RemovedMessage = {
        jsCode: `const m = $("What to do?").first().json;
return [{ json: { channel: "#mods", level: "info", text: "Removed a message from " + m.username + " and timed them out for an hour. Reason: " + m.reason } }];`,
    };

    @node({
        id: 'cfef1a6f-3e53-45ee-a625-667d79d8eff3',
        name: 'Review message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1500, 270],
    })
    ReviewMessage = {
        jsCode: `const m = $input.first().json;
return [{ json: { channel: "#mods", level: "warn", text: "Please look at a message from " + m.username + ": \\"" + m.content.slice(0, 200) + "\\". Reason: " + m.reason } }];`,
    };

    @node({
        id: 'c94baa18-48f5-4d99-a38b-de71b931f840',
        name: 'Tell moderators',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [2540, 270],
    })
    TellModerators = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'f36881e3-2c0c-41fe-a8e4-7cda9cadc893',
        name: 'Leave it',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1500, 450],
    })
    LeaveIt = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.MessagePosted.out(0).to(this.ReadTheMessage.in(0));
        this.ReadTheMessage.out(0).to(this.JudgeIt.in(0));
        this.JudgeIt.out(0).to(this.ReadTheVerdict.in(0));
        this.ReadTheVerdict.out(0).to(this.WhatToDo.in(0));
        this.WhatToDo.out(0).to(this.DeleteTheMessage.in(0));
        this.WhatToDo.out(1).to(this.ReviewMessage.in(0));
        this.WhatToDo.out(2).to(this.LeaveIt.in(0));
        this.DeleteTheMessage.out(0).to(this.TimeTheAuthorOut.in(0));
        this.TimeTheAuthorOut.out(0).to(this.LogTheAction.in(0));
        this.LogTheAction.out(0).to(this.RemovedMessage.in(0));
        this.RemovedMessage.out(0).to(this.TellModerators.in(0));
        this.ReviewMessage.out(0).to(this.TellModerators.in(0));

        this.JudgeIt.uses({
            ai_languageModel: this.JudgeItGpt.output,
            ai_outputParser: this.JudgeItShape.output,
        });
    }
}
