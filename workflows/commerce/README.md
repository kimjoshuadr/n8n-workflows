# Workflows · Commerce

4 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Inventory · Supplier stock sync

Pulls the supplier's stock feed every two hours and updates the store only for products whose quantity changed, refusing a feed that looks wrong.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Supplier, Datastore, Shop, Chat |
| Nodes | 10 |
| Calls | `notify`, `error-handler` |
| Files | [`inventory-sync.json`](inventory-sync.json) · [`inventory-sync.workflow.ts`](inventory-sync.workflow.ts) |

```mermaid
flowchart LR
  nbzf7x1(["Every 2 hours"])
  n1n88ecr[/"Supplier feed"/]
  nwz9eae[/"Last known stock"/]
  nnrb8yo["What changed?"]
  n1kc0ib{"Feed looks sane?"}
  nsekrgf["One item per change"]
  njmguf6[/"Update the store"/]
  nds23nn[/"Update the snapshot"/]
  n1yxv2k0["Refused message"]
  n4d13md[["Alert"]]
  nbzf7x1 --> n1n88ecr
  n1n88ecr --> nwz9eae
  nwz9eae --> nnrb8yo
  nnrb8yo --> n1kc0ib
  n1kc0ib -->|yes| nsekrgf
  nsekrgf --> njmguf6
  njmguf6 --> nds23nn
  n1kc0ib -->|no| n1yxv2k0
  n1yxv2k0 --> n4d13md
```

**How it runs**

1. **The supplier's numbers, and ours.** The feed is compared with the last snapshot.
2. **A broken feed is refused.** An empty feed, or one that zeroes most of the catalogue, changes nothing and raises an alert. That one check is what stops a supplier outage from taking every product off sale.
3. **Only the differences are written.** Ten changed products means ten calls, not ten thousand.

**Tested behaviour**

- updates only what changed
- refuses an empty feed
- refuses a feed that zeroes most of the catalogue

## Payments · Refund requests

Refunds small amounts on recent orders automatically, and sends anything larger, older or repeated to a person with the facts attached.

| | |
|---|---|
| Starts from | Webhook |
| Platforms | Datastore, Payments, Email, Chat |
| Nodes | 18 |
| Calls | `notify`, `error-handler` |
| Files | [`refund-approval.json`](refund-approval.json) · [`refund-approval.workflow.ts`](refund-approval.workflow.ts) |

```mermaid
flowchart LR
  n5dq4ml(["Refund requested"])
  n4skscd["Read the request"]
  n2xqlyi{"Valid?"}
  n1clxfxs(["Invalid"])
  n2f5mh8[/"Load the order"/]
  n1dhn3qu{"Order found?"}
  ntr7sj5(["Unknown order"])
  nzokvbo[/"Past refunds"/]
  n1iue1ne["Apply the policy"]
  ne9uvpf{"Decision"}
  n1xheo7a(["Already refunded"])
  nz9z0gn[/"Refund at the processor"/]
  n1qn7jj[/"Record the refund"/]
  nwbgapf[/"Mark the order"/]
  n1s8oc3i(["Refunded"])
  n20moti["Review message"]
  n10am1f0[["Ask finance"]]
  n18n0taf(["Under review"])
  n5dq4ml --> n4skscd
  n4skscd --> n2xqlyi
  n2xqlyi -->|yes| n2f5mh8
  n2f5mh8 --> n1dhn3qu
  n1dhn3qu -->|yes| nzokvbo
  nzokvbo --> n1iue1ne
  n1iue1ne --> ne9uvpf
  n2xqlyi -->|no| n1clxfxs
  n1dhn3qu -->|no| ntr7sj5
  ne9uvpf --> n1xheo7a
  ne9uvpf --> nz9z0gn
  nz9z0gn --> n1qn7jj
  n1qn7jj --> nwbgapf
  nwbgapf --> n1s8oc3i
  ne9uvpf --> n20moti
  n20moti --> n10am1f0
  n10am1f0 --> n18n0taf
```

**How it runs**

1. **A refund is asked for.** The order is loaded, along with every refund this customer has had before.
2. **The policy is written down.** Under 100, within 30 days, and not a third refund. Each rule that fails is named.
3. **Inside the policy: refunded now.** The processor call carries an idempotency key, so a retry can never refund twice.
4. **Outside it: a person decides.** Finance gets the amount, the rules it failed and what the customer said.

**Tested behaviour**

- a small recent order is refunded automatically
- a large order goes to finance
- a third refund goes to finance
- asking twice refunds once
- an unknown order is a 404

## Subscriptions · Renewal reminders

Tells subscribers a week before an annual renewal, once, with the amount and the date, so the charge is never a surprise.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Datastore, Email |
| Nodes | 5 |
| Calls | `error-handler` |
| Files | [`renewal-reminder.json`](renewal-reminder.json) · [`renewal-reminder.workflow.ts`](renewal-reminder.workflow.ts) |

```mermaid
flowchart LR
  n1k1kxc4(["08:00 daily"])
  n1wseps3[/"Active subscriptions"/]
  n50z9pm["Renewing in a week"]
  n1ki2bqw[/"Send the notice"/]
  n1absg40[/"Mark reminded"/]
  n1k1kxc4 --> n1wseps3
  n1wseps3 --> n50z9pm
  n50z9pm --> n1ki2bqw
  n1ki2bqw --> n1absg40
```

**How it runs**

1. **Annual plans only.** Monthly subscribers do not need a notice every month.
2. **Inside the last seven days.** The reminder is tied to the renewal date itself, so next year's renewal gets its own.
3. **One notice, with the amount.** And a link to change or cancel.

**Tested behaviour**

- reminds once for a renewal five days away
- a renewal a month away is left alone

## Finance · Supplier invoice intake

Reads a supplier invoice with a model, checks the arithmetic and the duplicate history itself, and files it or sends it for review.

| | |
|---|---|
| Starts from | Webhook |
| Platforms | LLM, Datastore, Chat |
| Nodes | 11 |
| Calls | `notify`, `error-handler` |
| Files | [`invoice-intake.json`](invoice-intake.json) · [`invoice-intake.workflow.ts`](invoice-intake.workflow.ts) |

```mermaid
flowchart LR
  n8xk0bf(["Invoice received"])
  nqy0qxf["Read the upload"]
  n1jqwfxq[/"Extract the fields"/]
  njqdbt7["Read the fields"]
  n1ebk2nq[/"Seen this invoice?"/]
  nuc14dm["Check it"]
  n1t4wyd9{"Clean?"}
  n221iyw[/"File it"/]
  n1coc5k5[/"Queue for review"/]
  n20moti["Review message"]
  nd3wmc2[["Tell finance"]]
  n8xk0bf --> nqy0qxf
  nqy0qxf --> n1jqwfxq
  n1jqwfxq --> njqdbt7
  njqdbt7 --> n1ebk2nq
  n1ebk2nq --> nuc14dm
  nuc14dm --> n1t4wyd9
  n1t4wyd9 -->|yes| n221iyw
  n1t4wyd9 -->|no| n1coc5k5
  n1coc5k5 --> n20moti
  n20moti --> nd3wmc2
```

**How it runs**

1. **An invoice arrives.** As text from the upload or the email it came in.
2. **A model reads the fields.** Vendor, number, total, due date, and how sure it is. It is told to return null and never to guess.
3. **Code checks the model's work.** Is the total a positive number? Is the date a date? Has this vendor sent this number before? None of that is left to the model.
4. **Clean invoices are filed.** Ready for the payment run.
5. **Anything doubtful goes to a person.** With the list of what was wrong, so the check takes seconds.

**Tested behaviour**

- a clean invoice is filed
- a duplicate is caught and sent for review
- low confidence goes for review
- a negative total goes for review
