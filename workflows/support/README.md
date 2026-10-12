# Workflows · Support

2 workflows. Each one is tested against a real n8n; the cases are listed under it.

## Support · SLA breach watch

Every ten minutes, finds tickets about to miss their first-response time, warns the owner, and escalates the ones that already have. Each ticket is raised once per stage.

| | |
|---|---|
| Starts from | Schedule |
| Talks to | Helpdesk, Chat |
| Calls | `notify`, `error-handler` |
| Files | [`sla-watch.json`](sla-watch.json) · [`sla-watch.workflow.ts`](sla-watch.workflow.ts) |

```mermaid
flowchart LR
  n1jrt6ay(["Every 10 minutes"])
  njq7ijo[/"Unanswered tickets"/]
  n1cbs8tt["Measure against the SLA"]
  n1hcaqlf[/"Remember the stage"/]
  nq77zl1["Write the alert"]
  n6wxc06[["Raise it"]]
  n1jrt6ay --> njq7ijo
  njq7ijo --> n1cbs8tt
  n1cbs8tt --> n1hcaqlf
  n1hcaqlf --> nq77zl1
  nq77zl1 --> n6wxc06
```

**How it runs**

1. **Tickets with no reply yet.** Checked every ten minutes.
2. **Measured against their own limit.** Urgent tickets have 30 minutes, low ones a day. Three quarters of the way there is 'at risk'.
3. **Raised once per stage.** The stage is written on the ticket, so the next run stays quiet until it gets worse.

**Tested behaviour**

- warns at three quarters and escalates a miss
- does not repeat a stage already raised

## Support · Inbox triage and first reply

Sorts the shared inbox: answers the handful of questions that have a fixed answer, files newsletters and receipts, and leaves everything else for a person.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | LLM, Email, Helpdesk |
| Calls | `error-handler` |
| Files | [`email-autoresponder.json`](email-autoresponder.json) · [`email-autoresponder.workflow.ts`](email-autoresponder.workflow.ts) |

```mermaid
flowchart LR
  njpc3ik(["Email received"])
  nmfmdm["Read the email"]
  n1e03a2k{"From a person?"}
  n10awmnk[/"Archive it"/]
  n1ee88yq[/"What is it asking?"/]
  nl8ilta["Read the intent"]
  ne3q9me{"A fixed-answer question?"}
  n1qwayuf[/"Send the standard reply"/]
  nwhlkm0[/"Label as answered"/]
  nlhr4ij[/"Leave for a person"/]
  njpc3ik --> nmfmdm
  nmfmdm --> n1e03a2k
  n1e03a2k -->|yes| n1ee88yq
  n1ee88yq --> nl8ilta
  nl8ilta --> ne3q9me
  ne3q9me -->|yes| n1qwayuf
  n1qwayuf --> nwhlkm0
  n1e03a2k -->|no| n10awmnk
  ne3q9me -->|no| nlhr4ij
```

**How it runs**

1. **Mail arrives in the shared inbox.** Newsletters, receipts and bounces are spotted from their headers and archived without a model call.
2. **A model reads the rest.** It may pick one of three fixed-answer questions, and only when the email is plainly asking that.
3. **Fixed questions get the fixed answer.** The reply is a template a person wrote. The model chooses it and never writes it.
4. **Everything else becomes a ticket.** Including anything the model was unsure about, and everything when the model is down.

**Tested behaviour**

- a plain opening-hours question gets the template
- an unsure classification goes to a person
- a newsletter is archived without a model call
- everything goes to a person while the model is down
