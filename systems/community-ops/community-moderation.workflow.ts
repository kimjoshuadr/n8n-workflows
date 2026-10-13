import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Community ops · Message moderation
// Nodes   : 13  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// MessagePosted                      webhook
// ReadTheMessage                     code
// JudgeIt                            httpRequest                [onError→regular] [retry]
// ReadTheVerdict                     code
// WhatToDo                           switch
// DeleteTheMessage                   httpRequest                [retry]
// TimeTheAuthorOut                   httpRequest                [onError→regular] [retry]
// LogTheAction                       httpRequest                [retry]
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

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, DISCORD_API_KEY, DISCORD_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 270],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    JudgeIt = {
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
    { role: "system", content: "[task:moderate] You moderate a community server. Reply with JSON: { action: 'allow'|'review'|'remove', reason: string }. Remove only clear scams, phishing links and threats. Use review for insults and anything you are unsure about. Disagreement and criticism are allowed." },
    { role: "user", content: $json.content }
  ]
}) }}`,
    };

    @node({
        id: 'c79361ed-de8f-4c6a-a2d9-91fc2ee5f564',
        name: 'Read the verdict',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [780, 270],
    })
    ReadTheVerdict = {
        jsCode: `const before = $("Read the message").all();
const out = [];
for (const [i, item] of $input.all().entries()) {
  let reply = {"action":"review","reason":"The model was unavailable, so a person should look."};
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
        id: '2a9c7d7c-5aeb-4529-a878-b59740499487',
        name: 'What to do?',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1040, 270],
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
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1300, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    DeleteTheMessage = {
        method: 'POST',
        url: '={{ $env.DISCORD_BASE_URL }}/channels/messages/delete',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DISCORD_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ channel_id: $json.channel_id, message_id: $json.message_id }) }}',
    };

    @node({
        id: '6677c49a-18c8-444e-ace4-f2eb1aa9bd1b',
        name: 'Time the author out',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 270],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TimeTheAuthorOut = {
        method: 'POST',
        url: '={{ $env.DISCORD_BASE_URL }}/guilds/members/timeout',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.DISCORD_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ user_id: $('What to do?').first().json.user_id, minutes: 60 }) }}",
    };

    @node({
        id: '42eba279-1d64-4fc0-a50d-b8316047edf6',
        name: 'Log the action',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 270],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogTheAction = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/moderation_log',
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
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ message_id: $('What to do?').first().json.message_id, user_id: $('What to do?').first().json.user_id, action: 'removed', reason: $('What to do?').first().json.reason, content: $('What to do?').first().json.content, at: $now.toISO() }) }}",
    };

    @node({
        id: '6fd1f7c1-e801-4df2-a48c-41a1d530e9a1',
        name: 'Removed message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2080, 270],
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
        position: [1300, 270],
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
        position: [2340, 270],
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
        position: [1300, 450],
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
    }
}
