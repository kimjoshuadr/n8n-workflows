import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CRM · Enrich new contacts
// Nodes   : 12  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// ContactCreated                     webhook
// ReadTheContact                     code
// WorkEmail                          if
// LookThemUp                         clearbit                   [onError→regular] [creds]
// FoundThem                          if
// OnlyTheBlanks                      code
// AnythingToAdd                      if
// UpdateTheContact                   httpRequest                [creds] [retry]
// PersonalEmailSkipped               noOp
// NothingNew                         noOp
// LookupFailedLeftAsIs               noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ContactCreated
//    → ReadTheContact
//      → WorkEmail
//        → LookThemUp
//          → FoundThem
//            → OnlyTheBlanks
//              → AnythingToAdd
//                → UpdateTheContact
//               .out(1) → NothingNew
//           .out(1) → LookupFailedLeftAsIs
//       .out(1) → PersonalEmailSkipped
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'CRM · Enrich new contacts',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CrmEnrichNewContactsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '30fef254-8f76-42e9-acc5-0d76042db995',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## CRM · Enrich new contacts
Fills in company, role and size for a new CRM contact from an enrichment service, and never overwrites what a person already typed.

**Platforms:** Clearbit, HubSpot
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/sales\``,
    };

    @node({
        id: '3157603e-4d9f-4d19-af2a-c2f353d08099',
        webhookId: '817978a7-f8ed-492b-a070-1ac935e4bef3',
        name: 'Contact created',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 180],
    })
    ContactCreated = {
        httpMethod: 'POST',
        path: 'contact-created',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: 'ef49795c-516c-46e2-a0be-03b0bf5aef5f',
        name: 'Read the contact',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 180],
    })
    ReadTheContact = {
        jsCode: `const c = $input.first().json.body ?? {};
const email = String(c.email ?? "").toLowerCase();
const free = /@(gmail|yahoo|hotmail|outlook|icloud|proton)\\./.test(email);
return [{ json: { id: String(c.id), email, existing: c.properties ?? {}, skip: !email || free } }];`,
    };

    @node({
        id: '4fcd0473-a51a-489c-a91d-1e9aae011743',
        name: 'Work email?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 180],
    })
    WorkEmail = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'b6052b14-eada-4cc4-a134-89a733ce0b36',
                    leftValue: '={{ !$json.skip }}',
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
        id: '8c8855ac-5b0a-4840-a801-55dc66fdaf02',
        name: 'Look them up',
        type: 'n8n-nodes-base.clearbit',
        version: 1,
        position: [780, 90],
        credentials: { clearbitApi: { id: '__CRED:clearbit__', name: 'Clearbit' } },
        onError: 'continueRegularOutput',
    })
    LookThemUp = {
        resource: 'person',
        operation: 'enrich',
        email: '={{ $json.email }}',
        additionalFields: {},
    };

    @node({
        id: 'd423b654-803a-4575-a37f-6ca3fb141bbb',
        name: 'Found them?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1040, 180],
    })
    FoundThem = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '6724cdbe-ebbc-4299-ac6d-5baba92784b6',
                    leftValue: '={{ !$json.error && !!$json.employment }}',
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
        id: 'e66297c5-d75d-4c87-ad60-7354d3b80d2c',
        name: 'Only the blanks',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1300, 90],
    })
    OnlyTheBlanks = {
        jsCode: `const c = $("Work email?").first().json;
const found = $input.first().json ?? {};
const candidate = { company: found.employment?.name, jobtitle: found.employment?.title, linkedin: found.linkedin?.handle ? "https://www.linkedin.com/" + found.linkedin.handle : null };
const updates = Object.fromEntries(Object.entries(candidate).filter(([k, v]) => v != null && v !== "" && !c.existing[k]));
return [{ json: { id: c.id, updates, changed: Object.keys(updates).length > 0 } }];`,
    };

    @node({
        id: '7dd1ef6d-3583-4c07-abca-9581957b5c5a',
        name: 'Anything to add?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1560, 180],
    })
    AnythingToAdd = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '4af24cfb-f0fe-4763-a94a-ec8b414de4f6',
                    leftValue: '={{ $json.changed }}',
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
        id: 'fe7d5277-3d60-4ffb-a1bb-5b0743428b71',
        name: 'Update the contact',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1820, 90],
        credentials: { hubspotAppToken: { id: '__CRED:hubspot__', name: 'HubSpot' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpdateTheContact = {
        method: 'PATCH',
        url: "={{ 'https://api.hubapi.com/crm/v3/objects/contacts/' + $json.id }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'hubspotAppToken',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ properties: $json.updates }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '32373b80-e9a8-4da9-ad66-3469fdd98232',
        name: 'Personal email, skipped',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [780, 270],
    })
    PersonalEmailSkipped = {};

    @node({
        id: 'cbe7d520-a5dd-4819-adcc-6a4a88c2572d',
        name: 'Nothing new',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1820, 270],
    })
    NothingNew = {};

    @node({
        id: '3452b43c-aa3b-4950-a9e6-f33aeb9f623f',
        name: 'Lookup failed, left as is',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1300, 270],
    })
    LookupFailedLeftAsIs = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ContactCreated.out(0).to(this.ReadTheContact.in(0));
        this.ReadTheContact.out(0).to(this.WorkEmail.in(0));
        this.WorkEmail.out(0).to(this.LookThemUp.in(0));
        this.WorkEmail.out(1).to(this.PersonalEmailSkipped.in(0));
        this.LookThemUp.out(0).to(this.FoundThem.in(0));
        this.FoundThem.out(0).to(this.OnlyTheBlanks.in(0));
        this.FoundThem.out(1).to(this.LookupFailedLeftAsIs.in(0));
        this.OnlyTheBlanks.out(0).to(this.AnythingToAdd.in(0));
        this.AnythingToAdd.out(0).to(this.UpdateTheContact.in(0));
        this.AnythingToAdd.out(1).to(this.NothingNew.in(0));
    }
}
