# Blocks · Notify

3 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · Event to a chat message

Turns any event into one readable chat message.

| | |
|---|---|
| Starts from | Webhook |
| Platforms | Chat |
| Nodes | 2 |
| Calls | `error-handler` |
| Files | [`block-webhook-to-chat.json`](block-webhook-to-chat.json) · [`block-webhook-to-chat.workflow.ts`](block-webhook-to-chat.workflow.ts) |

```mermaid
flowchart LR
  n4fenrn(["Event"])
  n9q64kk[/"Post it"/]
  n4fenrn --> n9q64kk
```

**Tested behaviour**

- posts the title and text

## Block · One event, three channels

Sends the same message by chat, email and SMS, where each channel failing leaves the other two untouched.

| | |
|---|---|
| Starts from | Called by another workflow |
| Platforms | Chat, Email, SMS |
| Nodes | 5 |
| Calls | `error-handler` |
| Files | [`block-fan-out.json`](block-fan-out.json) · [`block-fan-out.workflow.ts`](block-fan-out.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n53jsv[/"Chat"/]
  n4f8tsl[/"Email"/]
  n68cy[/"SMS"/]
  n13tziz["Report"]
  nxyuboc --> n53jsv
  n53jsv --> n4f8tsl
  n4f8tsl --> n68cy
  n68cy --> n13tziz
```

**Tested behaviour**

- sends all three
- an email outage does not stop chat or SMS

## Block · Templated email

One place to send an email from: fills a template, refuses to send with a placeholder left unfilled.

| | |
|---|---|
| Starts from | Called by another workflow |
| Platforms | Email |
| Nodes | 6 |
| Calls | `error-handler` |
| Files | [`block-template-email.json`](block-template-email.json) · [`block-template-email.workflow.ts`](block-template-email.workflow.ts) |

```mermaid
flowchart LR
  nxyuboc(["When called"])
  n129u45b["Fill the template"]
  nfzn63a{"Ready to send?"}
  n5dpnz[/"Send"/]
  n5dpof["Sent"]
  np71n6z["Held back"]
  nxyuboc --> n129u45b
  n129u45b --> nfzn63a
  nfzn63a -->|yes| n5dpnz
  n5dpnz --> n5dpof
  nfzn63a -->|no| np71n6z
```

**Tested behaviour**

- fills and sends
- holds back an email with a blank placeholder
