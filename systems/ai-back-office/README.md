# AI back office

**Invoices, receipts and bank lines, read, matched and questioned.**

**The problem.** Bookkeeping is typing what a document already says, then finding the one line that does not match.

**What this does about it.** Documents are read by a model and checked by arithmetic, bank lines are matched, anomalies are raised, and finance can ask questions in Slack and get answers from the books.

1 workflows, 13 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## AI back office · Invoices, bank lines and questions

Agents read supplier invoices from Gmail, code them against the chart of accounts and file them in QuickBooks. Bank lines are matched every morning, the ledger is scanned for anomalies, finance can ask questions in Slack, and the month closes into a Google Sheets pack. Every figure is checked or computed in code.

| | |
|---|---|
| Starts from | undefined |
| Platforms | Gmail, OpenAI, Supabase, Claude, Pinecone, QuickBooks, Slack, Google Sheets |
| Nodes | 72 |
| Calls | `idempotency-guard`, `notify`, `error-handler` |
| Files | [`ai-back-office.json`](ai-back-office.json) · [`ai-back-office.workflow.ts`](ai-back-office.workflow.ts) |

```mermaid
flowchart LR
  nd4urge(["Invoice email arrives"])
  nmfmdm["Read the email"]
  niwxnf5{"Something to read?"}
  n5cpzgh["Nothing to read"]
  n1o2lp0n[["Seen this email?"]]
  n16cct1m{"New email?"}
  ncqs1fj["Already processed"]
  n1cyj5bn[["Extraction agent"]]
  n47r1bg("GPT · extraction")
  nkhbqb7("Invoice fields")
  n12yro1k["Check the arithmetic"]
  ngwrgre["Same invoice before?"]
  n1mg4uq0["What we know of the vendor"]
  nm2pcfw["Compare with history"]
  nyjr9me[["Coding agent"]]
  nyv4yem("Claude · coding")
  n1ezpls6("Chart of accounts")
  neym9h4("Embeddings · chart")
  n1vrah46("Account")
  nrgpc85["Hold it to the chart"]
  n1t4wyd9{"Clean?"}
  nqwizbf[/"Create the bill in QuickBooks"/]
  n1ga9bep["File the invoice"]
  n11ao03x["Label as filed"]
  n1g38ulf["Explain what is wrong"]
  n1coc5k5["Queue for review"]
  n20moti["Review message"]
  nd3wmc2[["Tell finance"]]
  n6y865f(["06:30 daily"])
  nyia14k[/"Yesterday's bank lines"/]
  nqopfcd["Bills awaiting payment"]
  nviwji7["Match the exact ones"]
  n1nzc9d5{"Anything left over?"}
  n2z2fbd[["Matching agent"]]
  n1wu4s75("Claude · matching")
  n1d5lwgw("Proposed matches")
  nkn0e74["Accept only what holds up"]
  n1m2wipn["One row per match"]
  nvejlpm["Mark the bill paid"]
  n1webmqz["Post the reconciliation"]
  n1nakw4l(["07:00 daily"])
  nn4xsbw["The last 90 days"]
  nwzwwbt["Look for the unusual"]
  nwloqul{"Anything unusual?"}
  n1oraz1d[["Anomaly agent"]]
  nsdumcd("Claude · anomalies")
  nkhxiy8["Record the flags"]
  n1iveerb["Raise the anomalies"]
  nkuu4kv["Nothing unusual"]
  n1d6tqxf(["Finance question"])
  n1ssskoo["Read the question"]
  nv6tpt8{"Allowed to ask?"}
  nw8vhlg(["Not allowed"])
  nx392qo[["Analyst agent"]]
  n1azfa8w("Claude · analysis")
  n4mz3qv("Conversation memory")
  nswkut4("Ledger query")
  nj7c2g9("Calculator")
  n1fp1ul("Plan the answer")
  n1s86opx("Answer")
  nbjvmp8["Only answer with working"]
  nv45f7c["Log the question"]
  nrcomhc(["Answer in Slack"])
  n16awwt9(["1st of the month"])
  n1t5023h["Two months of invoices"]
  n4ncbfr["Total by account"]
  nky16c6[["Close agent"]]
  n7zwjp0("Claude · close")
  n2z1och("Close note")
  nmv3vz7["One row per account"]
  n1mbte49["Add to the month-end pack"]
  nsxvchc["Post the close"]
  nd4urge --> nmfmdm
  nmfmdm --> niwxnf5
  niwxnf5 -->|yes| n1o2lp0n
  n1o2lp0n --> n16cct1m
  n16cct1m -->|yes| n1cyj5bn
  n1cyj5bn --> n12yro1k
  n12yro1k --> ngwrgre
  ngwrgre --> n1mg4uq0
  n1mg4uq0 --> nm2pcfw
  nm2pcfw --> nyjr9me
  nyjr9me --> nrgpc85
  nrgpc85 --> n1t4wyd9
  n1t4wyd9 -->|yes| nqwizbf
  nqwizbf --> n1ga9bep
  n1ga9bep --> n11ao03x
  niwxnf5 -->|no| n5cpzgh
  n16cct1m -->|no| ncqs1fj
  n1t4wyd9 -->|no| n1g38ulf
  n1g38ulf --> n1coc5k5
  n1coc5k5 --> n20moti
  n20moti --> nd3wmc2
  nqwizbf -->|failed| n1g38ulf
  n6y865f --> nyia14k
  nyia14k --> nqopfcd
  nqopfcd --> nviwji7
  nviwji7 --> n1nzc9d5
  n1nzc9d5 -->|yes| n2z2fbd
  n2z2fbd --> nkn0e74
  nkn0e74 --> n1m2wipn
  n1m2wipn --> nvejlpm
  nvejlpm --> n1webmqz
  n1nzc9d5 -->|no| nkn0e74
  n1nakw4l --> nn4xsbw
  nn4xsbw --> nwzwwbt
  nwzwwbt --> nwloqul
  nwloqul -->|yes| n1oraz1d
  n1oraz1d --> nkhxiy8
  nkhxiy8 --> n1iveerb
  nwloqul -->|no| nkuu4kv
  n1d6tqxf --> n1ssskoo
  n1ssskoo --> nv6tpt8
  nv6tpt8 -->|yes| nx392qo
  nx392qo --> nbjvmp8
  nbjvmp8 --> nv45f7c
  nv45f7c --> nrcomhc
  nv6tpt8 -->|no| nw8vhlg
  n16awwt9 --> n1t5023h
  n1t5023h --> n4ncbfr
  n4ncbfr --> nky16c6
  nky16c6 --> nmv3vz7
  nmv3vz7 --> n1mbte49
  n1mbte49 --> nsxvchc
  n47r1bg -.-> n1cyj5bn
  nkhbqb7 -.-> n1cyj5bn
  nyv4yem -.-> nyjr9me
  n1ezpls6 -.-> nyjr9me
  neym9h4 -.-> n1ezpls6
  n1vrah46 -.-> nyjr9me
  n1wu4s75 -.-> n2z2fbd
  n1d5lwgw -.-> n2z2fbd
  nsdumcd -.-> n1oraz1d
  n1azfa8w -.-> nx392qo
  n4mz3qv -.-> nx392qo
  nswkut4 -.-> nx392qo
  nj7c2g9 -.-> nx392qo
  n1fp1ul -.-> nx392qo
  n1s86opx -.-> nx392qo
  n7zwjp0 -.-> nky16c6
  n2z1och -.-> nky16c6
```

**How it runs**

1. **An invoice arrives by email.** Gmail brings it in. An email with nothing to read, or one already processed, stops here.
2. **A model copies the fields.** Vendor, number, dates, lines, totals and the bank account to pay. It is told to copy, never to work a number out.
3. **Code checks the document against itself.** Do the lines add up to the subtotal? Is subtotal plus tax the total? Is it due after it was issued? A model's reading that fails its own arithmetic goes no further.
4. **And against what is already known.** The same invoice number twice, a new vendor, three times the usual amount, or a bank account that differs from the one on file. That last one is how invoice fraud works, and it is marked critical.
5. **A coding agent picks the account.** It searches the chart of accounts in Pinecone. Code accepts its answer only if the account exists in the chart.
6. **Clean invoices become bills.** The bill is created in QuickBooks, filed in Supabase and the email is labelled.
7. **Anything else goes to a person, with the reason.** Finance gets every problem found, in one message, so the check takes seconds.
8. **Each morning, bank lines meet bills.** The same amount with the invoice number in the memo is matched in code.
9. **An agent proposes the awkward ones.** A vendor name in the memo, a reference that is nearly right. The proposal is accepted only if the amounts are equal and the agent is confident.
10. **The ledger is scanned for the unusual.** Three rules in code: far from a vendor's usual amount, the same amount twice in a week, a round sum from a new vendor. The agent orders and explains the flags; it cannot add one.
11. **Finance asks a question in Slack.** Only named people may ask. The analyst agent can read the ledger and use a calculator. It has no tool that pays, changes or deletes.
12. **No working, no answer.** A reply with no ledger rows behind it is replaced by 'I could not answer that'. Every question is logged.
13. **The first of the month.** Spend by account against the month before is totalled in code, added to the Google Sheets pack, and an agent writes the note that goes with it.

**Tested behaviour**

- a clean invoice is read, checked, coded and filed as a QuickBooks bill
- an invoice whose own numbers do not add up never reaches QuickBooks
- a known vendor with a new bank account is stopped and marked critical
- an invoice number this vendor already sent is not filed twice
- an account that is not in the chart is refused
- the same email delivered twice is processed once
- bank lines are matched exactly in code, and an agent's proposal needs equal amounts
- an invoice ten times a vendor's usual amount is flagged by rule and explained
- an ordinary day raises nothing and calls no model
- a finance question is answered from the ledger, with its working
- someone outside finance is refused before any model is called
- an answer with no ledger rows behind it is not given
- month end totals each account against the month before and fills the pack
