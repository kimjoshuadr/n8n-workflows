# Blocks · Intake

3 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Block · Webhook to a table

The smallest useful workflow: receive a form post, keep the fields you named, store a row, answer the sender.

- **Starts from:** Webhook
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 4
- **Calls:** `error-handler`
- **Files:** [`block-webhook-to-table.json`](block-webhook-to-table.json) · [`block-webhook-to-table.workflow.ts`](block-webhook-to-table.workflow.ts)

```mermaid
flowchart LR
  nycnyc4(["Form posted"])
  n4zw59m["Keep known fields"]
  nzn8x45["Store the row"]
  n23b0ds(["Thanks"])
  nycnyc4 --> n4zw59m
  n4zw59m --> nzn8x45
  nzn8x45 --> n23b0ds
```

**Tested behaviour**

- stores named fields and drops the rest

## Block · Webhook with a shared secret

Refuses any request that does not carry the secret header, before doing anything else.

- **Starts from:** Webhook
- **Platforms:** none, logic only
- **Nodes:** 4
- **Calls:** `error-handler`
- **Files:** [`block-webhook-secret.json`](block-webhook-secret.json) · [`block-webhook-secret.workflow.ts`](block-webhook-secret.workflow.ts)

```mermaid
flowchart LR
  n6gaiq5(["Incoming"])
  n1j66rmb{"Has the secret?"}
  n74z(["OK"])
  ny5fhs9(["Refused"])
  n6gaiq5 --> n1j66rmb
  n1j66rmb -->|yes| n74z
  n1j66rmb -->|no| ny5fhs9
```

**Tested behaviour**

- accepts the right secret
- refuses a wrong one

## Block · Validate and answer with field errors

Checks a payload against simple rules and answers with exactly which fields were wrong, so the form can show it.

- **Starts from:** Webhook
- **Platforms:** none, logic only
- **Nodes:** 5
- **Calls:** `error-handler`
- **Files:** [`block-validate-respond.json`](block-validate-respond.json) · [`block-validate-respond.workflow.ts`](block-validate-respond.workflow.ts)

```mermaid
flowchart LR
  ng5pm0k(["Submitted"])
  nagfwcn["Check the fields"]
  n2xqlyi{"Valid?"}
  n14g64lq(["Accepted"])
  n10gaf3s(["Field errors"])
  ng5pm0k --> nagfwcn
  nagfwcn --> n2xqlyi
  n2xqlyi -->|yes| n14g64lq
  n2xqlyi -->|no| n10gaf3s
```

**Tested behaviour**

- names each wrong field
- accepts a good payload
