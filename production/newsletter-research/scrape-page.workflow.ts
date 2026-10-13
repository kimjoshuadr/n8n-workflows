import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Research · Scrape a page
// Nodes   : 4  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// WhenCalled                         executeWorkflowTrigger
// FetchPage                          httpRequest                [onError→regular]
// ExtractText                        code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenCalled
//    → FetchPage
//      → ExtractText
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Research · Scrape a page',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class ResearchScrapeAPageWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '4cb1c0a5-5e71-493a-aaac-a8a21e7d6899',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Research · Scrape a page
Called with a URL. Fetches the page and returns its readable text and the links in it. A page that fails to load comes back marked as failed instead of stopping the caller.

**Platforms:** none, this is logic only
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`production/newsletter-research\``,
    };

    @node({
        id: 'ea569b35-9908-4fa6-a121-f7582e990577',
        name: 'When called',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [0, 90],
    })
    WhenCalled = {
        inputSource: 'passthrough',
    };

    @node({
        id: '180697ca-8094-4625-a944-c8ee76e91b64',
        name: 'fetch_page',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [260, 90],
        onError: 'continueRegularOutput',
    })
    FetchPage = {
        method: 'GET',
        url: '={{ $json.url }}',
        options: {
            timeout: 15000,
        },
    };

    @node({
        id: '9150705b-ca6a-4b5f-a4c3-e25ba7f7ab86',
        name: 'extract_text',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 90],
    })
    ExtractText = {
        jsCode: `const asked = $("When called").all();
return $input.all().map((item, i) => {
  const url = asked[i]?.json.url ?? null;
  const html = typeof item.json.data === "string" ? item.json.data : "";
  if (!html) return { json: { url, ok: false, text: "", links: [], error: String(item.json.error?.message ?? item.json.error ?? "the page returned no HTML") } };
  const links = [...new Set([...html.matchAll(/href="(https?:\\/\\/[^"#]+)"/g)].map((m) => m[1]))].slice(0, 50);
  const text = html
    .replace(/<(script|style|nav|header|footer|aside|head)\\b[\\s\\S]*?<\\/\\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\\s+/g, " ")
    .trim();
  return { json: { url, ok: text.length > 0, text: text.slice(0, 20000), links } };
});`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenCalled.out(0).to(this.FetchPage.in(0));
        this.FetchPage.out(0).to(this.ExtractText.in(0));
    }
}
