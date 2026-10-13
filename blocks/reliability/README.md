# Blocks · Reliability

4 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · Retry with growing waits

Calls an address up to four times, waiting longer each time, and reports clearly whether it finally worked.

- **Starts from:** Called by another workflow
- **Platforms:** none, logic only
- **Nodes:** 8
- **Calls:** `error-handler`
- **Files:** [`block-retry-backoff.json`](block-retry-backoff.json) · [`block-retry-backoff.workflow.ts`](block-retry-backoff.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n4dggki["Begin"]
  n6a0k[/"Try"/]
  n3ml847["Worked"]
  n1s40cli["Again?"]
  n4dxkmd{"Attempts left?"}
  n13yvm59["Back off"]
  nd3ks97["Gave up"]
  nxyuboc --> n4dggki
  n4dggki --> n6a0k
  n6a0k --> n3ml847
  n6a0k -->|failed| n1s40cli
  n1s40cli --> n4dxkmd
  n4dxkmd -->|yes| n13yvm59
  n13yvm59 --> n6a0k
  n4dxkmd -->|no| nd3ks97
```

**Tested behaviour**

- succeeds on the third attempt
- gives up after four

## Block · Failed call to dead letter

The pattern for any write that must not be lost: try, and if it still fails after retries, park the payload.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/hubspot.svg" width="16" height="16" alt=""> HubSpot
- **Nodes:** 5
- **Calls:** `dead-letter`, `error-handler`
- **Files:** [`block-error-to-dead-letter.json`](block-error-to-dead-letter.json) · [`block-error-to-dead-letter.workflow.ts`](block-error-to-dead-letter.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n4p8hlk[/"Write"/]
  n16piplc["Written"]
  n5giy9["Wrap"]
  n32tvkq[["Park it"]]
  nxyuboc --> n4p8hlk
  n4p8hlk --> n16piplc
  n4p8hlk -->|failed| n5giy9
  n5giy9 --> n32tvkq
```

**Tested behaviour**

- writes when the service is up
- parks the payload when it stays down

## Block · Limit actions per key per hour

Answers whether a key (a user, an IP, a customer) is still under its hourly limit, and counts the attempt.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 6
- **Calls:** `error-handler`
- **Files:** [`block-throttle.json`](block-throttle.json) · [`block-throttle.workflow.ts`](block-throttle.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n17xnp7j["This hour's bucket"]
  nldq4d["Read the count"]
  n1ti2wcv["Decide"]
  ny6ql3a[/"Count the attempt"/]
  n1s86opx["Answer"]
  nxyuboc --> n17xnp7j
  n17xnp7j --> nldq4d
  nldq4d --> n1ti2wcv
  n1ti2wcv --> ny6ql3a
  ny6ql3a --> n1s86opx
```

**Tested behaviour**

- allows up to the limit, then refuses

## Block · Wait for a person's yes

Records a pending decision and gives back approve and reject links. Nothing proceeds until one is pressed, and each link works once.

- **Starts from:** Webhook
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 6
- **Calls:** `error-handler`
- **Files:** [`block-approval-gate.json`](block-approval-gate.json) · [`block-approval-gate.workflow.ts`](block-approval-gate.workflow.ts)

```mermaid
flowchart LR
  ngegbnb(["Decision link"])
  ng29arw["Read the link"]
  nodb587["Resolve if still pending"]
  nryvszu{"Resolved now?"}
  n23b0ds(["Thanks"])
  nsrr7wl(["Link no longer valid"])
  ngegbnb --> ng29arw
  ng29arw --> nodb587
  nodb587 --> nryvszu
  nryvszu -->|yes| n23b0ds
  nryvszu -->|no| nsrr7wl
```

**Tested behaviour**

- a link works once
- an unknown token is refused
