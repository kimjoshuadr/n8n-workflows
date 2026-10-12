# Order operations

**An order followed from checkout to the customer's inbox.**

**The problem.** Orders, stock and customer emails live in different tools and are kept in step by hand.

**What this does about it.** Each order is recorded once, stock is taken, the customer is kept informed and abandoned carts are followed up.

3 workflows, 12 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Order ops · New order

Takes a new order from the store, records it once, takes its items out of stock, confirms to the customer, and warns the team about anything running low.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | Shop, Datastore, Email, Chat |
| Calls | `idempotency-guard`, `notify`, `dead-letter`, `error-handler` |
| Files | [`order-intake.json`](order-intake.json) · [`order-intake.workflow.ts`](order-intake.workflow.ts) |

```mermaid
flowchart LR
  n1ypkhn3(["Order created"])
  n1uof1h8{"From the store?"}
  n1e1tmj8(["Unauthorised"])
  n1qknxu0(["Received"])
  ns0tdo["Read the order"]
  n1ja4syq[["Seen before?"]]
  n1b5lu3c{"New order?"}
  n15km3ql["Already handled"]
  nqxt49v[/"Save the order"/]
  n143fbb7["One item per line"]
  n1g5ya8i[/"Take from stock"/]
  nb8df3h["What is running low?"]
  nqldyma{"Anything low?"}
  ndsvqkf[["Warn the team"]]
  n1uy6t4s[/"Confirm to customer"/]
  ntc51d3["Stock failure payload"]
  naa7b4d[["Park for replay"]]
  n1ypkhn3 --> n1uof1h8
  n1uof1h8 -->|yes| n1qknxu0
  n1qknxu0 --> ns0tdo
  ns0tdo --> n1ja4syq
  n1ja4syq --> n1b5lu3c
  n1b5lu3c -->|yes| nqxt49v
  nqxt49v --> n143fbb7
  n143fbb7 --> n1g5ya8i
  n1g5ya8i --> nb8df3h
  nb8df3h --> nqldyma
  nqldyma --> ndsvqkf
  n1uof1h8 -->|no| n1e1tmj8
  n1b5lu3c -->|no| n15km3ql
  nqxt49v --> n1uy6t4s
  n1g5ya8i -->|failed| ntc51d3
  ntc51d3 --> naa7b4d
```

**How it runs**

1. **The store reports an order.** The request must carry the shared secret. Anything else gets a 401 and goes no further.
2. **It is recorded once.** Stores resend webhooks when they are unsure. The order id is claimed first, so stock is never taken twice.
3. **The customer hears straight away.** The confirmation does not wait for the stock work.
4. **Each line comes out of stock.** One call per line item, retried three times.
5. **Low stock is noticed at the moment it happens.** Anything at five or fewer becomes one message to the team.
6. **A stock failure is parked.** If the store's stock API stays down, the order is kept for replay with its lines.

**Tested behaviour**

- a new order is saved, confirmed and taken from stock
- low stock warns the team
- a resent order does not take stock twice
- a request without the secret is refused
- a stock outage parks the order

## Order ops · Shipping updates

Turns a courier status into the right message for the customer, and tells a person when a parcel fails delivery.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | Datastore, Email, Chat |
| Calls | `notify`, `error-handler` |
| Files | [`order-fulfilment.json`](order-fulfilment.json) · [`order-fulfilment.workflow.ts`](order-fulfilment.workflow.ts) |

```mermaid
flowchart LR
  nfvxc7c(["Shipment update"])
  nqxvd3v["Read the update"]
  n1l72954{"A status we act on?"}
  njk85m7[/"Update the order"/]
  nslv8du{"Changed?"}
  n1byek03{"Which status?"}
  nsqmdqw[/"Email the customer"/]
  n61tzdj["Failed delivery message"]
  n1vkqv47[["Tell support"]]
  n1pcqira["Nothing to do"]
  n1vw923r["Ignored status"]
  nfvxc7c --> nqxvd3v
  nqxvd3v --> n1l72954
  n1l72954 -->|yes| njk85m7
  njk85m7 --> nslv8du
  nslv8du -->|yes| n1byek03
  n1l72954 -->|no| n1vw923r
  nslv8du -->|no| n1pcqira
  n1byek03 -->|yes| n61tzdj
  n61tzdj --> n1vkqv47
  n1byek03 -->|no| nsqmdqw
```

**How it runs**

1. **The courier reports.** Their many statuses are mapped to the four the business cares about. The rest are ignored.
2. **Only a real change counts.** The update only matches an order whose status is different, so a repeated event sends no second email.
3. **The customer is told.** Shipped, arriving today and delivered each have their own message.
4. **A failed delivery goes to a person.** The customer is not sent an automatic apology. Support is told to call them.

**Tested behaviour**

- a shipped update emails the customer
- the same update twice emails once
- a failed delivery goes to support, not the customer
- an unknown courier status is ignored

## Order ops · Abandoned cart recovery

Every half hour, writes once to people who left a cart over an hour ago and have not ordered since.

| | |
|---|---|
| Starts from | Schedule |
| Talks to | Datastore, Email |
| Calls | `error-handler` |
| Files | [`cart-recovery.json`](cart-recovery.json) · [`cart-recovery.workflow.ts`](cart-recovery.workflow.ts) |

```mermaid
flowchart LR
  n1d9t8q0(["Every 30 minutes"])
  njdsbqc[/"Open carts"/]
  n1n8az33["Old enough, with an email"]
  nqxmvr3[/"Ordered since?"/]
  n1kbh4g0["Keep the ones who did not"]
  n1uukhhu[/"Send the reminder"/]
  n1absg40[/"Mark reminded"/]
  n1d9t8q0 --> njdsbqc
  njdsbqc --> n1n8az33
  n1n8az33 --> nqxmvr3
  nqxmvr3 --> n1kbh4g0
  n1kbh4g0 --> n1uukhhu
  n1uukhhu --> n1absg40
```

**How it runs**

1. **It looks for open carts.** Not recovered and not yet reminded.
2. **An hour old, not three days.** Too soon is pushy and too late is pointless.
3. **It checks they did not buy anyway.** Someone who ordered from another device is not chased.
4. **One reminder, ever.** The cart is marked the moment the email goes.

**Tested behaviour**

- reminds an hour-old cart once
- leaves a ten-minute-old cart alone
- does not chase someone who ordered
