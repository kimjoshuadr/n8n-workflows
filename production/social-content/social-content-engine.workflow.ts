import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Social · News to social content engine
// Nodes   : 22  |  Connections: 22
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// SectionGenerateNews                stickyNote
// SectionGenerateResult              stickyNote
// SectionHumanInTheLoop              stickyNote
// SubmitForm                         formTrigger
// SwitchMediahouse                   switch
// Mediahouse1                        set
// Mediahouse2                        set
// Mediahouse3                        set
// StoreTemp                          set
// GetNews                            rssFeedRead                [retry]
// LimitOutput                        limit
// ForEachNews                        splitInBatches
// GenerateCaption                    googleGemini               [creds] [retry]
// GenerateImage                      googleGemini               [creds] [retry]
// IfValid                            if
// SendImage                          telegram                   [creds] [retry]
// SendCaption                        telegram                   [creds] [retry]
// WaitApproval                       telegram                   [creds]
// IfApproved                         if
// Timeout                            filter
// SendDone                           telegram                   [creds] [executeOnce] [retry]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// SubmitForm
//    → SwitchMediahouse
//      → Mediahouse1
//        → StoreTemp
//          → GetNews
//            → LimitOutput
//              → ForEachNews
//                → SendDone
//               .out(1) → GenerateCaption
//                  → GenerateImage
//                    → IfValid
//                      → SendImage
//                        → SendCaption
//                          → WaitApproval
//                            → IfApproved
//                              → ForEachNews (↩ loop)
//                             .out(1) → Timeout
//                                → GenerateCaption (↩ loop)
//                     .out(1) → GenerateCaption (↩ loop)
//     .out(1) → Mediahouse2
//        → StoreTemp (↩ loop)
//     .out(2) → Mediahouse3
//        → StoreTemp (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Social · News to social content engine',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class SocialNewsToSocialContentEngineWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '186adaeb-6b36-4e97-af9e-c2b637041d95',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -220],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Social · News to social content engine
A form request picks a media brand. The workflow applies that brand's voice, reads its news feed, and for each article drafts a caption and an image with Gemini, checks its own output, and sends the draft to the social manager on Telegram. Approved moves to the next article; rejected is drafted again.

**Platforms:** RSS, Gemini, Telegram
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/social-content\``,
    };

    @node({
        id: 'bcdbcc5e-7f2e-43da-ae01-731ce46b6773',
        name: 'Section: Generate news',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 0],
    })
    SectionGenerateNews = {
        width: 1680,
        height: 690,
        color: 4,
        content: '## 1. Generate news',
    };

    @node({
        id: '340b8057-3593-475e-aade-d95599e7663f',
        name: 'Section: Generate result',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 770],
    })
    SectionGenerateResult = {
        width: 1160,
        height: 510,
        color: 5,
        content: '## 2. Generate result',
    };

    @node({
        id: '72f8bca6-c8a6-4272-a266-92bd4cdd1ff0',
        name: 'Section: Human in the loop',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, 1360],
    })
    SectionHumanInTheLoop = {
        width: 1420,
        height: 330,
        color: 6,
        content: '## 3. Human in the loop',
    };

    @node({
        id: 'f98704ce-c695-4a62-a1c3-7d65ad8b777d',
        webhookId: '65ba7541-4516-470e-acc4-24a7a023f099',
        name: 'submit_form',
        type: 'n8n-nodes-base.formTrigger',
        version: 2.2,
        position: [0, 380],
    })
    SubmitForm = {
        formTitle: "Create social posts from today's news",
        formDescription: '',
        formFields: {
            values: [
                {
                    fieldLabel: 'Media house',
                    fieldType: 'dropdown',
                    fieldOptions: {
                        values: [
                            {
                                option: 'Northwind Daily',
                            },
                            {
                                option: 'Harbor Finance',
                            },
                            {
                                option: 'Circuit Weekly',
                            },
                        ],
                    },
                    requiredField: true,
                },
                {
                    fieldLabel: 'How many posts',
                    fieldType: 'number',
                    requiredField: true,
                },
            ],
        },
        options: {},
    };

    @node({
        id: '36f595ea-76db-4690-ab4c-46876498e45a',
        name: 'switch_mediahouse',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [260, 380],
    })
    SwitchMediahouse = {
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
                                id: '34928687-f776-45fc-afb3-dace7411984d',
                                leftValue: "={{ $json['Media house'] === 'Northwind Daily' }}",
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
                    outputKey: 'Northwind Daily',
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
                                id: 'f20ebd5b-6992-40bb-a180-308d94224b83',
                                leftValue: "={{ $json['Media house'] === 'Harbor Finance' }}",
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
                    outputKey: 'Harbor Finance',
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
                                id: 'f9facd36-e947-40dd-a18f-9db9e3298b03',
                                leftValue: "={{ $json['Media house'] === 'Circuit Weekly' }}",
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
                    outputKey: 'Circuit Weekly',
                },
            ],
        },
        options: {
            fallbackOutput: 'extra',
        },
    };

    @node({
        id: '25fc380c-513a-4a12-a591-34591517b983',
        name: 'mediahouse_1',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [520, 200],
    })
    Mediahouse1 = {
        assignments: {
            assignments: [
                {
                    id: '8f893945-06d5-419a-aa7a-c834b6cb91a9',
                    name: 'brand',
                    value: "={{ 'Northwind Daily' }}",
                    type: 'string',
                },
                {
                    id: '5815f0d2-8941-4e4d-afb3-9e4ae876dc68',
                    name: 'voice',
                    value: "={{ 'Plain, fast, general news. Short sentences. No slang.' }}",
                    type: 'string',
                },
                {
                    id: '4f68f05b-927d-461e-ab5f-70f64e0508e4',
                    name: 'look',
                    value: "={{ 'Bold editorial photo style, navy and white, headline space at the top.' }}",
                    type: 'string',
                },
                {
                    id: '22f8c9e8-09a5-4809-a36c-abbe83486e8e',
                    name: 'feed',
                    value: "={{ 'https://feeds.acme.example/northwind.xml' }}",
                    type: 'string',
                },
                {
                    id: '850c6c1e-9b41-4f88-ae15-d8be9f852bba',
                    name: 'tags',
                    value: "={{ '#news #daily' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '0bc46f97-8b3c-4712-abb5-5ee99f318ab6',
        name: 'mediahouse_2',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [520, 380],
    })
    Mediahouse2 = {
        assignments: {
            assignments: [
                {
                    id: 'b1619137-1c48-431c-aa9b-57f5d2c01da8',
                    name: 'brand',
                    value: "={{ 'Harbor Finance' }}",
                    type: 'string',
                },
                {
                    id: '8dccb5a5-9638-474a-a465-2f251e598c2e',
                    name: 'voice',
                    value: "={{ 'Measured and precise. Numbers first. Never hype.' }}",
                    type: 'string',
                },
                {
                    id: '09a42b32-8e8a-459d-a2b0-a91760d8658e',
                    name: 'look',
                    value: "={{ 'Clean chart-led graphic, dark green and cream.' }}",
                    type: 'string',
                },
                {
                    id: 'a7328110-c81e-47c7-aa1d-51b5caceabc2',
                    name: 'feed',
                    value: "={{ 'https://feeds.acme.example/harbor.xml' }}",
                    type: 'string',
                },
                {
                    id: '4ec5f641-0123-43ea-a9a4-a257dbf02d20',
                    name: 'tags',
                    value: "={{ '#markets #finance' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '10af6986-95e5-4756-a86b-00908aff0257',
        name: 'mediahouse_3',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [520, 560],
    })
    Mediahouse3 = {
        assignments: {
            assignments: [
                {
                    id: 'ef70f262-7280-40bf-a417-3c167dab96f0',
                    name: 'brand',
                    value: "={{ 'Circuit Weekly' }}",
                    type: 'string',
                },
                {
                    id: '09c8da81-2ad1-4de8-afd4-4b078e94045e',
                    name: 'voice',
                    value: "={{ 'Curious and a little playful. Explains the tech in one line.' }}",
                    type: 'string',
                },
                {
                    id: 'd8474b33-4802-4d88-aaaf-c0f7466b6cf9',
                    name: 'look',
                    value: "={{ 'Bright flat illustration, electric blue and orange.' }}",
                    type: 'string',
                },
                {
                    id: '853a6a61-e31c-4b06-a107-41090dc2e344',
                    name: 'feed',
                    value: "={{ 'https://feeds.acme.example/circuit.xml' }}",
                    type: 'string',
                },
                {
                    id: '789e64b4-e8e8-4a67-a310-27264a0dbd34',
                    name: 'tags',
                    value: "={{ '#tech #ai' }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '1f1c2c33-11c0-4e0c-afc0-decefcf7c390',
        name: 'store_temp',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [780, 380],
    })
    StoreTemp = {
        assignments: {
            assignments: [
                {
                    id: 'c5657148-7668-4e5e-a5bf-6e2922dc3f96',
                    name: 'brand',
                    value: '={{ $json.brand }}',
                    type: 'string',
                },
                {
                    id: 'a2035bef-f9a3-4aa1-a938-588d42e86d3e',
                    name: 'voice',
                    value: '={{ $json.voice }}',
                    type: 'string',
                },
                {
                    id: '7871d090-da5c-4dce-aae2-4e651c741367',
                    name: 'look',
                    value: '={{ $json.look }}',
                    type: 'string',
                },
                {
                    id: '7833454c-bb48-4b57-a4c9-2adcabc07bd0',
                    name: 'feed',
                    value: '={{ $json.feed }}',
                    type: 'string',
                },
                {
                    id: '61d48c15-87c6-4386-a1ae-6df243ab259a',
                    name: 'tags',
                    value: '={{ $json.tags }}',
                    type: 'string',
                },
                {
                    id: 'aee9e7a3-cf60-409f-aa66-037891393ebe',
                    name: 'max_posts',
                    value: "={{ Math.min(Math.max(Number($('submit_form').first().json['How many posts']) || 3, 1), 10) }}",
                    type: 'string',
                },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        id: '7573b204-92a2-4cb7-a431-237f1eed040f',
        name: 'get_news',
        type: 'n8n-nodes-base.rssFeedRead',
        version: 1.2,
        position: [1040, 380],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GetNews = {
        url: '={{ $json.feed }}',
        options: {},
    };

    @node({
        id: '940cbd06-b9dc-4212-a444-222c344fba09',
        name: 'limit_output',
        type: 'n8n-nodes-base.limit',
        version: 1,
        position: [1300, 380],
    })
    LimitOutput = {
        maxItems: "={{ Number($('store_temp').first().json.max_posts) }}",
        keep: 'firstItems',
    };

    @node({
        id: '56460eaf-ca1d-4671-a218-87be4e7cb9c2',
        name: 'for_each_news',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [0, 1060],
    })
    ForEachNews = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: '493a6b15-a772-4f8f-ae80-5d7e32d303b9',
        name: 'generate_caption',
        type: '@n8n/n8n-nodes-langchain.googleGemini',
        version: 1.2,
        position: [260, 970],
        credentials: { googlePalmApi: { id: '__CRED:gemini__', name: 'Gemini' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GenerateCaption = {
        resource: 'text',
        operation: 'message',
        modelId: {
            __rl: true,
            mode: 'id',
            value: 'models/gemini-2.5-flash',
        },
        messages: {
            values: [
                {
                    content:
                        "={{ 'Brand: ' + $('store_temp').first().json.brand + '\\nVoice: ' + $('store_temp').first().json.voice + '\\nHashtags: ' + $('store_temp').first().json.tags + '\\n\\nHeadline: ' + $('for_each_news').first().json.title + '\\nSummary: ' + String($('for_each_news').first().json.contentSnippet ?? '').slice(0, 1500) }}",
                    role: 'user',
                },
            ],
        },
        simplify: true,
        options: {
            systemMessage:
                "[task:social-caption] You write one social media caption for a media brand. Follow the brand voice you are given exactly. Under 600 characters, one idea, no invented facts, no quotation marks around the whole caption. End with the brand's hashtags. Reply with the caption only.",
        },
    };

    @node({
        id: 'a65b8f70-38c1-45c2-adca-3edd44fc1b6d',
        name: 'generate_image',
        type: '@n8n/n8n-nodes-langchain.googleGemini',
        version: 1.2,
        position: [520, 1060],
        credentials: { googlePalmApi: { id: '__CRED:gemini__', name: 'Gemini' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    GenerateImage = {
        resource: 'image',
        operation: 'generate',
        modelId: {
            __rl: true,
            mode: 'id',
            value: 'models/gemini-2.5-flash-image',
        },
        prompt: "={{ 'A social media graphic for the news story: ' + $('for_each_news').first().json.title + '. Style: ' + $('store_temp').first().json.look + ' No text in the image.' }}",
        options: {},
    };

    @node({
        id: 'c90f9b43-ebd2-4fe6-ae8a-e5d742d07236',
        name: 'if_valid',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 1060],
    })
    IfValid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: '1e26e4bd-a699-4975-a188-4c50829f8bac',
                    leftValue:
                        "={{ String($('generate_caption').first().json.content?.parts?.[0]?.text ?? '').trim().length > 0 && String($('generate_caption').first().json.content?.parts?.[0]?.text ?? '').trim().length <= 2200 && !/as an ai|i cannot|i can't/i.test(String($('generate_caption').first().json.content?.parts?.[0]?.text ?? '').trim()) && !!$binary.data }}",
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
        id: 'a939136a-58e3-47e0-a6a1-c68de226e29d',
        name: 'send_image',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [0, 1560],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendImage = {
        resource: 'message',
        operation: 'sendPhoto',
        chatId: "={{ '-1000000000001' }}",
        binaryData: true,
        binaryPropertyName: 'data',
        additionalFields: {},
    };

    @node({
        id: 'cd63fb16-e246-4859-a2a5-2f839c74c07d',
        name: 'send_caption',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [260, 1560],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendCaption = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ String($('generate_caption').first().json.content?.parts?.[0]?.text ?? '').trim() + '\\n\\n' + $('for_each_news').first().json.link }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    @node({
        id: 'e1ed837a-5f2b-4a95-af1b-23d3027f0577',
        webhookId: '3e17810e-858f-45e6-a571-b7b47fc5395e',
        name: 'wait_approval',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [520, 1560],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
    })
    WaitApproval = {
        resource: 'message',
        operation: 'sendAndWait',
        chatId: "={{ '-1000000000001' }}",
        message: "={{ 'Post this for ' + $('store_temp').first().json.brand + '?' }}",
        responseType: 'approval',
        approvalOptions: {
            values: {
                approvalType: 'double',
            },
        },
        options: {
            appendAttribution: false,
            limitWaitTime: {
                values: {
                    limitType: 'afterTimeInterval',
                    resumeAmount: 12,
                    resumeUnit: 'hours',
                },
            },
        },
    };

    @node({
        id: 'c14d00b5-876e-4827-a78a-2c9d88d8c4cc',
        name: 'if_approved',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 1560],
    })
    IfApproved = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c4f8c457-e818-4470-a18e-9d92817ca092',
                    leftValue: '={{ $json.data?.approved === true }}',
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
        id: '56a7a358-47c9-4cdc-aa1b-2eceb9b7e36a',
        name: 'timeout',
        type: 'n8n-nodes-base.filter',
        version: 2.2,
        position: [1040, 1560],
    })
    Timeout = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'a4c673be-8895-4f5b-a3ad-9b0e57615da4',
                    leftValue: '={{ $json.data?.approved === false }}',
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
        id: 'd8788666-d6ad-4896-a4f0-696b1be8d5b2',
        name: 'send_done',
        type: 'n8n-nodes-base.telegram',
        version: 1.2,
        position: [260, 1150],
        credentials: { telegramApi: { id: '__CRED:telegram__', name: 'Telegram' } },
        executeOnce: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    SendDone = {
        resource: 'message',
        operation: 'sendMessage',
        chatId: "={{ '-1000000000001' }}",
        text: "={{ 'Done. Every article in this batch for ' + $('store_temp').first().json.brand + ' has an approved post.' }}",
        additionalFields: {
            appendAttribution: false,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.SubmitForm.out(0).to(this.SwitchMediahouse.in(0));
        this.SwitchMediahouse.out(0).to(this.Mediahouse1.in(0));
        this.SwitchMediahouse.out(1).to(this.Mediahouse2.in(0));
        this.SwitchMediahouse.out(2).to(this.Mediahouse3.in(0));
        this.Mediahouse1.out(0).to(this.StoreTemp.in(0));
        this.Mediahouse2.out(0).to(this.StoreTemp.in(0));
        this.Mediahouse3.out(0).to(this.StoreTemp.in(0));
        this.StoreTemp.out(0).to(this.GetNews.in(0));
        this.GetNews.out(0).to(this.LimitOutput.in(0));
        this.LimitOutput.out(0).to(this.ForEachNews.in(0));
        this.ForEachNews.out(0).to(this.SendDone.in(0));
        this.ForEachNews.out(1).to(this.GenerateCaption.in(0));
        this.GenerateCaption.out(0).to(this.GenerateImage.in(0));
        this.GenerateImage.out(0).to(this.IfValid.in(0));
        this.IfValid.out(0).to(this.SendImage.in(0));
        this.IfValid.out(1).to(this.GenerateCaption.in(0));
        this.SendImage.out(0).to(this.SendCaption.in(0));
        this.SendCaption.out(0).to(this.WaitApproval.in(0));
        this.WaitApproval.out(0).to(this.IfApproved.in(0));
        this.IfApproved.out(0).to(this.ForEachNews.in(0));
        this.IfApproved.out(1).to(this.Timeout.in(0));
        this.Timeout.out(0).to(this.GenerateCaption.in(0));
    }
}
