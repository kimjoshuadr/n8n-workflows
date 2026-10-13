import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Working hours gate
// Nodes   : 3  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// IsItWorkingHours                   code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → IsItWorkingHours
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Working hours gate',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockWorkingHoursGateWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '8ce2e84b-6c05-4db1-afe8-c1e33b483998',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Working hours gate
Tells a caller whether now is inside working hours in a given time zone, so messages to people wait for the morning.

**Platforms:** none, this is logic only
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/schedule\``,
    };

    @node({
        id: '5b99faa1-deb2-4fa1-ac27-cee2502a44ea',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '5e79154c-7c94-43ab-ad23-b7720503427a',
        name: 'Is it working hours?',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 90],
    })
    IsItWorkingHours = {
        jsCode: `return $input.all().map((item) => {
  const { timezone = "UTC", start = 9, end = 18, at } = item.json;
  const when = at ? new Date(at) : new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", hour: "numeric", hour12: false }).formatToParts(when).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const weekday = !["Sat", "Sun"].includes(parts.weekday);
  return { json: { ...item.json, local_hour: hour, weekday, open: weekday && hour >= start && hour < end } };
});`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.IsItWorkingHours.in(0));
    }
}
