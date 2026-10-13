import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Monitoring · Backup verification
// Nodes   : 9  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// _0700Daily                         scheduleTrigger
// LatestBackup                       httpRequest                [onError→regular] [retry]
// JudgeIt                            code
// RecordTheCheck                     httpRequest                [onError→regular] [retry]
// Healthy                            if
// ProblemMessage                     code
// Alert                              executeWorkflow
// AllGood                            noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// _0700Daily
//    → LatestBackup
//      → JudgeIt
//        → RecordTheCheck
//          → Healthy
//            → AllGood
//           .out(1) → ProblemMessage
//              → Alert
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Monitoring · Backup verification',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class MonitoringBackupVerificationWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '54ef98a1-a6cf-4c04-a991-b88fce26e535',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Monitoring · Backup verification
Checks every morning that last night's backup exists, is recent and is not suspiciously small. A backup nobody checks is a hope, not a backup.

**Platforms:** none, this is logic only
**Settings:** BACKUP_API_KEY, BACKUP_BASE_URL, DB_API_KEY, DB_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/monitoring\``,
    };

    @node({
        id: 'd007aa63-704a-47a3-aa9d-0b700c3ee5a8',
        name: '07:00 daily',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
    })
    _0700Daily = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * *',
                },
            ],
        },
    };

    @node({
        id: '5f339966-959f-4f0a-a227-de22b1941b87',
        name: 'Latest backup',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 180],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LatestBackup = {
        method: 'GET',
        url: '={{ $env.BACKUP_BASE_URL }}/backups/latest',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.BACKUP_API_KEY }}",
                },
            ],
        },
    };

    @node({
        id: '5c2c7251-15f2-4c2b-a44a-90d626ad57f2',
        name: 'Judge it',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 180],
    })
    JudgeIt = {
        jsCode: `const b = $input.first().json;
const problems = [];
if (!b || b.error || !b.created_at) problems.push("no backup could be found");
else {
  const hours = (Date.now() - new Date(b.created_at).getTime()) / 36e5;
  if (hours > 26) problems.push("the newest backup is " + Math.round(hours) + " hours old");
  if (b.status && b.status !== "completed") problems.push("its status is " + b.status);
  if (b.previous_size_bytes && b.size_bytes < b.previous_size_bytes * 0.7) problems.push("it is " + Math.round((1 - b.size_bytes / b.previous_size_bytes) * 100) + "% smaller than the one before");
  if (!b.size_bytes) problems.push("it is empty");
}
return [{ json: { ok: problems.length === 0, problems, size_mb: b?.size_bytes ? Math.round(b.size_bytes / 1048576) : null, created_at: b?.created_at ?? null } }];`,
    };

    @node({
        id: '0041fe8d-71ce-41b5-a6b5-d8191398cc3f',
        name: 'Record the check',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [780, 180],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    RecordTheCheck = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/backup_checks',
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
            '={{ JSON.stringify({ ok: $json.ok, problems: $json.problems, size_mb: $json.size_mb, at: $now.toISO() }) }}',
    };

    @node({
        id: '5f142642-a0b0-4e32-ab76-cec30b3474b5',
        name: 'Healthy?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    Healthy = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '713f6750-ad2d-47a4-aae7-bde38ef1070b',
                    leftValue: "={{ $('Judge it').first().json.ok }}",
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
        id: '159934da-6978-44d6-aa83-559f35ebfa5a',
        name: 'Problem message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 90],
    })
    ProblemMessage = {
        jsCode: 'return [{ json: { level: "critical", text: "Backup check failed: " + $("Judge it").first().json.problems.join("; ") + "." } }];',
    };

    @node({
        id: '75c2aee0-bc43-4937-a984-edd41e74d3f2',
        name: 'Alert',
        type: 'n8n-nodes-base.executeWorkflow',
        version: 1.1,
        position: [1560, 180],
    })
    Alert = {
        workflowId: {
            __rl: true,
            mode: 'id',
            value: '__WF:notify__',
        },
        options: {},
    };

    @node({
        id: 'cacf1624-b0bc-44a2-afb7-aa87114c3d1f',
        name: 'All good',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    AllGood = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this._0700Daily.out(0).to(this.LatestBackup.in(0));
        this.LatestBackup.out(0).to(this.JudgeIt.in(0));
        this.JudgeIt.out(0).to(this.RecordTheCheck.in(0));
        this.RecordTheCheck.out(0).to(this.Healthy.in(0));
        this.Healthy.out(0).to(this.AllGood.in(0));
        this.Healthy.out(1).to(this.ProblemMessage.in(0));
        this.ProblemMessage.out(0).to(this.Alert.in(0));
    }
}
