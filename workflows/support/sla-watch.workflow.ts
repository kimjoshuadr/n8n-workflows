import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Support · SLA breach watch
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Every10Minutes                     scheduleTrigger
// UnansweredTickets                  zendesk                    [creds] [alwaysOutput] [retry]
// MeasureAgainstTheSla               code
// RememberTheStage                   zendesk                    [creds] [retry]
// WriteTheAlert                      code
// RaiseIt                            executeWorkflow
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every10Minutes
//    → UnansweredTickets
//      → MeasureAgainstTheSla
//        → RememberTheStage
//          → WriteTheAlert
//            → RaiseIt
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Support · SLA breach watch',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SupportSlaBreachWatchWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '8e55ef17-50ee-4d1e-aa59-c30e465d9741',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Support · SLA breach watch
Every ten minutes, finds tickets about to miss their first-response time, warns the owner, and escalates the ones that already have. Each ticket is raised once per stage.

**Platforms:** Zendesk
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/support\``,
    };

    @node({
        id: '45ebb3a7-a119-4b2c-a7d7-b67ce3887cdd',
        name: 'Every 10 minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    Every10Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 10,
                },
            ],
        },
    };

    @node({
        id: '28a8502f-811b-413c-a123-00db8e8bff6e',
        name: 'Unanswered tickets',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [260, 90],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UnansweredTickets = {
        resource: 'ticket',
        operation: 'getAll',
        returnAll: true,
        options: {
            query: "={{ 'status:open' }}",
        },
    };

    @node({
        id: 'c8cab437-7298-4c7b-a1bd-266a9d1b14db',
        name: 'Measure against the SLA',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    MeasureAgainstTheSla = {
        jsCode: `const SLA = { urgent: 30, high: 120, normal: 480, low: 1440 }; // minutes to first response
const now = Date.now();
return $input.all().map((i) => i.json).filter((t) => t.id && t.created_at).map((t) => {
  const limit = SLA[t.priority] ?? SLA.normal;
  const waited = Math.floor((now - new Date(t.created_at).getTime()) / 60000);
  const stage = waited >= limit ? "breached" : waited >= limit * 0.75 ? "at_risk" : "ok";
  return { id: String(t.id), subject: t.subject, owner: t.owner ?? "unassigned", priority: t.priority ?? "normal", waited, limit, stage, last: (t.tags ?? []).includes("sla-breached") ? "breached" : (t.tags ?? []).includes("sla-at-risk") ? "at_risk" : "ok" };
}).filter((t) => t.stage !== "ok" && t.stage !== t.last).map((json) => ({ json }));`,
    };

    @node({
        id: 'bfcdbd2a-2e77-43ff-a71a-de33e60f8282',
        name: 'Remember the stage',
        type: 'n8n-nodes-base.zendesk',
        version: 1,
        position: [780, 90],
        credentials: { zendeskApi: { id: '__CRED:zendesk__', name: 'Zendesk' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RememberTheStage = {
        resource: 'ticket',
        operation: 'update',
        id: '={{ $json.id }}',
        updateFields: {
            tags: ["={{ $json.stage === 'breached' ? 'sla-breached' : 'sla-at-risk' }}"],
        },
    };

    @node({
        id: 'e07c273e-d6c5-47c7-a6ff-92ab0d12bd38',
        name: 'Write the alert',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1040, 90],
    })
    WriteTheAlert = {
        jsCode: `const before = $("Measure against the SLA").all();
return $input.all().map((_, i) => { const t = before[i].json; return { json: { channel: "#support", level: t.stage === "breached" ? "critical" : "warn", text: t.stage === "breached" ? "SLA missed: #" + t.id + " \\"" + t.subject + "\\" has waited " + t.waited + " min (limit " + t.limit + "). Owner: " + t.owner : "SLA at risk: #" + t.id + " has " + (t.limit - t.waited) + " min left. Owner: " + t.owner } }; });`,
    };

    @node({
        id: '5e506199-acaf-4276-acec-afff92ad22a3',
        name: 'Raise it',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1300, 90],
    })
    RaiseIt = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Every10Minutes.out(0).to(this.UnansweredTickets.in(0));
        this.UnansweredTickets.out(0).to(this.MeasureAgainstTheSla.in(0));
        this.MeasureAgainstTheSla.out(0).to(this.RememberTheStage.in(0));
        this.RememberTheStage.out(0).to(this.WriteTheAlert.in(0));
        this.WriteTheAlert.out(0).to(this.RaiseIt.in(0));
    }
}
