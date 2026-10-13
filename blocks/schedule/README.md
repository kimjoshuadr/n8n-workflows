# Blocks · Schedule

3 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · Scheduled count to chat

Every morning, counts yesterday's rows in a table and posts the number.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/slack.svg" width="16" height="16" alt=""> Slack
- **Nodes:** 4
- **Calls:** `error-handler`
- **Files:** [`block-scheduled-report.json`](block-scheduled-report.json) · [`block-scheduled-report.workflow.ts`](block-scheduled-report.workflow.ts)

```mermaid
flowchart LR
  n1k1kxc4(["08:00 daily"])
  nz0fvsi["Yesterday's rows"]
  n4e6xjc["Count"]
  n5c093["Post"]
  n1k1kxc4 --> nz0fvsi
  nz0fvsi --> n4e6xjc
  n4e6xjc --> n5c093
```

**Tested behaviour**

- counts rows
- reports zero and does not go silent

## Block · Check in with the heartbeat monitor

What a scheduled workflow calls when it finishes, so the heartbeat monitor can tell when it stops running.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 2
- **Calls:** `error-handler`
- **Files:** [`block-heartbeat.json`](block-heartbeat.json) · [`block-heartbeat.workflow.ts`](block-heartbeat.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  nuc14dg[/"Check in"/]
  nxyuboc --> nuc14dg
```

**Tested behaviour**

- writes a heartbeat row

## Block · Working hours gate

Tells a caller whether now is inside working hours in a given time zone, so messages to people wait for the morning.

- **Starts from:** Called by another workflow
- **Platforms:** none, logic only
- **Nodes:** 2
- **Calls:** `error-handler`
- **Files:** [`block-working-hours.json`](block-working-hours.json) · [`block-working-hours.workflow.ts`](block-working-hours.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1xt71d1["Is it working hours?"]
  nxyuboc --> n1xt71d1
```

**Tested behaviour**

- Tuesday 10:00 in Manila is open
- the same instant in New York is closed
- a Saturday is closed
