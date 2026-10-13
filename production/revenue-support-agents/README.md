# Revenue and support agent pipeline

**Six agents: three answer the inbox, three run outbound.**

**The problem.** First-line support and top-of-funnel prospecting are both repetitive, and both stop when the people doing them are busy.

**What this does about it.** Inbound messages are routed, answered from the knowledge base and CRM or handed to a person with a brief. Outbound, agents find companies and people who fit the customer profile and write to them, with the profile and the email checked in code.

One canvas of 49 nodes, 10 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

> **Built and run in production, rebuilt here on test data.** Node names, order, branches and loops follow the original canvas. What is inside each node was written again for this library, and every name that belonged to the business is a placeholder. The two tracks and six agents are the original's. The canvas was too small to read node by node, so the steps between the agents follow the written description; sending through Gmail and alerting in Slack are this build's choices.

## AI agents · Revenue and support pipeline

Two tracks on one canvas. Inbound messages go to a router agent, which hands each one to a RAG agent that answers from the Supabase knowledge base and HubSpot, to a fallback agent, or to a human escalation agent that briefs a person. On weekdays, research and lead gen agents find people who fit the ideal customer profile, and a cold outreach agent writes to them and files them in the CRM.

- **Starts from:** Webhook, Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI &nbsp;·&nbsp; <img src="../../assets/platforms/hubspot.svg" width="16" height="16" alt=""> HubSpot &nbsp;·&nbsp; <img src="../../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack &nbsp;·&nbsp; <img src="../../assets/platforms/serpapi.svg" width="16" height="16" alt=""> SerpAPI &nbsp;·&nbsp; <img src="../../assets/platforms/gmail.svg" width="16" height="16" alt=""> Gmail
- **Nodes:** 49
- **Calls:** `error-handler`
- **Files:** [`revenue-support-agents.json`](revenue-support-agents.json) · [`revenue-support-agents.workflow.ts`](revenue-support-agents.workflow.ts)

```mermaid
flowchart LR
  n2yoc9e(["on_message_received"])
  n1f47t91["normalise_message"]
  na95q7p[["Router Agent"]]
  n180dvla("router_parser")
  n2fx413["read_route"]
  n138frkw{"switch_intent"}
  nvpzj4m[["RAG Agent"]]
  n1k8fumu("conversation_memory")
  ngnlq1("knowledge_base")
  n1sasfgj("embeddings")
  nc8056q("crm_lookup")
  n1vn5vz4["read_answer"]
  n10rwuvs{"if_answered"}
  n1ovylfy[["Fallback Agent"]]
  nwwrsuc["read_fallback"]
  n1is4vn8[["Human Escalation Agent"]]
  nr9u28y("escalation_parser")
  n1plckxj["read_escalation"]
  n9sk16t["create_handover_task"]
  n1l5k84s["notify_team"]
  nfrwl1g["set_escalation_reply"]
  n1r2ddid["log_conversation"]
  n1xsck5t(["respond_to_customer"])
  n1kz6sg9(["daily_prospecting"])
  n1mgm3pi["get_icp"]
  nc043ln{"if_icp"}
  n15ctqmf[["Research Agent"]]
  nlx6hq2("web_search")
  na4fprv("fetch_page")
  n17frj30("research_parser")
  n12bwsah["read_companies"]
  n4aanzw["for_each_company"]
  nkdzk7s[["Lead Gen Agent"]]
  nni3d19("fetch_company_page")
  nfdkqy8("crm_search")
  n13rhfjv("lead_parser")
  n1ivmcag["check_icp"]
  npxbrlt{"if_qualified"}
  nm4esrl["find_contact"]
  n1vt7x92{"if_new_lead"}
  n1equudb[["Cold Outreach Agent"]]
  n78fmj6("outreach_parser")
  nx3sc3i["check_email"]
  n1to9h7h{"if_sendable"}
  n1khywb9["send_outreach"]
  n6rymoo["create_lead"]
  n1ab38xz["log_outreach"]
  n137kq2w("OpenAI Chat Model")
  nyuj509("OpenAI Chat Model 1")
  n2yoc9e --> n1f47t91
  n1f47t91 --> na95q7p
  na95q7p --> n2fx413
  n2fx413 --> n138frkw
  n138frkw --> nvpzj4m
  nvpzj4m --> n1vn5vz4
  n1vn5vz4 --> n10rwuvs
  n10rwuvs --> n1r2ddid
  n10rwuvs --> n1ovylfy
  n138frkw --> n1ovylfy
  n1ovylfy --> nwwrsuc
  nwwrsuc --> n1r2ddid
  n138frkw --> n1is4vn8
  n1is4vn8 --> n1plckxj
  n1plckxj --> n9sk16t
  n9sk16t --> n1l5k84s
  n1l5k84s --> nfrwl1g
  nfrwl1g --> n1r2ddid
  n1r2ddid --> n1xsck5t
  n1kz6sg9 --> n1mgm3pi
  n1mgm3pi --> nc043ln
  nc043ln --> n15ctqmf
  n15ctqmf --> n12bwsah
  n12bwsah --> n4aanzw
  n4aanzw -->|each| nkdzk7s
  nkdzk7s --> n1ivmcag
  n1ivmcag --> npxbrlt
  npxbrlt --> nm4esrl
  nm4esrl --> n1vt7x92
  n1vt7x92 --> n1equudb
  n1equudb --> nx3sc3i
  nx3sc3i --> n1to9h7h
  n1to9h7h --> n1khywb9
  n1khywb9 --> n6rymoo
  n6rymoo --> n1ab38xz
  n1ab38xz --> n4aanzw
  npxbrlt --> n4aanzw
  n1vt7x92 --> n4aanzw
  n1to9h7h --> n4aanzw
  n180dvla -.-> na95q7p
  n1k8fumu -.-> nvpzj4m
  ngnlq1 -.-> nvpzj4m
  n1sasfgj -.-> ngnlq1
  nc8056q -.-> nvpzj4m
  nr9u28y -.-> n1is4vn8
  nlx6hq2 -.-> n15ctqmf
  na4fprv -.-> n15ctqmf
  n17frj30 -.-> n15ctqmf
  nni3d19 -.-> nkdzk7s
  nfdkqy8 -.-> nkdzk7s
  n13rhfjv -.-> nkdzk7s
  n78fmj6 -.-> n1equudb
  n137kq2w -.-> na95q7p
  n137kq2w -.-> nvpzj4m
  n137kq2w -.-> n1ovylfy
  n137kq2w -.-> n1is4vn8
  nyuj509 -.-> n15ctqmf
  nyuj509 -.-> nkdzk7s
  nyuj509 -.-> n1equudb
```

**How it runs**

1. **A message arrives.** The webhook takes the message and puts it in one shape: who it is from, which conversation it belongs to and what it says.
2. **The router agent reads it.** It names the intent and how sure it is. It does not answer.
3. **Code decides the route.** A clear support or sales question goes to be answered. A low-confidence reading goes to the fallback agent. Anything that mentions a refund, a complaint, legal action or asks for a person goes to a human, whatever the model thought.
4. **The RAG agent answers from what is known.** It searches the knowledge base held in Supabase, can look the customer up in HubSpot, and remembers the conversation so far. It is told to say so when the tools do not hold the answer.
5. **No answer, no guess.** If the RAG agent could not answer, the message goes to the fallback agent, which asks the one question that would make it answerable or says the team will follow up. If that model is down too, a fixed reply is sent.
6. **A person is briefed.** The human escalation agent writes a summary for the colleague who picks the conversation up, rates its urgency and writes a holding reply. A task is created in HubSpot and the team is told in Slack.
7. **Logged and answered.** Every conversation is stored in Supabase with who handled it, and the reply goes back to the customer.
8. **Outbound starts from the profile.** On weekdays the ideal customer profile is read from Supabase: industry, size, region, the role to reach and what is on offer. With no active profile, nothing runs.
9. **The research agent finds companies.** It searches the web and fetches each company's own site to confirm the fit before listing it. The list is deduplicated and capped in code.
10. **The lead gen agent finds the person.** For each company it reads the team and contact pages for the person in the right role, and can check the CRM.
11. **The profile is applied in code.** A lead qualifies only with a named person, an email at the company's own domain, evidence for the role and a fit score of 70 or more. Someone already in HubSpot is not contacted again.
12. **The cold outreach agent writes.** One short email built on what was found about the company. Code checks its length and that no placeholder was left in before it can be sent.
13. **Sent, filed and logged.** The email goes out through Gmail, the lead is created in HubSpot, and the send is logged in Supabase.

**Tested behaviour**

- a support question is answered from the knowledge base
- what the knowledge base cannot answer goes to the fallback agent
- an unclear message skips the RAG agent
- a complaint reaches a person even when the router calls it support
- the customer still gets a reply when every model is down
- a qualified lead is emailed, created in HubSpot and logged
- a lead that fails the profile is not contacted, whatever the model scored
- someone already in HubSpot is not emailed again
- an email with a placeholder left in is not sent
- nothing runs without an active customer profile
