import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Ops digest · Weekly summary
// Nodes   : 13  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Monday0830                         scheduleTrigger
// Leads                              supabase                   [onError→regular] [creds] [alwaysOutput] [retry]
// Orders                             supabase                   [onError→regular] [creds] [alwaysOutput] [executeOnce] [retry]
// Support                            supabase                   [onError→regular] [creds] [alwaysOutput] [executeOnce] [retry]
// SiteTraffic                        httpRequest                [onError→regular] [creds] [alwaysOutput] [executeOnce] [retry]
// WorkOutTheWeek                     code
// WriteTheSummary                    agent                      [AI] [onError→regular]
// WriteTheSummaryClaude              lmChatAnthropic            [creds] [ai_languageModel]
// Compose                            code
// PostToTheChannel                   slack                      [onError→regular] [creds] [retry]
// EmailTheOwner                      sendGrid                   [creds] [retry]
// CheckIn                            supabase                   [onError→regular] [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Monday0830
//    → Leads
//      → Orders
//        → Support
//          → SiteTraffic
//            → WorkOutTheWeek
//              → WriteTheSummary
//                → Compose
//                  → PostToTheChannel
//                    → EmailTheOwner
//                      → CheckIn
//
// AI CONNECTIONS
// WriteTheSummary.uses({ ai_languageModel: WriteTheSummaryClaude })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Ops digest · Weekly summary',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class OpsDigestWeeklySummaryWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '6ab9d680-e485-4f91-a487-84a6c16fd33e',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Ops digest · Weekly summary
Every Monday, gathers the week's numbers from sales, orders, support and the site, compares them with the week before, and sends one readable summary.

**Platforms:** Supabase, PostHog, Claude, Slack, SendGrid
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`systems/ops-digest\``,
    };

    @node({
        id: 'b2cbae22-9d4c-4f91-af96-2bae0e3600f4',
        name: 'Monday 08:30',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 220],
    })
    Monday0830 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '30 8 * * 1',
                },
            ],
        },
    };

    @node({
        id: '53f3aaa9-f418-4aa7-a424-a53ff11e08c4',
        name: 'Leads',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Leads = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'leads',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'received_at',
                    condition: 'gte',
                    keyValue: '={{ $now.minus({ days: 14 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '90762edf-a548-48b3-a5c2-564f1f34cd20',
        name: 'Orders',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Orders = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'orders',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'created_at',
                    condition: 'gte',
                    keyValue: '={{ $now.minus({ days: 14 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '0ddb7501-5085-40cf-a518-95b7e31fab71',
        name: 'Support',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [780, 220],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Support = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'support_log',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'at',
                    condition: 'gte',
                    keyValue: '={{ $now.minus({ days: 14 }).toISO() }}',
                },
            ],
        },
    };

    @node({
        id: 'c10bcb57-446e-42ae-a90b-ab78d94dac30',
        name: 'Site traffic',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 220],
        credentials: { postHogApi: { id: '__CRED:posthog__', name: 'PostHog' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SiteTraffic = {
        method: 'GET',
        url: "={{ 'https://app.posthog.com/api/projects/@current/insights/trend/' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'postHogApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'events',
                    value: '={{ \'[{"id":"$pageview"}]\' }}',
                },
                {
                    name: 'date_from',
                    value: "={{ '-14d' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '635da5aa-34a8-4aef-a80a-d70b0f2abecc',
        name: 'Work out the week',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 220],
    })
    WorkOutTheWeek = {
        jsCode: `const weekAgo = Date.now() - 7 * 864e5;
const rows = (name) => { try { return $(name).all().map((i) => i.json).filter((r) => r && !r.error); } catch (e) { return null; } };
const split = (list, field) => {
  const cur = list.filter((r) => new Date(r[field]).getTime() >= weekAgo);
  return [cur, list.filter((r) => new Date(r[field]).getTime() < weekAgo)];
};
const change = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null);
const metric = (label, now, before, unit = "") => ({ label, now, before, change: change(now, before), unit });
const out = [];
const unavailable = [];

const leads = rows("Leads")?.filter((r) => r.received_at);
if (leads) { const [c, p] = split(leads, "received_at"); out.push(metric("New leads", c.length, p.length)); out.push(metric("Qualified leads", c.filter((l) => l.fit === true).length, p.filter((l) => l.fit === true).length)); } else unavailable.push("leads");

const orders = rows("Orders")?.filter((r) => r.created_at);
if (orders) { const [c, p] = split(orders, "created_at"); const sum = (l) => Math.round(l.reduce((s, o) => s + Number(o.total ?? 0), 0)); out.push(metric("Orders", c.length, p.length)); out.push(metric("Revenue", sum(c), sum(p))); } else unavailable.push("orders");

const support = rows("Support")?.filter((r) => r.at);
if (support) { const [c, p] = split(support, "at"); const rate = (l) => (l.length ? Math.round((l.filter((s) => s.answered).length / l.length) * 100) : 0); out.push(metric("Support conversations", c.length, p.length)); out.push(metric("Answered by the agent", rate(c), rate(p), "%")); } else unavailable.push("support");

const traffic = $("Site traffic").first()?.json?.result?.[0]?.data;
if (Array.isArray(traffic) && traffic.length >= 14) { const s = (a) => a.reduce((x, y) => x + y, 0); out.push(metric("Site visits", s(traffic.slice(-7)), s(traffic.slice(-14, -7)))); } else unavailable.push("site traffic");

const lines = out.map((m) => m.label + ": " + m.now + m.unit + (m.change === null ? "" : " (" + (m.change >= 0 ? "+" : "") + m.change + "% on last week)"));
return [{ json: { metrics: out, unavailable, table: lines.join("\\n"), week_of: new Date(weekAgo).toISOString().slice(0, 10) } }];`,
    };

    @node({
        id: 'b2f0ee23-8279-4608-ac96-f15e51b2cf10',
        name: 'Write the summary',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [1560, 90],
        onError: 'continueRegularOutput',
    })
    WriteTheSummary = {
        promptType: 'define',
        text: "={{ $json.table + ($json.unavailable.length ? '\\nUnavailable this week: ' + $json.unavailable.join(', ') : '') }}",
        hasOutputParser: false,
        options: {
            systemMessage:
                "[task:summarise] Write a four-sentence summary of this week's numbers for a business owner. Say what moved most and what deserves attention. Use only the numbers given. Do not invent causes.",
            maxIterations: 2,
        },
    };

    @node({
        id: 'f21b350b-142b-4211-a12a-d9a7f29a3280',
        name: 'Write the summary · Claude',
        type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        version: 1.3,
        position: [1560, 310],
        credentials: { anthropicApi: { id: '__CRED:anthropic__', name: 'Claude' } },
    })
    WriteTheSummaryClaude = {
        model: {
            __rl: true,
            mode: 'id',
            value: 'claude-sonnet-4-5',
        },
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: '99be993a-d78a-4dcf-a48f-4a5405f08564',
        name: 'Compose',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1820, 220],
    })
    Compose = {
        jsCode: `const w = $("Work out the week").first().json;
const summary = $input.first().json.output ?? "(The written summary is unavailable this week. The numbers are below.)";
const note = w.unavailable.length ? "\\n\\nNot included, because the source did not answer: " + w.unavailable.join(", ") + "." : "";
return [{ json: { subject: "Week of " + w.week_of, text: summary + "\\n\\n" + w.table + note } }];`,
    };

    @node({
        id: '0043e746-634d-4b10-ad1a-0762ad46d5e4',
        name: 'Post to the channel',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [2080, 220],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostToTheChannel = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#weekly' }}",
        },
        text: "={{ '*' + $json.subject + '*\\n' + $json.text }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '3dc25152-556c-4195-a8f4-3cf8314a708e',
        name: 'Email the owner',
        type: 'n8n-nodes-base.sendGrid',
        version: 1,
        position: [2340, 220],
        credentials: { sendGridApi: { id: '__CRED:sendgrid__', name: 'SendGrid' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    EmailTheOwner = {
        resource: 'mail',
        operation: 'send',
        fromEmail: "={{ 'hello@example.com' }}",
        fromName: "={{ 'Acme' }}",
        toEmail: "={{ 'owner@example.com' }}",
        subject: "={{ $('Compose').first().json.subject }}",
        dynamicTemplate: false,
        contentType: 'text/plain',
        contentValue: "={{ $('Compose').first().json.text }}",
        additionalFields: {},
    };

    @node({
        id: '986b4855-5540-4b83-aa75-8c9939ef8d1f',
        name: 'Check in',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [2600, 220],
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
                    keyValue: "={{ 'weekly-digest' }}",
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
        this.Monday0830.out(0).to(this.Leads.in(0));
        this.Leads.out(0).to(this.Orders.in(0));
        this.Orders.out(0).to(this.Support.in(0));
        this.Support.out(0).to(this.SiteTraffic.in(0));
        this.SiteTraffic.out(0).to(this.WorkOutTheWeek.in(0));
        this.WorkOutTheWeek.out(0).to(this.WriteTheSummary.in(0));
        this.WriteTheSummary.out(0).to(this.Compose.in(0));
        this.Compose.out(0).to(this.PostToTheChannel.in(0));
        this.PostToTheChannel.out(0).to(this.EmailTheOwner.in(0));
        this.EmailTheOwner.out(0).to(this.CheckIn.in(0));

        this.WriteTheSummary.uses({
            ai_languageModel: this.WriteTheSummaryClaude.output,
        });
    }
}
