import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Scheduled count to chat
// Nodes   : 5  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _0800Daily                         scheduleTrigger
// YesterdaySRows                     supabase                   [creds] [alwaysOutput] [retry]
// Count                              code
// Post                               slack                      [creds] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _0800Daily
//    → YesterdaySRows
//      → Count
//        → Post
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Scheduled count to chat',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockScheduledCountToChatWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '81660216-8100-4465-aca1-8026477b7e5b',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Scheduled count to chat
Every morning, counts yesterday's rows in a table and posts the number.

**Platforms:** Supabase, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/schedule\``,
    };

    @node({
        id: 'e3a079bf-3467-4ff4-a55f-e6bf48dcb4b6',
        name: '08:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 90],
    })
    _0800Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 8 * * *',
                },
            ],
        },
    };

    @node({
        id: '1997818f-2761-44bf-aea2-849b68947fa4',
        name: "Yesterday's rows",
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 90],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    YesterdaySRows = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'form_submissions',
        returnAll: true,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'received_at',
                    condition: 'gte',
                    keyValue: "={{ $now.minus({ days: 1 }).startOf('day').toISO() }}",
                },
            ],
        },
    };

    @node({
        id: 'ff4da1f0-c67f-4736-ae48-cbdb52ea9148',
        name: 'Count',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    Count = {
        jsCode: 'return [{ json: { count: $input.all().filter((i) => i.json.id).length } }];',
    };

    @node({
        id: 'c876f823-9f4f-4f9e-a210-9199b3f869c5',
        name: 'Post',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [780, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    Post = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '#general' }}",
        },
        text: "={{ $json.count + ' form submissions since yesterday morning.' }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this._0800Daily.out(0).to(this.YesterdaySRows.in(0));
        this.YesterdaySRows.out(0).to(this.Count.in(0));
        this.Count.out(0).to(this.Post.in(0));
    }
}
