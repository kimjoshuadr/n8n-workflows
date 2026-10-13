import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Block · Archive a Drive file once
// Nodes   : 6  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// NameIt                             code
// ClaimTheFile                       supabase                   [onError→out(1)] [creds] [retry]
// CopyToTheArchive                   googleDrive                [creds] [retry]
// AlreadyArchived                    noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → NameIt
//      → ClaimTheFile
//        → CopyToTheArchive
//       .out(1) → AlreadyArchived
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Block · Archive a Drive file once',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class BlockArchiveADriveFileOnceWorkflow {
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
        content: `## Block · Archive a Drive file once
Copies a Google Drive file into the archive folder under a dated name, and records it so the same file sent twice is archived once.

**Platforms:** Supabase, Google Drive
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
  const name = String(item.json.name ?? "file").replace(/[\\\\/:*?"<>|]+/g, "-").trim();
  return { json: { file_id: String(item.json.file_id ?? ""), key: "drive/" + item.json.file_id, archive_name: new Date().toISOString().slice(0, 10) + " " + name } };
});`,
    };

    @node({
        id: '141f8168-5d0e-4f7c-a3ad-f1a9f9680484',
        name: 'Claim the file',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 180],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    ClaimTheFile = {
        resource: 'row',
        operation: 'create',
        tableId: 'stored_files',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'key',
                    fieldValue: '={{ $json.key }}',
                },
                {
                    fieldId: 'source',
                    fieldValue: '={{ $json.file_id }}',
                },
            ],
        },
    };

    @node({
        id: '31b82eb1-88ca-4138-aed3-ad4b22b04b50',
        name: 'Copy to the archive',
        type: 'n8n-nodes-base.googleDrive',
        version: 3,
        position: [780, 90],
        credentials: { googleDriveOAuth2Api: { id: '__CRED:googleDrive__', name: 'Google Drive' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    CopyToTheArchive = {
        resource: 'file',
        operation: 'copy',
        fileId: {
            __rl: true,
            mode: 'id',
            value: "={{ $('Name it').item.json.file_id }}",
        },
        name: "={{ $('Name it').item.json.archive_name }}",
        sameFolder: false,
        driveId: {
            __rl: true,
            mode: 'list',
            value: 'My Drive',
        },
        folderId: {
            __rl: true,
            mode: 'id',
            value: 'archive-folder-id',
        },
        options: {},
    };

    @node({
        id: 'eea57e11-f1c9-46b9-a70d-d8441c8c30c9',
        name: 'Already archived',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 270],
    })
    AlreadyArchived = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.NameIt.in(0));
        this.NameIt.out(0).to(this.ClaimTheFile.in(0));
        this.ClaimTheFile.out(0).to(this.CopyToTheArchive.in(0));
        this.ClaimTheFile.out(1).to(this.AlreadyArchived.in(0));
    }
}
