import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Community · Onboarding and provisioning
// Nodes   : 34  |  Connections: 33
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionGetCheckoutDetails          stickyNote
// SectionDataManipulation            stickyNote
// SectionDatabaseUpdateAndInvitations stickyNote
// OnChargeSucceeded                  stripeTrigger              [creds]
// GetCheckoutSession                 httpRequest                [creds] [retry]
// GetLineItems                       httpRequest                [creds] [retry]
// SplitLineItems                     splitOut
// FilterCommunityProducts            filter
// SetCommunityAccess                 set
// FilterBotProducts                  filter
// SetBotAccess                       set
// MergeProducts                      merge
// AggregateProducts                  aggregate                  [alwaysOutput]
// SetBuyer                           set
// GetUser                            supabase                   [creds] [alwaysOutput] [retry]
// IfExistingUser                     if
// SetExistingUser                    set
// SetNewUser                         set
// MergeUser                          merge
// GenerateSecretCode                 crypto
// PrepareAccess                      code
// UpsertUser                         httpRequest                [creds] [retry]
// IfBotAccess                        if
// StoreSecretCode                    supabase                   [creds] [retry]
// IfCommunity                        if
// SetInvites                         set
// SplitInvites                       splitOut
// ForEachInvite                      splitInBatches
// SwitchTier                         switch
// InviteSkoolStandard                httpRequest                [creds] [retry]
// InviteSkoolPremium                 httpRequest                [creds] [retry]
// LogInvite                          supabase                   [creds] [retry]
// UpdateUserStatus                   supabase                   [creds] [alwaysOutput] [executeOnce] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OnChargeSucceeded
//    → GetCheckoutSession
//      → GetLineItems
//        → SplitLineItems
//          → FilterCommunityProducts
//            → SetCommunityAccess
//              → MergeProducts
//                → AggregateProducts
//                  → SetBuyer
//                    → GetUser
//                      → IfExistingUser
//                        → SetExistingUser
//                          → MergeUser
//                            → GenerateSecretCode
//                              → PrepareAccess
//                                → UpsertUser
//                                  → IfBotAccess
//                                    → StoreSecretCode
//                                  → IfCommunity
//                                    → SetInvites
//                                      → SplitInvites
//                                        → ForEachInvite
//                                          → UpdateUserStatus
//                                         .out(1) → SwitchTier
//                                            → InviteSkoolStandard
//                                              → LogInvite
//                                                → ForEachInvite (↩ loop)
//                                           .out(1) → InviteSkoolPremium
//                                              → LogInvite (↩ loop)
//                       .out(1) → SetNewUser
//                          → MergeUser.in(1) (↩ loop)
//          → FilterBotProducts
//            → SetBotAccess
//              → MergeProducts.in(1) (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Community · Onboarding and provisioning',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CommunityOnboardingAndProvisioningWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '5c8db0fd-1b30-44e8-a02e-c54d17712077',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Community · Onboarding and provisioning
When a Stripe charge succeeds, reads what was bought, creates or updates the buyer in Supabase, stores a secret code that the Discord bot exchanges for the right roles, and sends a Skool invitation for each community tier in the purchase.

**Platforms:** Stripe, Supabase, Skool
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/community-provisioning\``,
    };

    @node({
        id: 'c1adf2d2-45b7-4aec-af0e-5647a8a584f1',
        name: 'Section: Get checkout details',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionGetCheckoutDetails = {
        width: 2200,
        height: 510,
        color: 4,
        content: `## 1. Get checkout details
The charge is traced to its checkout and line items, and each line item is sorted into community tiers and bot access.`,
    };

    @node({
        id: '5aae1bc0-68ba-430d-a2d6-3d5d8492de10',
        name: 'Section: Data manipulation',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 590],
    })
    SectionDataManipulation = {
        width: 1940,
        height: 510,
        color: 5,
        content: `## 2. Data manipulation
New or returning buyer, a fresh secret code, and one record of what this purchase grants.`,
    };

    @node({
        id: '263a9591-9307-43d8-ae4b-9841d2dab2e3',
        name: 'Section: Database update and invitations',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1180],
    })
    SectionDatabaseUpdateAndInvitations = {
        width: 2200,
        height: 510,
        color: 6,
        content: `## 3. Database update and invitations
The user is saved, the Discord bot is given its code, and one Skool invitation goes out per tier.`,
    };

    @node({
        id: 'be2a4ec2-874f-44b3-a612-7073cfde0fc5',
        webhookId: 'fccb3b6a-d8fc-4e89-a416-e5f9fec9fa1d',
        name: 'on_charge_succeeded',
        type: 'n8n-nodes-base.stripeTrigger',
        version: 1,
        position: [0, 290],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
    })
    OnChargeSucceeded = {
        events: ['charge.succeeded'],
    };

    @node({
        id: 'bd75b240-86c9-4766-a2e8-2ebd1930c49c',
        name: 'get_checkout_session',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 290],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetCheckoutSession = {
        method: 'GET',
        url: "={{ 'https://api.stripe.com/v1/checkout/sessions' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'stripeApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'payment_intent',
                    value: '={{ $json.data.object.payment_intent }}',
                },
                {
                    name: 'limit',
                    value: "={{ '1' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '58834edf-5f35-404c-aee9-e42133d69a73',
        name: 'get_line_items',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [520, 290],
        credentials: { stripeApi: { id: '__CRED:stripe__', name: 'Stripe' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetLineItems = {
        method: 'GET',
        url: "={{ 'https://api.stripe.com/v1/checkout/sessions/' + $json.data[0].id + '/line_items' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'stripeApi',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'limit',
                    value: "={{ '100' }}",
                },
            ],
        },
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '9e22f363-9d8a-410d-ae1e-ef314c90ea3b',
        name: 'split_line_items',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [780, 290],
    })
    SplitLineItems = {
        fieldToSplitOut: 'data',
        options: {},
    };

    @node({
        id: '28555ad2-ff6a-40af-a760-47796cb19db5',
        name: 'filter_community_products',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 200],
    })
    FilterCommunityProducts = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'f6aa8e9c-84a4-4568-a871-b47ca5801dfa',
                    leftValue:
                        "={{ ['prod_community_standard', 'prod_community_premium'].includes($json.price?.product) }}",
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
        id: 'c40442a0-d484-4903-a655-085c988fa608',
        name: 'set_community_access',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1300, 200],
    })
    SetCommunityAccess = {
        assignments: {
            assignments: [
                {
                    id: '9580db84-32e2-4b80-a473-073e58f7c172',
                    name: 'kind',
                    value: "={{ 'community' }}",
                    type: 'string',
                },
                {
                    id: '6864c210-3387-4386-a77b-d1688222c5f7',
                    name: 'product',
                    value: '={{ $json.price.product }}',
                    type: 'string',
                },
                {
                    id: 'fbe5a23e-38e5-49f9-a100-519a01f98a74',
                    name: 'tier',
                    value: "={{ ({ prod_community_standard: { tier: 'standard', group: 'acme-members' }, prod_community_premium: { tier: 'premium', group: 'acme-inner-circle' } })[$json.price.product].tier }}",
                    type: 'string',
                },
                {
                    id: '8fba5694-f2a9-4ea0-ad0d-9319174c1398',
                    name: 'group',
                    value: "={{ ({ prod_community_standard: { tier: 'standard', group: 'acme-members' }, prod_community_premium: { tier: 'premium', group: 'acme-inner-circle' } })[$json.price.product].group }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'c140150b-5906-495c-aa16-38c4f17f7a50',
        name: 'filter_bot_products',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 380],
    })
    FilterBotProducts = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'bad3fbfc-3dde-4f99-adad-fe3537e55ae4',
                    leftValue: "={{ ['prod_bot_signals', 'prod_bot_pro'].includes($json.price?.product) }}",
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
        id: 'f0954f55-773f-4626-a606-1266c8fccd88',
        name: 'set_bot_access',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1300, 380],
    })
    SetBotAccess = {
        assignments: {
            assignments: [
                {
                    id: 'b88a3a01-c8cf-457b-a849-d23b60b9235d',
                    name: 'kind',
                    value: "={{ 'bot' }}",
                    type: 'string',
                },
                {
                    id: 'dbe071d0-fc3e-4cd7-a13b-a87ac26ecaf8',
                    name: 'product',
                    value: '={{ $json.price.product }}',
                    type: 'string',
                },
                {
                    id: '34bf5c64-e9dc-448c-a397-082560532963',
                    name: 'role',
                    value: "={{ ({ prod_bot_signals: 'signals', prod_bot_pro: 'pro-trader' })[$json.price.product] }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '3a8f6056-6340-471a-a546-f7da02e2ecb0',
        name: 'merge_products',
        type: 'n8n-nodes-base.merge',
        version: 3,
        position: [1560, 290],
    })
    MergeProducts = {};

    @node({
        id: '317fdf84-df26-4e3f-acc4-48be37aeaf76',
        name: 'aggregate_products',
        type: 'n8n-nodes-base.aggregate',
        version: 1,
        position: [1820, 290],
        alwaysOutputData: true,
    })
    AggregateProducts = {
        aggregate: 'aggregateAllItemData',
        destinationFieldName: 'items',
        include: 'allFields',
        options: {},
    };

    @node({
        id: 'f9f10e20-eb91-408e-a72e-3ac5eb68b825',
        name: 'set_buyer',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [0, 880],
    })
    SetBuyer = {
        assignments: {
            assignments: [
                {
                    id: '5220f8f2-f64d-4343-ab94-2dc27c5c61d1',
                    name: 'email',
                    value: "={{ String($('get_checkout_session').first().json.data[0].customer_details?.email ?? $('on_charge_succeeded').first().json.data.object.billing_details?.email ?? '').trim().toLowerCase() }}",
                    type: 'string',
                },
                {
                    id: '0455891a-a70f-44ed-a4aa-09d64598eaff',
                    name: 'name',
                    value: "={{ $('get_checkout_session').first().json.data[0].customer_details?.name ?? '' }}",
                    type: 'string',
                },
                {
                    id: '82f9424c-d218-4858-acbb-1a0e565b148d',
                    name: 'charge_id',
                    value: "={{ $('on_charge_succeeded').first().json.data.object.id }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'a58b81c8-1dcb-4cc6-a5fc-0be881222662',
        name: 'get_user',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [260, 880],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetUser = {
        resource: 'row',
        operation: 'getAll',
        tableId: 'users',
        returnAll: false,
        limit: 1,
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'email',
                    condition: 'eq',
                    keyValue: '={{ $json.email }}',
                },
            ],
        },
    };

    @node({
        id: '40567ce3-1305-45ed-a77d-cdc5354eda6e',
        name: 'if_existing_user',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [520, 880],
    })
    IfExistingUser = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '69093d54-4d1a-49d8-a67e-1dc9ab48fe61',
                    leftValue: '={{ !!$json.id }}',
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
        id: '22f52e27-7611-47e5-ad98-755ba1d121c6',
        name: 'set_existing_user',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 790],
    })
    SetExistingUser = {
        assignments: {
            assignments: [
                {
                    id: 'be892877-99f1-4a46-a55c-9515850b5281',
                    name: 'is_new',
                    value: '={{ false }}',
                    type: 'string',
                },
                {
                    id: '618d432d-0575-4b43-ac21-6470f2102209',
                    name: 'products',
                    value: "={{ String($json.products ?? '') }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '2d01d40e-45b1-46f6-a513-80acc465e82f',
        name: 'set_new_user',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 970],
    })
    SetNewUser = {
        assignments: {
            assignments: [
                {
                    id: '8095d9be-e34a-49dd-a7ed-4c5c4a4ce0e0',
                    name: 'is_new',
                    value: '={{ true }}',
                    type: 'string',
                },
                {
                    id: '52ff961b-85e0-46cd-a1e5-2c65159e156f',
                    name: 'products',
                    value: "={{ '' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '3755ecfd-6cc2-47b7-a646-4cd608eba32e',
        name: 'merge_user',
        type: 'n8n-nodes-base.merge',
        version: 3,
        position: [1040, 880],
    })
    MergeUser = {};

    @node({
        id: 'd01fe10c-0de8-4397-aee6-cd744445b546',
        name: 'generate_secret_code',
        type: 'n8n-nodes-base.crypto',
        version: 1,
        position: [1300, 880],
    })
    GenerateSecretCode = {
        action: 'generate',
        dataPropertyName: 'secret_code',
        encodingType: 'hex',
        stringLength: 32,
    };

    @node({
        id: '5cc9f721-5a94-427d-a656-a740facdc0f6',
        name: 'prepare_access',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1560, 880],
    })
    PrepareAccess = {
        jsCode: `const buyer = $("set_buyer").first().json;
const items = $("aggregate_products").first().json.items ?? [];
const user = $input.first().json;
const roles = [...new Set(items.filter((i) => i.kind === "bot").map((i) => i.role))];
const invites = items.filter((i) => i.kind === "community").map((i) => ({ email: buyer.email, tier: i.tier, group: i.group }));
const owned = new Set(String(user.products).split(",").filter(Boolean));
for (const i of items) owned.add(i.product);
return [{ json: { ...buyer, is_new: String(user.is_new) === "true", products: [...owned].sort().join(","), roles: roles.join(","), has_bot: roles.length > 0, invites, has_community: invites.length > 0, secret_code: user.secret_code } }];`,
    };

    @node({
        id: 'fe8d66a4-df8a-4851-a9df-bf4adf327b47',
        name: 'upsert_user',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [0, 1470],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpsertUser = {
        method: 'POST',
        url: "={{ 'https://acme.supabase.co/rest/v1/users' }}",
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'supabaseApi',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Prefer',
                    value: "={{ 'resolution=merge-duplicates,return=representation' }}",
                },
            ],
        },
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'on_conflict',
                    value: "={{ 'email' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ email: $json.email, name: $json.name, products: $json.products, last_charge_id: $json.charge_id }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '7e467c63-a0f8-486c-ab2e-e000408c5a7e',
        name: 'if_bot_access',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [260, 1380],
    })
    IfBotAccess = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '15c21d1c-fc06-4076-a99d-5b2d14c8c7fc',
                    leftValue: "={{ $('prepare_access').first().json.has_bot }}",
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
        id: '242ceea0-c294-480b-a179-f0a257c5f70f',
        name: 'store_secret_code',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [520, 1380],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    StoreSecretCode = {
        resource: 'row',
        operation: 'create',
        tableId: 'discord_access_codes',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'code',
                    fieldValue: "={{ $('prepare_access').first().json.secret_code }}",
                },
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('prepare_access').first().json.email }}",
                },
                {
                    fieldId: 'roles',
                    fieldValue: "={{ $('prepare_access').first().json.roles }}",
                },
                {
                    fieldId: 'charge_id',
                    fieldValue: "={{ $('prepare_access').first().json.charge_id }}",
                },
                {
                    fieldId: 'redeemed',
                    fieldValue: '={{ false }}',
                },
            ],
        },
    };

    @node({
        id: '62f54f46-59e4-48f3-a88b-45fa86dc0ed9',
        name: 'if_community',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [260, 1560],
    })
    IfCommunity = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '374147a4-3de6-4187-acc0-0e7c68b0c68c',
                    leftValue: "={{ $('prepare_access').first().json.has_community }}",
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
        id: '7afa5ba0-fa95-4929-a3fc-88960ea268c0',
        name: 'set_invites',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [520, 1560],
    })
    SetInvites = {
        assignments: {
            assignments: [
                {
                    id: 'cf4a8c31-dba6-4a75-a666-396bc1798861',
                    name: 'invites',
                    value: "={{ $('prepare_access').first().json.invites }}",
                    type: 'array',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: 'f3e0be38-3cd5-47af-a659-67f4fdc6497e',
        name: 'split_invites',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [780, 1470],
    })
    SplitInvites = {
        fieldToSplitOut: 'invites',
        options: {},
    };

    @node({
        id: '3bb50cf8-f41c-41ad-adaa-bf051722daf6',
        name: 'for_each_invite',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [1040, 1470],
    })
    ForEachInvite = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '28f3bbad-fbdb-4e8e-a5f4-66e97f3e36e2',
        name: 'switch_tier',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [1300, 1380],
    })
    SwitchTier = {
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
                                id: 'e4b4a6d4-8fc2-49fe-a7ed-649938616fa0',
                                leftValue: "={{ $json.tier === 'standard' }}",
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
                    outputKey: 'standard',
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
                                id: '76bf9c70-b4c2-4bd4-a7ef-7f84076da863',
                                leftValue: "={{ $json.tier === 'premium' }}",
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
                    outputKey: 'premium',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '4fe01705-96f8-4845-aaeb-6e8f5c4934a6',
        name: 'invite_skool_standard',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 1380],
        credentials: { httpHeaderAuth: { id: '__CRED:skool__', name: 'Skool API key' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    InviteSkoolStandard = {
        method: 'POST',
        url: "={{ 'https://api.skool.com/groups/' + $json.group + '/invites' }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ email: $json.email }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '9a4ad570-bfe3-47bb-ad61-ab6ebd5a44bc',
        name: 'invite_skool_premium',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1560, 1560],
        credentials: { httpHeaderAuth: { id: '__CRED:skool__', name: 'Skool API key' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    InviteSkoolPremium = {
        method: 'POST',
        url: "={{ 'https://api.skool.com/groups/' + $json.group + '/invites' }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ email: $json.email }) }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '559248c5-0d70-4835-a93e-b3d0b0e99cb7',
        name: 'log_invite',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1820, 1470],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    LogInvite = {
        resource: 'row',
        operation: 'create',
        tableId: 'community_invites',
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'email',
                    fieldValue: "={{ $('for_each_invite').first().json.email }}",
                },
                {
                    fieldId: 'tier',
                    fieldValue: "={{ $('for_each_invite').first().json.tier }}",
                },
                {
                    fieldId: 'group_name',
                    fieldValue: "={{ $('for_each_invite').first().json.group }}",
                },
                {
                    fieldId: 'invited_at',
                    fieldValue: '={{ $now.toISO() }}',
                },
            ],
        },
    };

    @node({
        id: '40831a4a-8783-41de-adbc-cc0929aea960',
        name: 'update_user_status',
        type: 'n8n-nodes-base.supabase',
        version: 1,
        position: [1300, 1560],
        credentials: { supabaseApi: { id: '__CRED:supabase__', name: 'Supabase' } },
        alwaysOutputData: true,
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    UpdateUserStatus = {
        resource: 'row',
        operation: 'update',
        tableId: 'users',
        filterType: 'manual',
        matchType: 'allFilters',
        filters: {
            conditions: [
                {
                    keyName: 'email',
                    condition: 'eq',
                    keyValue: "={{ $('prepare_access').first().json.email }}",
                },
            ],
        },
        dataToSend: 'defineBelow',
        fieldsUi: {
            fieldValues: [
                {
                    fieldId: 'invited_at',
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
        this.OnChargeSucceeded.out(0).to(this.GetCheckoutSession.in(0));
        this.GetCheckoutSession.out(0).to(this.GetLineItems.in(0));
        this.GetLineItems.out(0).to(this.SplitLineItems.in(0));
        this.SplitLineItems.out(0).to(this.FilterCommunityProducts.in(0));
        this.SplitLineItems.out(0).to(this.FilterBotProducts.in(0));
        this.FilterCommunityProducts.out(0).to(this.SetCommunityAccess.in(0));
        this.SetCommunityAccess.out(0).to(this.MergeProducts.in(0));
        this.FilterBotProducts.out(0).to(this.SetBotAccess.in(0));
        this.SetBotAccess.out(0).to(this.MergeProducts.in(1));
        this.MergeProducts.out(0).to(this.AggregateProducts.in(0));
        this.AggregateProducts.out(0).to(this.SetBuyer.in(0));
        this.SetBuyer.out(0).to(this.GetUser.in(0));
        this.GetUser.out(0).to(this.IfExistingUser.in(0));
        this.IfExistingUser.out(0).to(this.SetExistingUser.in(0));
        this.IfExistingUser.out(1).to(this.SetNewUser.in(0));
        this.SetExistingUser.out(0).to(this.MergeUser.in(0));
        this.SetNewUser.out(0).to(this.MergeUser.in(1));
        this.MergeUser.out(0).to(this.GenerateSecretCode.in(0));
        this.GenerateSecretCode.out(0).to(this.PrepareAccess.in(0));
        this.PrepareAccess.out(0).to(this.UpsertUser.in(0));
        this.UpsertUser.out(0).to(this.IfBotAccess.in(0));
        this.UpsertUser.out(0).to(this.IfCommunity.in(0));
        this.IfBotAccess.out(0).to(this.StoreSecretCode.in(0));
        this.IfCommunity.out(0).to(this.SetInvites.in(0));
        this.SetInvites.out(0).to(this.SplitInvites.in(0));
        this.SplitInvites.out(0).to(this.ForEachInvite.in(0));
        this.ForEachInvite.out(0).to(this.UpdateUserStatus.in(0));
        this.ForEachInvite.out(1).to(this.SwitchTier.in(0));
        this.SwitchTier.out(0).to(this.InviteSkoolStandard.in(0));
        this.SwitchTier.out(1).to(this.InviteSkoolPremium.in(0));
        this.InviteSkoolStandard.out(0).to(this.LogInvite.in(0));
        this.InviteSkoolPremium.out(0).to(this.LogInvite.in(0));
        this.LogInvite.out(0).to(this.ForEachInvite.in(0));
    }
}
