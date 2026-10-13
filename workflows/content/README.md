# Workflows · Content

4 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Content · Industry news digest

Each Friday, reads the feeds you follow, drops what was already sent, and emails a short digest of what is new.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/anthropic.svg" width="16" height="16" alt=""> Claude &nbsp;·&nbsp; <img src="../../assets/platforms/sendgrid.svg" width="16" height="16" alt=""> SendGrid
- **Nodes:** 13
- **Calls:** `error-handler`
- **Files:** [`feed-digest.json`](feed-digest.json) · [`feed-digest.workflow.ts`](feed-digest.workflow.ts)

```mermaid
flowchart LR
  n18s4xj0(["Friday 15:00"])
  n1s8aw21["Feeds to read"]
  nsg4hoa[/"Fetch the feed"/]
  n45a4k4["Collect the items"]
  nt0lp7u["Already seen"]
  n1pfmd3d["Only the new ones"]
  nqlf16e{"Anything new?"}
  n108p84d["One row per item"]
  n1t8u3uw["Remember them"]
  nw95j6j[["Write the digest"]]
  n1ij4y24("Write the digest · Claude")
  n1fo2yuc["Send the digest"]
  nrfpjgn["Quiet week"]
  n18s4xj0 --> n1s8aw21
  n1s8aw21 --> nsg4hoa
  nsg4hoa --> n45a4k4
  n45a4k4 --> nt0lp7u
  nt0lp7u --> n1pfmd3d
  n1pfmd3d --> nqlf16e
  nqlf16e -->|yes| n108p84d
  n108p84d --> n1t8u3uw
  n1t8u3uw --> nw95j6j
  nw95j6j --> n1fo2yuc
  nqlf16e -->|no| nrfpjgn
  n1ij4y24 -.-> nw95j6j
```

**How it runs**

1. **It reads your feeds.** One dead feed does not stop the others.
2. **Seen once, sent once.** The links already sent are read from Supabase. Only the ones that are new go forward, and they are remembered before the digest is written.
3. **A digest, or the plain list.** If the model is down the raw list is sent instead of nothing.

**Tested behaviour**

- sends only items not seen before
- sends nothing in a quiet week
- sends the plain list when the model is down

## SEO · Broken link check

Every Sunday night, visits each page in the sitemap list and reports the ones that no longer load, with the status each returned.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 7
- **Calls:** `error-handler`
- **Files:** [`broken-link-check.json`](broken-link-check.json) · [`broken-link-check.workflow.ts`](broken-link-check.workflow.ts)

```mermaid
flowchart LR
  n1269xrk(["Sunday 23:00"])
  n1igvk6e["Pages to check"]
  naz6rju[/"Visit the page"/]
  n1nt6bm1["Find the broken ones"]
  n5t9cun{"Any broken?"}
  n11hjev5["Report them"]
  ne7wg2o["Save the run"]
  n1269xrk --> n1igvk6e
  n1igvk6e --> naz6rju
  naz6rju --> n1nt6bm1
  n1nt6bm1 --> n5t9cun
  n5t9cun -->|yes| n11hjev5
  n11hjev5 --> ne7wg2o
  n5t9cun -->|no| ne7wg2o
```

**How it runs**

1. **Every page, once a week.** Each page is requested once. A page that errors is a result, not a crash.
2. **Broken means 4xx, 5xx or no answer.** Each broken page is listed with the status it returned.
3. **Reported, and the run is saved.** A clean week posts nothing, but the run is still recorded so the trend is there.

**Tested behaviour**

- reports a page that returns an error
- a clean site posts nothing and records the run

## SEO · Keyword rank tracker

Records where the site ranks for each tracked keyword every day, and alerts when one falls five places or drops off the first page.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/serpapi.svg" width="16" height="16" alt=""> SerpAPI
- **Nodes:** 10
- **Calls:** `notify`, `error-handler`
- **Files:** [`rank-tracker.json`](rank-tracker.json) · [`rank-tracker.workflow.ts`](rank-tracker.workflow.ts)

```mermaid
flowchart LR
  n1tsktpj(["05:00 daily"])
  n6lznd3["Tracked keywords"]
  n16h3wk3[/"Search for it"/]
  ny403el["Find our position"]
  n613mw8{"Got a result?"}
  n1a40jtl["Record today"]
  n1h9sgqy["Update the keyword"]
  ntvwxmf["Gather the drops"]
  n4d13md[["Alert"]]
  n1ji63nt["Search failed, keep yesterday"]
  n1tsktpj --> n6lznd3
  n6lznd3 --> n16h3wk3
  n16h3wk3 --> ny403el
  ny403el --> n613mw8
  n613mw8 -->|yes| n1a40jtl
  n1a40jtl --> n1h9sgqy
  n1h9sgqy --> ntvwxmf
  ntvwxmf --> n4d13md
  n613mw8 -->|no| n1ji63nt
```

**How it runs**

1. **One search per keyword.** The top thirty results are fetched for each.
2. **Where are we?.** A failed search is not recorded as 'not ranking'. Yesterday's position is kept until a real answer arrives.
3. **History is kept.** Every day's position is stored, so the chart exists when someone asks for it.
4. **Drops are raised together.** Five places down, or off the first page. One message lists them all.

**Tested behaviour**

- records the position and alerts on a fall off page one
- a small move is recorded without an alert
- a failed search keeps yesterday's position

## Brand · Mention monitor

Checks hourly for new mentions of the brand, and raises the negative ones straight away with the text and the link.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/serpapi.svg" width="16" height="16" alt=""> SerpAPI &nbsp;·&nbsp; <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI
- **Nodes:** 14
- **Calls:** `notify`, `error-handler`
- **Files:** [`mention-monitor.json`](mention-monitor.json) · [`mention-monitor.workflow.ts`](mention-monitor.workflow.ts)

```mermaid
flowchart LR
  n1vk30ig(["Hourly"])
  n1dynvht[/"Search for mentions"/]
  nvoe1yz["One item per mention"]
  nt0lp7u["Already seen"]
  nnurvb["Keep the unseen"]
  n1675dzr["Remember it"]
  n13knbuk{"New mention?"}
  ng2ej44[["Read the tone"]]
  nld6z7q("Read the tone · GPT")
  n5ycsgs("Read the tone · shape")
  n1riexmv["Read the verdict"]
  ncon8ff{"Needs attention?"}
  nq77zl1["Write the alert"]
  n6wxc06[["Raise it"]]
  n1vk30ig --> n1dynvht
  n1dynvht --> nvoe1yz
  nvoe1yz --> nt0lp7u
  nt0lp7u --> nnurvb
  nnurvb --> n1675dzr
  n1675dzr --> n13knbuk
  n13knbuk --> ng2ej44
  ng2ej44 --> n1riexmv
  n1riexmv --> ncon8ff
  ncon8ff --> nq77zl1
  nq77zl1 --> n6wxc06
  nld6z7q -.-> ng2ej44
  n5ycsgs -.-> ng2ej44
```

**How it runs**

1. **New mentions, hourly.** The search overlaps the last run on purpose. Links already seen are read from Supabase and dropped, so overlap costs nothing.
2. **A model reads the tone.** A mention it could not read is treated as needing attention, not as fine.
3. **Negative ones are raised with the link.** Positive and neutral mentions are kept in Supabase and nobody is interrupted.

**Tested behaviour**

- raises a negative mention once
- a mention it cannot classify is raised too
