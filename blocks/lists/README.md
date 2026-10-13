# Blocks · Lists

4 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · Remove duplicates by key

Keeps the first of each item sharing a key, after normalising it, so 'A@B.co ' and 'a@b.co' count as one.

- **Starts from:** Called by another workflow
- **Platforms:** none, logic only
- **Nodes:** 2
- **Calls:** `error-handler`
- **Files:** [`block-dedupe.json`](block-dedupe.json) · [`block-dedupe.workflow.ts`](block-dedupe.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1ti3sj2["Dedupe"]
  nxyuboc --> n1ti3sj2
```

**Tested behaviour**

- treats differently-cased emails as one

## Block · Read every page of an API

Follows a cursor until the API says there is no more, with a hard stop so a broken API cannot loop forever.

- **Starts from:** Manual run
- **Platforms:** <img src="../../assets/platforms/hubspot.svg" width="16" height="16" alt=""> HubSpot
- **Nodes:** 6
- **Calls:** `error-handler`
- **Files:** [`block-paginate.json`](block-paginate.json) · [`block-paginate.workflow.ts`](block-paginate.workflow.ts)

```mermaid
flowchart LR
  n14dx75b(["Run manually"])
  n4n2f8b["Start"]
  n1pk941n[/"Fetch a page"/]
  nxwjf95["Keep going?"]
  nlpf2xr{"More pages?"}
  n1e2jkfy["All pages"]
  n14dx75b --> n4n2f8b
  n4n2f8b --> n1pk941n
  n1pk941n --> nxwjf95
  nxwjf95 --> nlpf2xr
  nlpf2xr -->|yes| n1pk941n
  nlpf2xr -->|no| n1e2jkfy
```

**Tested behaviour**

- stops when there is no next cursor

## Block · Loop that respects a rate limit

Sends items in small batches with a pause between them, for APIs that reject bursts.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/sendgrid.svg" width="16" height="16" alt=""> SendGrid
- **Nodes:** 5
- **Calls:** `error-handler`
- **Files:** [`block-rate-limited-loop.json`](block-rate-limited-loop.json) · [`block-rate-limited-loop.workflow.ts`](block-rate-limited-loop.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  nrg1xgy["Five at a time"]
  n5dpnz["Send"]
  n4l3bjj["Pause"]
  n1st2q3d["Finished"]
  nxyuboc --> nrg1xgy
  nrg1xgy -->|done| n1st2q3d
  nrg1xgy -->|each| n5dpnz
  n5dpnz --> n4l3bjj
  n4l3bjj --> nrg1xgy
```

**Tested behaviour**

- sends every item across batches

## Block · Upsert in chunks

Groups a long list into chunks of 100 and upserts each chunk in one request.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 3
- **Calls:** `error-handler`
- **Files:** [`block-batch-upsert.json`](block-batch-upsert.json) · [`block-batch-upsert.workflow.ts`](block-batch-upsert.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n4e2gme["Chunk"]
  n1rs7fjo[/"Upsert the chunk"/]
  nxyuboc --> n4e2gme
  n4e2gme --> n1rs7fjo
```

**Tested behaviour**

- 250 rows become three requests and update on repeat
