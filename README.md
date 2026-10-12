# n8n workflows, built to stay up

[![Test](https://github.com/kimjoshuadr/n8n-workflows/actions/workflows/test.yml/badge.svg)](https://github.com/kimjoshuadr/n8n-workflows/actions/workflows/test.yml)

75 n8n workflows, written as code and run against a real n8n: 26 that make up eight complete systems, 21 single-purpose production workflows, and 28 building blocks.

Most workflow collections show the path where everything works. These are written for the other days: the webhook that arrives twice, the API that is down, the model that replies with something unreadable, the schedule that silently stops. **201 such behaviours are tested**, each by importing the workflow into n8n, sending it input and checking what it actually did.

> **What these are.** Reference builds, written for this library and run on test data. They are not copies of any client's system, and no client data is in this repository.

## The systems

| System | What it does | Workflows |
|---|---|---|
| [Lead intake](systems/lead-intake) | An enquiry followed from the form to a booked call. | 3 |
| [Support agent](systems/support-agent) | Answers what it can, hands over what it cannot. | 3 |
| [Content pipeline](systems/content-pipeline) | Topic to published article, with a person's approval in the middle. | 3 |
| [Order operations](systems/order-ops) | An order followed from checkout to the customer's inbox. | 3 |
| [Payments](systems/payments) | Every payment recorded exactly once, and checked daily. | 3 |
| [Community operations](systems/community-ops) | Welcoming, moderating and announcing on a Discord server. | 3 |
| [Ops digest](systems/ops-digest) | The week's numbers on one screen, and an alert when one breaks. | 2 |
| [Reliability kit](shared) | What every other workflow leans on when something fails. | 6 |

Each folder has a README with a diagram of every workflow, how it runs step by step, and the behaviours it is tested for.

## Production workflows

| Area | Workflows |
|---|---|
| [Content](workflows/content) | Industry news digest, Broken link check, Keyword rank tracker, Mention monitor |
| [Commerce](workflows/commerce) | Supplier stock sync, Refund requests, Renewal reminders, Supplier invoice intake |
| [Operations](workflows/operations) | New hire onboarding, Morning agenda, CRM to email list sync, Expiry reminders |
| [Monitoring](workflows/monitoring) | Uptime checks, Backup verification |
| [Sales](workflows/sales) | Enrich new contacts, Meeting notes and next steps, Ask after delivery, Route survey scores, Webinar registration and reminders |
| [Support](workflows/support) | SLA breach watch, Inbox triage and first reply |

## Building blocks

| Kind | Blocks |
|---|---|
| [Intake](blocks/intake) | Webhook to a table, Webhook with a shared secret, Validate and answer with field errors |
| [Notify](blocks/notify) | Event to a chat message, One event, three channels, Templated email |
| [Schedule](blocks/schedule) | Scheduled count to chat, Check in with the heartbeat monitor, Working hours gate |
| [Lists](blocks/lists) | Remove duplicates by key, Read every page of an API, Loop that respects a rate limit, Upsert in chunks |
| [Reliability](blocks/reliability) | Retry with growing waits, Failed call to dead letter, Limit actions per key per hour, Wait for a person's yes |
| [Data](blocks/data) | CSV text to rows, Has this changed since last time?, Convert a currency amount, Clean text into a URL slug, Yesterday, in the business's time zone, Incremental sync with a bookmark, Save a remote file to storage |
| [Ai](blocks/ai) | A model reply you can rely on, Mask personal data before a model sees it, Split a document into overlapping chunks, Classify, then route |

## What "built to stay up" means here

Every workflow follows the same rules, and the tests hold them to it.

- **Handled once.** Anything triggered by a webhook claims an idempotency key before it acts. A repeated delivery changes nothing.
- **Failures have somewhere to go.** External calls retry three times. Writes that must not be lost take a failure branch into a dead-letter queue, which is replayed on a timer.
- **One alert, not a thousand.** Every workflow names the same error handler, which alerts once per distinct error per hour. Alerts fall back to email when chat is down.
- **A model is never trusted with the outcome.** Model replies are parsed defensively. Arithmetic, duplicate checks and policy rules are done in code. When a model is unavailable or unsure, the work goes to a person; nothing is deleted, refunded or published on a guess.
- **State lives in the datastore.** No workflow sleeps for days. Follow-ups, reminders and escalations are short scheduled runs that read where things stand.
- **Silence is checked too.** Scheduled workflows check in, and a monitor alerts when one stops.
- **No secrets in the repository.** Services are reached through environment variables, listed in [`.env.example`](.env.example).

## Use them

**Import one by hand.** Take the `.json` next to any workflow and import it in n8n. Import [`shared/`](shared) first, then replace each `__WF:name__` placeholder with the id of that workflow in your instance.

**Or install with the script**, which does that for you:

```sh
npm ci
N8N_URL=https://your-n8n.example.com N8N_API_KEY=... npm run install-workflows -- lead-intake
```

It installs the system you name and everything it calls, in order, inactive. Leave the name off to install the whole library.

**Then set the environment.** Each workflow's sticky note lists the variables it needs. Services are called over HTTP with a base address and a key, so a workflow is not tied to one vendor: point `CRM_BASE_URL` at HubSpot, Vtiger or your own API. n8n must allow workflows to read them (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`). Where you would rather use a native n8n node and its credential, it is a one-node swap.

## Run the tests

You need Docker and Node 22.

```sh
npm ci
npm run stack:up     # a throwaway n8n and a mock of every external service
npm test             # all 201 cases
npm test -- refund   # only workflows whose id contains "refund"
npm run stack:down
```

The runner imports each workflow, sends the case's input, waits for the execution and checks which nodes ran, what each mock service received and what the datastore holds afterwards. It can make a service fail a set number of times, which is how the retry, fallback and dead-letter paths are exercised. Last full run: **201 passed, 0 failed on n8n 2.42.7** ([`test-results.json`](test-results.json)).

## How it is written

Workflows are defined in [`definitions/`](definitions) with a small vocabulary ([`lib/wf.mjs`](lib/wf.mjs)): name the nodes, then the wiring. The definition also holds the step-by-step explanation and the test cases, so the three cannot drift apart.

`npm run build` turns the definitions into:

- `<id>.json`, the importable workflow
- `<id>.workflow.ts`, the same workflow as a TypeScript file
- a README per folder, with Mermaid diagrams
- [`catalog.json`](catalog.json), the whole library as data

`npm run validate` checks every workflow against n8n's node schemas and scans for anything that looks like a secret. CI runs build, validate and the full test suite on every push.

## Licence

MIT.
