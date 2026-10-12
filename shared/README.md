# Reliability kit

**What every other workflow leans on when something fails.**

**The problem.** Automations fail silently: a webhook arrives twice, an API is down, a schedule stops.

**What this does about it.** Failures are caught, alerted once, parked for replay and noticed even when the failure is that nothing ran.

6 workflows, 14 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Reliability · Error handler

Catches a failure in any workflow, logs it, and alerts once per distinct error per hour so a broken loop cannot flood the channel.

| | |
|---|---|
| Starts from | A failure in any workflow |
| Talks to | Datastore, Chat |
| Calls | nothing |
| Files | [`error-handler.json`](error-handler.json) · [`error-handler.workflow.ts`](error-handler.workflow.ts) |

```mermaid
flowchart LR
  nha3ywx(["On workflow error"])
  njrcfql["Describe the failure"]
  ni022uu[/"Log the error"/]
  n1oopz9x{"First time this hour?"}
  ngpp5uf[/"Alert the team"/]
  nexqywc["Already alerted"]
  nha3ywx --> njrcfql
  njrcfql --> ni022uu
  ni022uu --> n1oopz9x
  n1oopz9x -->|yes| ngpp5uf
  n1oopz9x -->|no| nexqywc
```

**How it runs**

1. **A workflow fails.** Every workflow in the library names this one as its error workflow, so a failure anywhere arrives here.
2. **It is logged once.** The error is written with a fingerprint of workflow, node, message and hour. A repeat inside the hour is ignored by the datastore.
3. **The team hears about it once.** Only a new fingerprint posts an alert, so a loop failing a thousand times is one message.

**Tested behaviour**

- a new failure is logged and alerted
- the same failure inside the hour is not alerted twice

## Reliability · Idempotency guard

Answers one question for a caller: has this event been handled before? Webhooks are delivered more than once; this is what makes that safe.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | Datastore |
| Calls | `error-handler` |
| Files | [`idempotency-guard.json`](idempotency-guard.json) · [`idempotency-guard.workflow.ts`](idempotency-guard.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1rujfzr["Build the key"]
  ni91imd[/"Claim the key"/]
  n13tziz["Report"]
  nxyuboc --> n1rujfzr
  n1rujfzr --> ni91imd
  ni91imd --> n13tziz
```

**How it runs**

1. **A caller asks.** It passes a scope and a key: an order id, a payment event id, a lead's email.
2. **The key is claimed.** One insert with a unique constraint. The database decides, so two runs at the same moment cannot both win.
3. **The caller gets an answer.** duplicate: true means stop. The caller decides what stopping looks like.

**Tested behaviour**

- a first event is not a duplicate
- a repeat is a duplicate

## Reliability · Notify

The one place alerts leave from. Posts to chat, and falls back to email when chat is down, so an outage cannot hide its own alert.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | Chat, Email |
| Calls | `error-handler` |
| Files | [`notify.json`](notify.json) · [`notify.workflow.ts`](notify.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  nvx0wwb["Compose"]
  n7sk26c[/"Post to chat"/]
  n1wsgy3i["Delivered by chat"]
  no9yad3[/"Email instead"/]
  n1mehp2["Delivered by email"]
  nxyuboc --> nvx0wwb
  nvx0wwb --> n7sk26c
  n7sk26c --> n1wsgy3i
  n7sk26c -->|failed| no9yad3
  no9yad3 --> n1mehp2
```

**How it runs**

1. **Something needs saying.** Any workflow calls this with a text and a level. No workflow talks to the chat tool directly.
2. **Chat first.** Three attempts, a second apart.
3. **Email if chat is down.** A failure after the retries takes the second output and the alert still arrives.

**Tested behaviour**

- posts to chat
- falls back to email when chat stays down
- recovers when chat fails once

## Reliability · Dead letter

Keeps the payload of work that could not be finished, with the reason, so nothing is lost when a downstream system is down.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | Datastore, Chat |
| Calls | `error-handler` |
| Files | [`dead-letter.json`](dead-letter.json) · [`dead-letter.workflow.ts`](dead-letter.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1j9uypc["Wrap the payload"]
  n32tvkq[/"Park it"/]
  n1isjvc[/"Say so"/]
  nxyuboc --> n1j9uypc
  n1j9uypc --> n32tvkq
  n32tvkq --> n1isjvc
```

**How it runs**

1. **Work could not be finished.** A caller hands over the payload, where it came from and why it failed.
2. **It is parked, not dropped.** The payload is stored as pending with the address that can replay it.
3. **Someone is told.** The alert is best effort: parking has already succeeded.

**Tested behaviour**

- parks the payload as pending
- still parks when the alert cannot be sent

## Reliability · Dead letter replay

Every fifteen minutes, sends parked work back to where it came from. Gives up after five attempts and says so.

| | |
|---|---|
| Starts from | Schedule |
| Talks to | Datastore, Chat |
| Calls | `error-handler` |
| Files | [`dead-letter-replay.json`](dead-letter-replay.json) · [`dead-letter-replay.workflow.ts`](dead-letter-replay.workflow.ts) |

```mermaid
flowchart LR
  n1cdh6b3(["Every 15 minutes"])
  nubhe96[/"Fetch pending"/]
  n12bcq1r{"Anything parked?"}
  n1qk8jp4["One at a time"]
  n13twwe[/"Replay"/]
  n1bsctte[/"Mark replayed"/]
  ny6ql3a["Count the attempt"]
  noto20m[/"Record the attempt"/]
  nyny17e{"Given up?"}
  nzd66hl[/"Escalate"/]
  n1pcqira["Nothing to do"]
  n1jic26k["All replayed"]
  n1cdh6b3 --> nubhe96
  nubhe96 --> n12bcq1r
  n12bcq1r -->|yes| n1qk8jp4
  n12bcq1r -->|no| n1pcqira
  n1qk8jp4 -->|done| n1jic26k
  n1qk8jp4 -->|each| n13twwe
  n13twwe --> n1bsctte
  n1bsctte --> n1qk8jp4
  n13twwe -->|failed| ny6ql3a
  ny6ql3a --> noto20m
  noto20m --> nyny17e
  nyny17e -->|yes| nzd66hl
  nzd66hl --> n1qk8jp4
  nyny17e -->|no| n1qk8jp4
```

**How it runs**

1. **On a timer.** Every fifteen minutes it asks the datastore for parked work.
2. **One at a time.** Each item is sent back to the address that can redo it. One slow item does not hold the others.
3. **Five attempts, then a person.** A failed replay is counted. At five the item is abandoned and escalated.

**Tested behaviour**

- replays pending items and marks them
- abandons after the fifth failure and escalates
- does nothing when nothing is parked

## Reliability · Heartbeat monitor

Notices the failure nobody reports: a scheduled workflow that silently stopped running. Each one checks in, and this alerts when a check-in is overdue.

| | |
|---|---|
| Starts from | Schedule |
| Talks to | Datastore, Chat |
| Calls | `error-handler` |
| Files | [`heartbeat-monitor.json`](heartbeat-monitor.json) · [`heartbeat-monitor.workflow.ts`](heartbeat-monitor.workflow.ts) |

```mermaid
flowchart LR
  n17e3ltc(["Every hour"])
  nzoldq2[/"Read heartbeats"/]
  n1oza5o1["Find the overdue"]
  n4d13md[/"Alert"/]
  n17e3ltc --> nzoldq2
  nzoldq2 --> n1oza5o1
  n1oza5o1 --> n4d13md
```

**How it runs**

1. **Workflows check in.** Each scheduled workflow writes a timestamp when it finishes.
2. **Silence is measured.** A check-in older than the workflow's own allowed gap is overdue.
3. **One alert per silent workflow.** Nothing overdue means nothing is sent.

**Tested behaviour**

- alerts for a workflow that went quiet
- stays quiet when everything checked in
