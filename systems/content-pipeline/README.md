# Content pipeline

**Topic to published article, with a person's approval in the middle.**

**The problem.** Publishing regularly needs research, drafting, review and sharing, and one of them always slips.

**What this does about it.** A researched draft is ready each morning. Nothing is published until a person approves it, and sharing follows by itself.

3 workflows, 11 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Content pipeline · Research and draft

Takes the next topic off the list, researches it, drafts the article, and asks a person to approve it. Nothing is published from here.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/serpapi.svg" width="16" height="16" alt=""> SerpAPI &nbsp;·&nbsp; <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI &nbsp;·&nbsp; <img src="../../assets/platforms/anthropic.svg" width="16" height="16" alt=""> Claude &nbsp;·&nbsp; <img src="../../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 17
- **Calls:** `error-handler`
- **Files:** [`content-draft.json`](content-draft.json) · [`content-draft.workflow.ts`](content-draft.workflow.ts)

```mermaid
flowchart LR
  njkudyd(["Weekdays 07:00"])
  n1s0dx61["Next topic"]
  nsqkm2s{"Is there one?"}
  n1twx045["Claim the topic"]
  n1y58p8i[/"Research"/]
  nsbkp8b["Collect sources"]
  n1wxltmj[["Outline"]]
  nrxu5bx("Outline · GPT")
  n19u6mr("Outline · shape")
  n13epnow["Read the outline"]
  n11h8q5a{"Usable outline?"}
  nq8z416[["Write the draft"]]
  n15u3fjx("Write the draft · Claude")
  nqrrbjq["Save the draft"]
  nk0wy08["Ask for approval"]
  n1dhughj["Return the topic"]
  n11tw0rx["Queue is empty"]
  njkudyd --> n1s0dx61
  n1s0dx61 --> nsqkm2s
  nsqkm2s -->|yes| n1twx045
  n1twx045 --> n1y58p8i
  n1y58p8i --> nsbkp8b
  nsbkp8b --> n1wxltmj
  n1wxltmj --> n13epnow
  n13epnow --> n11h8q5a
  n11h8q5a -->|yes| nq8z416
  nq8z416 --> nqrrbjq
  nqrrbjq --> nk0wy08
  nsqkm2s -->|no| n11tw0rx
  n11h8q5a -->|no| n1dhughj
  nrxu5bx -.-> n1wxltmj
  n19u6mr -.-> n1wxltmj
  n15u3fjx -.-> nq8z416
```

**How it runs**

1. **One topic a day.** The next queued topic is claimed, so two runs can never draft the same one.
2. **Research before writing.** A search gathers sources. The model is told to use only what is in them.
3. **Outline, then a check.** A thin or unreadable outline sends the topic back for a better brief instead of producing a weak article.
4. **The draft is written and saved.** It is stored as awaiting approval, with its sources.
5. **A person decides.** The content channel gets approve and reject buttons. Publishing is a separate workflow that only a person can start.

**Tested behaviour**

- drafts the queued topic and asks for approval
- does nothing when the queue is empty
- a thin outline sends the topic back

## Content pipeline · Approve and publish

Receives a person's decision on a draft. Approved drafts are published to the CMS once and queued for sharing; rejected ones go back with the reason.

- **Starts from:** Webhook
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/wordpress.svg" width="16" height="16" alt=""> WordPress
- **Nodes:** 13
- **Calls:** `error-handler`
- **Files:** [`content-approval.json`](content-approval.json) · [`content-approval.workflow.ts`](content-approval.workflow.ts)

```mermaid
flowchart LR
  ne9uvpf(["Decision"])
  nmemhf2["Read the decision"]
  n2xqlyi{"Valid?"}
  nmff94d(["Bad request"])
  n293tr3["Load the draft"]
  n1n0t10v{"Awaiting approval?"}
  n1012if7(["Not pending"])
  n1dst0kh{"Approved?"}
  n1en492k["Publish to WordPress"]
  nl86jia["Mark published"]
  nybv44n(["Published"])
  n18u9pka["Mark rejected"]
  n1tvvf6t(["Rejected"])
  ne9uvpf --> nmemhf2
  nmemhf2 --> n2xqlyi
  n2xqlyi -->|yes| n293tr3
  n293tr3 --> n1n0t10v
  n1n0t10v -->|yes| n1dst0kh
  n1dst0kh -->|yes| n1en492k
  n1en492k --> nl86jia
  nl86jia --> nybv44n
  n2xqlyi -->|no| nmff94d
  n1n0t10v -->|no| n1012if7
  n1dst0kh -->|no| n18u9pka
  n18u9pka --> n1tvvf6t
```

**How it runs**

1. **A person presses a button.** Approve or reject, with who decided.
2. **The draft must still be pending.** A second click, or a click on an old message, gets a 409 and publishes nothing.
3. **Approved: published once.** The article goes to the CMS and the draft records who approved it and when.
4. **Rejected: kept with the reason.** Nothing is deleted, so the reason is there for the next attempt.

**Tested behaviour**

- approval publishes and records who approved
- rejection publishes nothing and keeps the reason
- approving twice publishes once
- an unknown draft is refused
- a malformed decision is a 400

## Content pipeline · Share what was published

Every hour, writes a post per network for anything newly published and schedules it. One network failing does not stop the others.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI &nbsp;·&nbsp; <img src="../../assets/platforms/linkedin.svg" width="16" height="16" alt=""> LinkedIn &nbsp;·&nbsp; <img src="../../assets/platforms/x.svg" width="16" height="16" alt=""> X &nbsp;·&nbsp; <img src="../../assets/platforms/facebook.svg" width="16" height="16" alt=""> Facebook
- **Nodes:** 14
- **Calls:** `error-handler`
- **Files:** [`content-distribute.json`](content-distribute.json) · [`content-distribute.workflow.ts`](content-distribute.workflow.ts)

```mermaid
flowchart LR
  n1vk30ig(["Hourly"])
  n1yw96nh["Published, not shared"]
  nqlf16e{"Anything new?"}
  n11omdtq["Each article"]
  nqfj3vg[["Write the posts"]]
  n1nzmdpa("Write the posts · GPT")
  n18ipvzo("Write the posts · shape")
  nt9ojid["Cut each post to length"]
  nqjjk6i["Post to LinkedIn"]
  n16jzrxo["Post to X"]
  nf08e4y["Post to Facebook"]
  nskp575["Mark shared"]
  nnsftqe["Nothing new"]
  n54ca1["Done"]
  n1vk30ig --> n1yw96nh
  n1yw96nh --> nqlf16e
  nqlf16e -->|yes| n11omdtq
  nqlf16e -->|no| nnsftqe
  n11omdtq -->|done| n54ca1
  n11omdtq -->|each| nqfj3vg
  nqfj3vg --> nt9ojid
  nt9ojid --> nqjjk6i
  nqjjk6i --> n16jzrxo
  n16jzrxo --> nf08e4y
  nf08e4y --> nskp575
  nskp575 --> n11omdtq
  n1nzmdpa -.-> nqfj3vg
  n18ipvzo -.-> nqfj3vg
```

**How it runs**

1. **It looks for new articles.** Published and not yet shared. The flag in the datastore is the only state.
2. **A post for each network.** The model writes three versions. If it fails, a plain title-and-link post is used instead.
3. **Scheduled, then marked.** LinkedIn, X and Facebook are posted one after another, so one outage costs one post and not all three.

**Tested behaviour**

- schedules three posts and marks the article shared
- uses a plain post when the model is down
- does nothing when nothing is new
