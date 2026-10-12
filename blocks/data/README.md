# Blocks · Data

7 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · CSV text to rows

Parses CSV text properly, including quoted commas and blank lines, into one item per row.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | nothing external |
| Calls | `error-handler` |
| Files | [`block-csv-to-rows.json`](block-csv-to-rows.json) · [`block-csv-to-rows.workflow.ts`](block-csv-to-rows.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n4l39bg["Parse"]
  nxyuboc --> n4l39bg
```

**Tested behaviour**

- handles quoted commas, escaped quotes and blank lines

## Block · Has this changed since last time?

Compares a record with the copy stored last run and reports which fields changed, so downstream work only happens on a real change.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | Datastore |
| Calls | `error-handler` |
| Files | [`block-change-detect.json`](block-change-detect.json) · [`block-change-detect.workflow.ts`](block-change-detect.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n16punaw[/"Last copy"/]
  nvx0mhq["Compare"]
  n18eqddd[/"Store this copy"/]
  n1s86opx["Answer"]
  nxyuboc --> n16punaw
  n16punaw --> nvx0mhq
  nvx0mhq --> n18eqddd
  n18eqddd --> n1s86opx
```

**Tested behaviour**

- names the field that changed
- an identical record is no change

## Block · Convert a currency amount

Converts an amount with today's rate, rounds like money, and says so when the rate could not be fetched instead of returning a wrong number.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | Rates |
| Calls | `error-handler` |
| Files | [`block-currency-convert.json`](block-currency-convert.json) · [`block-currency-convert.workflow.ts`](block-currency-convert.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  na39e3e[/"Today's rate"/]
  nvxobzg["Convert"]
  nxyuboc --> na39e3e
  na39e3e --> nvxobzg
```

**Tested behaviour**

- converts and rounds to cents
- admits when there is no rate

## Block · Clean text into a URL slug

Turns any title into a safe, readable URL slug, including accented and non-Latin titles.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | nothing external |
| Calls | `error-handler` |
| Files | [`block-slugify.json`](block-slugify.json) · [`block-slugify.workflow.ts`](block-slugify.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n1gd4wh6["Slugify"]
  nxyuboc --> n1gd4wh6
```

**Tested behaviour**

- handles accents, symbols and empty results

## Block · Yesterday, in the business's time zone

Works out the start and end of 'yesterday' or 'last week' in a named time zone, which is where most reporting bugs come from.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | nothing external |
| Calls | `error-handler` |
| Files | [`block-date-window.json`](block-date-window.json) · [`block-date-window.workflow.ts`](block-date-window.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n3j7ro7["Window"]
  nxyuboc --> n3j7ro7
```

**Tested behaviour**

- Manila's yesterday is not UTC's yesterday

## Block · Incremental sync with a bookmark

The skeleton of every reliable sync: read the bookmark, fetch what is newer, write it, and only then move the bookmark.

| | |
|---|---|
| Starts from | Manual run |
| Talks to | Datastore, CRM |
| Calls | `error-handler` |
| Files | [`block-cursor-sync.json`](block-cursor-sync.json) · [`block-cursor-sync.workflow.ts`](block-cursor-sync.workflow.ts) |

```mermaid
flowchart LR
  n14dx75b(["Run manually"])
  nw26cop[/"Read bookmark"/]
  nrf8an4[/"Fetch newer"/]
  n91pc9a["Newest id"]
  nqlf16e{"Anything new?"}
  nqjsjj5[/"Write rows"/]
  nikzyzi[/"Move bookmark"/]
  n1hdwi6t["Up to date"]
  n14dx75b --> nw26cop
  nw26cop --> nrf8an4
  nrf8an4 --> n91pc9a
  n91pc9a --> nqlf16e
  nqlf16e -->|yes| nqjsjj5
  nqjsjj5 --> nikzyzi
  nqlf16e -->|no| n1hdwi6t
```

**Tested behaviour**

- moves the bookmark to the newest id
- leaves the bookmark when nothing is new

## Block · Save a remote file to storage

Records a file under a name derived from its own address, so the same file fetched twice is stored once.

| | |
|---|---|
| Starts from | Called by another workflow |
| Talks to | Storage, Datastore |
| Calls | `error-handler` |
| Files | [`block-file-to-storage.json`](block-file-to-storage.json) · [`block-file-to-storage.workflow.ts`](block-file-to-storage.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n18oak7t["Name it"]
  n1wkkh7p[/"Claim the name"/]
  n1b7eoos{"New file?"}
  n1gs9t96[/"Copy to storage"/]
  n157k40i["Already stored"]
  nxyuboc --> n18oak7t
  n18oak7t --> n1wkkh7p
  n1wkkh7p --> n1b7eoos
  n1b7eoos -->|yes| n1gs9t96
  n1b7eoos -->|no| n157k40i
```

**Tested behaviour**

- the same address is copied once
