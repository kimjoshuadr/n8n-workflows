import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Yesterday, in the business's time zone
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// Window                             code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → Window
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: "Block · Yesterday, in the business's time zone",
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockYesterdayInTheBusinessSTimeZoneWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'a5254f94-a7c1-4bea-a1ca-67e83033e36a',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Yesterday, in the business's time zone
Works out the start and end of 'yesterday' or 'last week' in a named time zone, which is where most reporting bugs come from.

**Platforms:** none, this is logic only
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: 'ecabe2a8-aa01-4d73-a0c9-4c24de4029b1',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '36c6925c-c358-4890-a608-46b34193941d',
        name: 'Window',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 90],
    })
    Window = {
        jsCode: `return $input.all().map((item) => {
  const { timezone = "UTC", period = "yesterday", at } = item.json;
  const now = at ? DateTime.fromISO(at, { zone: "utc" }).setZone(timezone) : DateTime.now().setZone(timezone);
  const start = period === "last_week" ? now.startOf("week").minus({ weeks: 1 }) : now.startOf("day").minus({ days: 1 });
  const end = period === "last_week" ? start.plus({ weeks: 1 }) : start.plus({ days: 1 });
  return { json: { ...item.json, from: start.toUTC().toISO(), to: end.toUTC().toISO(), label: start.toFormat("yyyy-LL-dd") } };
});`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.Window.in(0));
    }
}
