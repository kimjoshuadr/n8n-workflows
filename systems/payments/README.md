# Payments

**Every payment recorded exactly once, and checked daily.**

**The problem.** Payment webhooks arrive twice or not at all, and nobody notices the books are wrong until month end.

**What this does about it.** A ledger that matches the processor, a daily proof that it does, and overdue invoices chased on a schedule.

3 workflows, 14 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Payments · Event ledger

Records each payment, failure and refund from the processor exactly once, updates the invoice, and sends the receipt or the retry notice.

| | |
|---|---|
| Starts from | Webhook |
| Platforms | Datastore, Email, Chat |
| Nodes | 18 |
| Calls | `idempotency-guard`, `notify`, `error-handler` |
| Files | [`payment-events.json`](payment-events.json) · [`payment-events.workflow.ts`](payment-events.workflow.ts) |

```mermaid
flowchart LR
  np0fv3t(["Payment event"])
  n1eqfau4{"Signed?"}
  n1e1tmj8(["Unauthorised"])
  nmlgco["Read the event"]
  n1ja4syq[["Seen before?"]]
  n16hdm8c{"New event?"}
  n1vz1len(["Already recorded"])
  n1bnftgv{"Which event?"}
  n1hzo4xb[/"Ledger: credit"/]
  n7mpgcr[/"Mark invoice paid"/]
  n1qizjgn[/"Send receipt"/]
  nc8fxdo[/"Mark invoice failed"/]
  n1p3wb0w[/"Ask to update card"/]
  nvjcr3q[/"Ledger: debit"/]
  n7vlefa["Refund message"]
  nd3wmc2[["Tell finance"]]
  n1qqb9av(["Recorded"])
  n1mrxx0o(["Not handled"])
  np0fv3t --> n1eqfau4
  n1eqfau4 -->|yes| nmlgco
  nmlgco --> n1ja4syq
  n1ja4syq --> n16hdm8c
  n16hdm8c -->|yes| n1bnftgv
  n1eqfau4 -->|no| n1e1tmj8
  n16hdm8c -->|no| n1vz1len
  n1bnftgv -->|yes| n1hzo4xb
  n1hzo4xb --> n7mpgcr
  n7mpgcr --> n1qizjgn
  n1qizjgn --> n1qqb9av
  n1bnftgv -->|no| nc8fxdo
  nc8fxdo --> n1p3wb0w
  n1p3wb0w --> n1qqb9av
  n1bnftgv -->|no| nvjcr3q
  nvjcr3q --> n7vlefa
  n7vlefa --> nd3wmc2
  nd3wmc2 --> n1qqb9av
  n1bnftgv -->|no| n1mrxx0o
```

**How it runs**

1. **The processor reports an event.** Unsigned requests are refused. The reply is only sent once the event is safely recorded, so the processor retries anything that was not.
2. **Exactly once.** Processors promise at-least-once delivery. The event id is claimed first, so a repeat changes nothing.
3. **A payment.** Credited to the ledger, the invoice marked paid, a receipt sent.
4. **A failure.** The invoice is marked and the customer is asked to update their card.
5. **A refund.** A negative ledger line, and finance is told.
6. **The processor gets its answer.** Events the business does not act on are acknowledged and ignored.

**Tested behaviour**

- a payment is credited, the invoice paid and a receipt sent
- the same event twice is one ledger line
- a refund is a negative line and finance is told
- a failed payment marks the invoice and asks for a new card
- an unsigned request is refused
- an event we do not act on is acknowledged

## Payments · Daily reconciliation

Each morning, compares yesterday's charges at the processor with the ledger and reports anything on one side and not the other.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Payments, Datastore, Chat |
| Nodes | 11 |
| Calls | `notify`, `error-handler` |
| Files | [`payment-reconcile.json`](payment-reconcile.json) · [`payment-reconcile.workflow.ts`](payment-reconcile.workflow.ts) |

```mermaid
flowchart LR
  n1qjkux2(["06:00 daily"])
  n1qw9u96[/"Processor charges"/]
  nstmecv[/"Ledger lines"/]
  nvx0mhq["Compare"]
  n1s6n3e8{"Books agree?"}
  nxl0tpx[/"Post all clear"/]
  nzdsxbe["One item per issue"]
  nkjprb6[/"Record the issue"/]
  nfkrljw["Mismatch message"]
  nxzp4y7[["Alert finance"]]
  nuc14dg[/"Check in"/]
  n1qjkux2 --> n1qw9u96
  n1qw9u96 --> nstmecv
  nstmecv --> nvx0mhq
  nvx0mhq --> n1s6n3e8
  n1s6n3e8 -->|yes| nxl0tpx
  nxl0tpx --> nuc14dg
  n1s6n3e8 -->|no| nzdsxbe
  nzdsxbe --> nkjprb6
  nkjprb6 --> nfkrljw
  nfkrljw --> nxzp4y7
  nxzp4y7 --> nuc14dg
```

**How it runs**

1. **Two lists of yesterday.** What the processor says it charged, and what the ledger says was recorded.
2. **Compared line by line.** Three things can be wrong: missing from the ledger, missing at the processor, or a different amount.
3. **A clean day says so.** Finance gets a one-line confirmation, which is also proof the check ran.
4. **A mismatch is recorded and raised.** Each issue is stored as open, then finance gets one critical alert naming them.
5. **It checks in.** If this ever stops running, the heartbeat monitor notices.

**Tested behaviour**

- matching books post an all clear
- a charge missing from the ledger is raised
- a different amount is raised
- a ledger line with no charge is raised

## Payments · Overdue reminders

Each morning, reminds customers with overdue invoices at 3, 7 and 14 days, then hands the invoice to a person at 21.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Datastore, Email, Chat |
| Nodes | 9 |
| Calls | `notify`, `error-handler` |
| Files | [`invoice-dunning.json`](invoice-dunning.json) · [`invoice-dunning.workflow.ts`](invoice-dunning.workflow.ts) |

```mermaid
flowchart LR
  n1gskyjn(["09:00 daily"])
  n125hlbp[/"Open invoices"/]
  n1b17xh3["Which step is due?"]
  n1bxz7f3{"Still a reminder?"}
  n1uukhhu[/"Send the reminder"/]
  n9tzmdf[/"Record the step"/]
  nce2vhf["Escalation message"]
  n12fjapb[["Hand to a person"]]
  nhry6yu[/"Mark escalated"/]
  n1gskyjn --> n125hlbp
  n125hlbp --> n1b17xh3
  n1b17xh3 --> n1bxz7f3
  n1bxz7f3 -->|yes| n1uukhhu
  n1uukhhu --> n9tzmdf
  n1bxz7f3 -->|no| nce2vhf
  nce2vhf --> n12fjapb
  n12fjapb --> nhry6yu
```

**How it runs**

1. **It reads the open invoices.** Paid invoices never appear here, because the payment workflow marks them the moment money arrives.
2. **It works out the step.** 3, 7, 14 or 21 days overdue. A step already sent is never sent again, even if a day's run was missed.
3. **A reminder, recorded.** Each step has its own wording, and the step is written back.
4. **At 21 days a person takes over.** Automation stops and finance is asked to call.

**Tested behaviour**

- an invoice 8 days overdue gets the 7-day reminder
- a step already sent is not sent again
- an invoice not yet due is left alone
- at 21 days it is handed to a person
