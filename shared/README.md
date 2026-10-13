# Reliability kit

**What every other workflow leans on when something fails.**

**The problem.** Automations fail silently: a webhook arrives twice, an API is down, a schedule stops.

**What this does about it.** Failures are caught, alerted once, parked for replay and noticed even when the failure is that nothing ran.

6 workflows, 16 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Reliability · Error handler

Catches a failure in any workflow, logs it to Supabase, and alerts Slack once per distinct error per hour so a broken loop cannot flood the channel.

- **Starts from:** A failure in any workflow
- **Platforms:** <img src="../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 7
- **Calls:** nothing
- **Files:** [`error-handler.json`](error-handler.json) · [`error-handler.workflow.ts`](error-handler.workflow.ts)

```mermaid
flowchart LR
  nha3ywx(["On workflow error"])
  njrcfql["Describe the failure"]
  ni022uu["Log the error"]
  ngpp5uf["Alert the team"]
  n1wflfvb{"Seen this hour?"}
  nexqywc["Already alerted"]
  n3e6hym["Alert anyway"]
  nha3ywx --> njrcfql
  njrcfql --> ni022uu
  ni022uu --> ngpp5uf
  ni022uu --> n1wflfvb
  n1wflfvb -->|yes| nexqywc
  n1wflfvb -->|no| n3e6hym
```

**How it runs**

1. **A workflow fails.** Every workflow in the library names this one as its error workflow, so a failure anywhere arrives here.
2. **It is logged once.** The error is written to Supabase with a fingerprint of workflow, node, message and hour. A unique constraint refuses a repeat inside the hour.
3. **Slack hears about it once.** Only a new fingerprint posts an alert, so a loop failing a thousand times is one message. If the log itself is down, the alert still goes.

**Tested behaviour**

- a new failure is logged and alerted
- the same failure inside the hour is not alerted twice
- an alert still goes when the log is down

## Reliability · Idempotency guard

Answers one question for a caller: has this event been handled before? Webhooks are delivered more than once; a unique key in Supabase is what makes that safe.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 7
- **Calls:** `error-handler`
- **Files:** [`idempotency-guard.json`](idempotency-guard.json) · [`idempotency-guard.workflow.ts`](idempotency-guard.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1rujfzr["Build the key"]
  ni91imd["Claim the key"]
  nyet6sk["First time"]
  nlgficz{"Already claimed?"}
  nk43iv1["Seen before"]
  n11bslat(("Could not check"))
  nxyuboc --> n1rujfzr
  n1rujfzr --> ni91imd
  ni91imd --> nyet6sk
  ni91imd --> nlgficz
  nlgficz -->|yes| nk43iv1
  nlgficz -->|no| n11bslat
```

**How it runs**

1. **A caller asks.** It passes a scope and a key: an order id, a payment event id, a lead's email.
2. **The key is claimed in Supabase.** One insert against a unique constraint. The database decides, so two runs at the same moment cannot both win.
3. **A refused insert is read carefully.** Refused because the key exists means duplicate. Refused for any other reason stops the caller: an outage is never mistaken for 'already handled'.

**Tested behaviour**

- a first event is not a duplicate
- a repeat is a duplicate
- a database outage stops the caller and is not read as a duplicate

## Reliability · Notify

The one place alerts leave from. Posts to Slack, and falls back to a SendGrid email when Slack is down, so an outage cannot hide its own alert.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack &nbsp;·&nbsp; <img src="../assets/platforms/sendgrid.svg" width="16" height="16" alt=""> SendGrid
- **Nodes:** 6
- **Calls:** `error-handler`
- **Files:** [`notify.json`](notify.json) · [`notify.workflow.ts`](notify.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  nvx0wwb["Compose"]
  ns97jno["Post to Slack"]
  n1chjvu["Delivered by Slack"]
  no9yad3["Email instead"]
  n1mehp2["Delivered by email"]
  nxyuboc --> nvx0wwb
  nvx0wwb --> ns97jno
  ns97jno --> n1chjvu
  ns97jno --> no9yad3
  no9yad3 --> n1mehp2
```

**How it runs**

1. **Something needs saying.** Any workflow calls this with a text and a level. No other workflow talks to Slack for alerts.
2. **Slack first.** Three attempts, a second apart.
3. **SendGrid if Slack is down.** A failure after the retries takes the second output and the alert still arrives, by email.

**Tested behaviour**

- posts to Slack
- falls back to email when Slack stays down
- recovers when Slack fails once

## Reliability · Dead letter

Keeps the payload of work that could not be finished in Supabase, with the reason, so nothing is lost when a platform is down.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 4
- **Calls:** `error-handler`
- **Files:** [`dead-letter.json`](dead-letter.json) · [`dead-letter.workflow.ts`](dead-letter.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1j9uypc["Wrap the payload"]
  n32tvkq["Park it"]
  n1isjvc["Say so"]
  nxyuboc --> n1j9uypc
  n1j9uypc --> n32tvkq
  n32tvkq --> n1isjvc
```

**How it runs**

1. **Work could not be finished.** A caller hands over the payload, where it came from and why it failed.
2. **It is parked, not dropped.** The payload is stored in Supabase as pending, with the address that can replay it.
3. **Slack is told.** The alert is best effort: parking has already succeeded.

**Tested behaviour**

- parks the payload as pending
- still parks when Slack cannot be reached

## Reliability · Dead letter replay

Every fifteen minutes, sends parked work back to where it came from. Gives up after five attempts and tells Slack.

- **Starts from:** Schedule
- **Platforms:** <img src="../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 12
- **Calls:** `error-handler`
- **Files:** [`dead-letter-replay.json`](dead-letter-replay.json) · [`dead-letter-replay.workflow.ts`](dead-letter-replay.workflow.ts)

```mermaid
flowchart LR
  n1cdh6b3(["Every 15 minutes"])
  nubhe96["Fetch pending"]
  n12bcq1r{"Anything parked?"}
  n1qk8jp4["One at a time"]
  n13twwe[/"Replay"/]
  n1bsctte["Mark replayed"]
  ny6ql3a["Count the attempt"]
  noto20m["Record the attempt"]
  nyny17e{"Given up?"}
  nzd66hl["Escalate"]
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

1. **On a timer.** Every fifteen minutes it asks Supabase for parked work.
2. **One at a time.** Each item is sent back to the address that can redo it. One slow item does not hold the others.
3. **Five attempts, then a person.** A failed replay is counted. At five the item is abandoned and escalated in Slack.

**Tested behaviour**

- replays pending items and marks them
- abandons after the fifth failure and escalates
- does nothing when nothing is parked

## Reliability · Heartbeat monitor

Notices the failure nobody reports: a scheduled workflow that silently stopped running. Each one checks in to Supabase, and this alerts Slack when a check-in is overdue.

- **Starts from:** Schedule
- **Platforms:** <img src="../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 4
- **Calls:** `error-handler`
- **Files:** [`heartbeat-monitor.json`](heartbeat-monitor.json) · [`heartbeat-monitor.workflow.ts`](heartbeat-monitor.workflow.ts)

```mermaid
flowchart LR
  n17e3ltc(["Every hour"])
  nzoldq2["Read heartbeats"]
  n1oza5o1["Find the overdue"]
  n4d13md["Alert"]
  n17e3ltc --> nzoldq2
  nzoldq2 --> n1oza5o1
  n1oza5o1 --> n4d13md
```

**How it runs**

1. **Workflows check in.** Each scheduled workflow writes a timestamp to Supabase when it finishes.
2. **Silence is measured.** A check-in older than the workflow's own allowed gap is overdue.
3. **One Slack alert per silent workflow.** Nothing overdue means nothing is sent.

**Tested behaviour**

- alerts for a workflow that went quiet
- stays quiet when everything checked in
