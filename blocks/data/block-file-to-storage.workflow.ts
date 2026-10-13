import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Save a remote file to storage
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// NameIt                             code
// ClaimTheName                       httpRequest                [alwaysOutput] [retry]
// NewFile                            if
// CopyToStorage                      httpRequest                [retry]
// AlreadyStored                      noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → NameIt
//      → ClaimTheName
//        → NewFile
//          → CopyToStorage
//         .out(1) → AlreadyStored
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Save a remote file to storage',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockSaveARemoteFileToStorageWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'f1f37d43-3aa5-4f07-a15c-f5375f74e1dd',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Block · Save a remote file to storage
Records a file under a name derived from its own address, so the same file fetched twice is stored once.

**Platforms:** none, this is logic only
**Settings:** DB_API_KEY, DB_BASE_URL, STORAGE_API_KEY, STORAGE_BASE_URL
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`blocks/data\``,
    };

    @node({
        id: '7365d2e3-10c4-48e3-a242-5679c55b636f',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 180],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '4a8806df-2c98-4674-a789-3ea70ce8acac',
        name: 'Name it',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    NameIt = {
        jsCode: `return $input.all().map((item) => {
  const url = String(item.json.url ?? "");
  let h = 0; for (const c of url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const ext = (/\\.([a-z0-9]{2,5})(?:\\?|$)/i.exec(url)?.[1] ?? "bin").toLowerCase();
  return { json: { url, key: "files/" + h.toString(16).padStart(8, "0") + "." + ext } };
});`,
    };

    @node({
        id: 'b72669aa-59b6-44de-a337-75fa7c6da333',
        name: 'Claim the name',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 180],
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimTheName = {
        method: 'POST',
        url: '={{ $env.DB_BASE_URL }}/stored_files',
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
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'key' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ key: $json.key, source: $json.url }) }}',
    };

    @node({
        id: 'e1db9b96-99b8-4460-a710-5f7abfb94805',
        name: 'New file?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
    })
    NewFile = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '2b30a432-0123-4d1f-ab19-cd595c413721',
                    leftValue: '={{ !!$json.key }}',
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
        id: '8ceaf464-815e-4fc6-ae54-2b3764a0e754',
        name: 'Copy to storage',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1040, 90],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CopyToStorage = {
        method: 'POST',
        url: '={{ $env.STORAGE_BASE_URL }}/copy',
        options: {
            timeout: 15000,
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "={{ 'Bearer ' + $env.STORAGE_API_KEY }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ source_url: $json.source, key: $json.key }) }}',
    };

    @node({
        id: '83f99df7-c607-4679-ac8a-392aeb49c2c6',
        name: 'Already stored',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 270],
    })
    AlreadyStored = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.NameIt.in(0));
        this.NameIt.out(0).to(this.ClaimTheName.in(0));
        this.ClaimTheName.out(0).to(this.NewFile.in(0));
        this.NewFile.out(0).to(this.CopyToStorage.in(0));
        this.NewFile.out(1).to(this.AlreadyStored.in(0));
    }
}
