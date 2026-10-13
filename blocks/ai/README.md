# Blocks · Ai

4 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · A model reply you can rely on

Asks a model for JSON, checks the reply has the fields you need, asks once more if it does not, and then gives up honestly.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI
- **Nodes:** 8
- **Calls:** `error-handler`
- **Files:** [`block-llm-json-guard.json`](block-llm-json-guard.json) · [`block-llm-json-guard.workflow.ts`](block-llm-json-guard.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n5vxu[["Ask"]]
  np41ng4("Ask · GPT")
  n1jidkd8["Check the reply"]
  n4gdz6j{"Good?"}
  n1urqlxz{"Try once more?"}
  n2qe4f3["Usable"]
  njry0jw["Not usable"]
  nxyuboc --> n5vxu
  n5vxu --> n1jidkd8
  n1jidkd8 --> n4gdz6j
  n4gdz6j -->|yes| n2qe4f3
  n4gdz6j -->|no| n1urqlxz
  n1urqlxz -->|yes| n5vxu
  n1urqlxz -->|no| njry0jw
  np41ng4 -.-> n5vxu
```

**Tested behaviour**

- accepts a complete reply first time
- asks once more, then gives up

## Block · Mask personal data before a model sees it

Replaces emails, phone numbers and card numbers with placeholders, and hands back the map to restore them afterwards.

- **Starts from:** Called by another workflow
- **Platforms:** none, logic only
- **Nodes:** 2
- **Calls:** `error-handler`
- **Files:** [`block-pii-redact.json`](block-pii-redact.json) · [`block-pii-redact.workflow.ts`](block-pii-redact.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n13m0y0["Redact"]
  nxyuboc --> n13m0y0
```

**Tested behaviour**

- masks an email, a card and a phone

## Block · Split a document into overlapping chunks

Cuts long text into chunks that end on sentence boundaries and overlap by whole sentences, ready for embedding or a model's context window.

- **Starts from:** Called by another workflow
- **Platforms:** none, logic only
- **Nodes:** 2
- **Calls:** `error-handler`
- **Files:** [`block-chunk-text.json`](block-chunk-text.json) · [`block-chunk-text.workflow.ts`](block-chunk-text.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n4e2gme["Chunk"]
  nxyuboc --> n4e2gme
```

**Tested behaviour**

- splits on sentences and overlaps by a whole sentence

## Block · Classify, then route

Has a model put a message into one of a fixed set of labels and routes on it, with a default route for anything unexpected.

- **Starts from:** Called by another workflow
- **Platforms:** <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI
- **Nodes:** 9
- **Calls:** `error-handler`
- **Files:** [`block-classify-route.json`](block-classify-route.json) · [`block-classify-route.workflow.ts`](block-classify-route.workflow.ts)

```mermaid
flowchart LR
  nxyuboc(["When called"])
  ngdb163[["Classify"]]
  ndiiwvh("Classify · GPT")
  n1ol06tf("Classify · shape")
  nq2jc2["Read the label"]
  n5eiiaa{"By label"}
  nedqf78["Billing"]
  nyp45qu["Technical"]
  nevelep["General"]
  nxyuboc --> ngdb163
  ngdb163 --> nq2jc2
  nq2jc2 --> n5eiiaa
  n5eiiaa --> nedqf78
  n5eiiaa --> nyp45qu
  n5eiiaa --> nevelep
  ndiiwvh -.-> ngdb163
  n1ol06tf -.-> ngdb163
```

**Tested behaviour**

- routes a billing message
- an unexpected label takes the default route
- a model outage takes the default route
