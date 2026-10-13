# Workflows · Operations

4 workflows. Each one is tested against a real n8n; the cases are listed under it.

## People · New hire onboarding

When someone is hired, creates their checklist, books their first-week meetings, tells the people who need to act, and sends the welcome email on the right morning.

| | |
|---|---|
| Starts from | Webhook |
| Platforms | Datastore, Calendar, Email, Chat |
| Nodes | 11 |
| Calls | `idempotency-guard`, `notify`, `error-handler` |
| Files | [`employee-onboarding.json`](employee-onboarding.json) · [`employee-onboarding.workflow.ts`](employee-onboarding.workflow.ts) |

```mermaid
flowchart LR
  nn84bve(["Hire confirmed"])
  ng26qx2["Read the hire"]
  n1ja4syq[["Seen before?"]]
  n1b8iebo{"New hire?"}
  not5ata["Build the checklist"]
  nemadsg[/"Save the task"/]
  n1jbitv5[/"Book first-day welcome"/]
  npoplal[/"Schedule the welcome email"/]
  n1cvbvfv["Team message"]
  n8m5mk4[["Tell the team"]]
  n14zcpmw["Already set up"]
  nn84bve --> ng26qx2
  ng26qx2 --> n1ja4syq
  n1ja4syq --> n1b8iebo
  n1b8iebo -->|yes| not5ata
  not5ata --> nemadsg
  nemadsg --> n1jbitv5
  n1jbitv5 --> npoplal
  npoplal --> n1cvbvfv
  n1cvbvfv --> n8m5mk4
  n1b8iebo -->|no| n14zcpmw
```

**How it runs**

1. **A hire is confirmed.** HR systems send the same event on every edit, so the hire is set up once.
2. **A dated checklist.** Six tasks counted back from the start date, each with an owner. Remote hires get a shipped laptop, not a desk.
3. **The first morning is arranged.** A welcome meeting on the calendar and an email timed for 8am on day one.
4. **The people who must act are told.** One message, with the date.

**Tested behaviour**

- creates six tasks, a meeting and a timed welcome
- a hire without a start date fails loudly

## Calendar · Morning agenda

Posts today's meetings each weekday morning, with gaps and clashes pointed out, and stays silent on an empty day.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Calendar, Chat |
| Nodes | 6 |
| Calls | `error-handler` |
| Files | [`daily-agenda.json`](daily-agenda.json) · [`daily-agenda.workflow.ts`](daily-agenda.workflow.ts) |

```mermaid
flowchart LR
  njkue0y(["Weekdays 07:30"])
  nv031w3[/"Today's events"/]
  ncxgb2w["Lay out the day"]
  n1hk3io9{"Anything on?"}
  n17rmdxw[/"Post the agenda"/]
  n1odn3lu["Clear day"]
  njkue0y --> nv031w3
  nv031w3 --> ncxgb2w
  ncxgb2w --> n1hk3io9
  n1hk3io9 -->|yes| n17rmdxw
  n1hk3io9 -->|no| n1odn3lu
```

**How it runs**

1. **Today's calendar.** Declined events are dropped.
2. **Laid out in order.** Total hours in meetings, and any two that overlap.
3. **One message, or none.** An empty day gets no message at all.

**Tested behaviour**

- lists the day and flags a clash
- stays silent on an empty day

## Data · CRM to email list sync

Copies contacts changed since the last run from the CRM to the email platform, page by page, and only moves its bookmark forward when a run finishes.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Datastore, CRM, Email |
| Nodes | 8 |
| Calls | `error-handler` |
| Files | [`contact-sync.json`](contact-sync.json) · [`contact-sync.workflow.ts`](contact-sync.workflow.ts) |

```mermaid
flowchart LR
  n1cdh6b3(["Every 15 minutes"])
  n1a7rdoo[/"Read the bookmark"/]
  nb1oy6n["Start from"]
  nxysr52[/"Changed contacts"/]
  n15spuy["Shape for the list"]
  n1jg6qaq{"Anything changed?"}
  n1gxbjs8[/"Upsert to the list"/]
  n9xotyl[/"Move the bookmark"/]
  n1cdh6b3 --> n1a7rdoo
  n1a7rdoo --> nb1oy6n
  nb1oy6n --> nxysr52
  nxysr52 --> n15spuy
  n15spuy --> n1jg6qaq
  n1jg6qaq -->|yes| n1gxbjs8
  n1gxbjs8 --> n9xotyl
  n1jg6qaq -->|no| n9xotyl
```

**How it runs**

1. **Where did we get to?.** A bookmark holds the time the last successful run started.
2. **Only what changed since.** Unsubscribes travel with the contact, so the email platform never mails someone the CRM says not to.
3. **The bookmark moves last.** If the upsert fails the bookmark stays put and the next run picks up the same contacts. Nothing is skipped.

**Tested behaviour**

- syncs changed contacts and moves the bookmark
- a failed upsert leaves the bookmark where it was

## Contracts · Expiry reminders

Warns the owner of each contract 60, 30 and 7 days before it ends, so renewals are a decision and never an accident.

| | |
|---|---|
| Starts from | Schedule |
| Platforms | Datastore, Email |
| Nodes | 5 |
| Calls | `error-handler` |
| Files | [`contract-expiry.json`](contract-expiry.json) · [`contract-expiry.workflow.ts`](contract-expiry.workflow.ts) |

```mermaid
flowchart LR
  n1pl3cmg(["Monday 09:00"])
  n9kigby[/"Active contracts"/]
  nthq0tv["Which warning is due?"]
  n1m8c29[/"Warn the owner"/]
  n1il5c79[/"Record the warning"/]
  n1pl3cmg --> n9kigby
  n9kigby --> nthq0tv
  nthq0tv --> n1m8c29
  n1m8c29 --> n1il5c79
```

**How it runs**

1. **Every active contract.** Supplier agreements, software licences, leases.
2. **Three warnings, each sent once.** 60, 30 and 7 days out. A missed week still sends the right one.
3. **The owner is told what matters.** Whether it renews by itself, and how much notice cancelling needs.

**Tested behaviour**

- sends the 30-day warning once
- a contract a year out is left alone
