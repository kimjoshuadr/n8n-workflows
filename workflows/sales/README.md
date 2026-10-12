# Workflows · Sales

5 workflows. Each one is tested against a real n8n; the cases are listed under it.

## CRM · Enrich new contacts

Fills in company, role and size for a new CRM contact from an enrichment service, and never overwrites what a person already typed.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | Enrichment, CRM |
| Calls | `error-handler` |
| Files | [`contact-enrichment.json`](contact-enrichment.json) · [`contact-enrichment.workflow.ts`](contact-enrichment.workflow.ts) |

```mermaid
flowchart LR
  n1qydrs1(["Contact created"])
  n2eqsr2["Read the contact"]
  nyhsxhn{"Work email?"}
  n1txkk79[/"Look them up"/]
  n1cq5gb["Only the blanks"]
  nvd6z7w{"Anything to add?"}
  nbg2io1[/"Update the contact"/]
  n66qtbt["Personal email, skipped"]
  nnsftqe["Nothing new"]
  nv50xcf["Lookup failed, left as is"]
  n1qydrs1 --> n2eqsr2
  n2eqsr2 --> nyhsxhn
  nyhsxhn -->|yes| n1txkk79
  n1txkk79 --> n1cq5gb
  n1cq5gb --> nvd6z7w
  nvd6z7w -->|yes| nbg2io1
  nyhsxhn -->|no| n66qtbt
  n1txkk79 -->|failed| nv50xcf
  nvd6z7w -->|no| nnsftqe
```

**How it runs**

1. **A contact is created.** Personal email addresses are skipped: there is no company to find and the lookup costs money.
2. **They are looked up.** A failed lookup leaves the contact exactly as it was.
3. **Only blank fields are filled.** Anything a person already entered wins over the enrichment service.

**Tested behaviour**

- fills blanks and keeps what was typed
- skips a personal address without a lookup
- a failed lookup changes nothing

## CRM · Meeting notes and next steps

Turns a call transcript into a CRM note and dated follow-up tasks, and asks a person when it cannot tell who owns a task.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | LLM, CRM, Chat |
| Calls | `notify`, `error-handler` |
| Files | [`meeting-notes-to-crm.json`](meeting-notes-to-crm.json) · [`meeting-notes-to-crm.workflow.ts`](meeting-notes-to-crm.workflow.ts) |

```mermaid
flowchart LR
  n1610stc(["Transcript ready"])
  nb9sirs["Read the transcript"]
  n1d0070z{"Enough to summarise?"}
  n1tn3m9m[/"Extract"/]
  nrffov["Read the notes"]
  n1r13jew{"Readable?"}
  nbha9ex[/"Add the CRM note"/]
  nre2kxx["One item per action"]
  n1jzfx4i{"Has an owner?"}
  n1s5o8s1[/"Create the task"/]
  n11m6dn0["Unowned message"]
  najd3xb[["Ask who owns them"]]
  n1qct5g7["Unreadable message"]
  n1ak1nrh[["Flag for a manual read"]]
  n1hyi4ii["Too short to summarise"]
  n1610stc --> nb9sirs
  nb9sirs --> n1d0070z
  n1d0070z -->|yes| n1tn3m9m
  n1tn3m9m --> nrffov
  nrffov --> n1r13jew
  n1r13jew -->|yes| nbha9ex
  nbha9ex --> nre2kxx
  nre2kxx --> n1jzfx4i
  n1jzfx4i -->|yes| n1s5o8s1
  n1d0070z -->|no| n1hyi4ii
  n1r13jew -->|no| n1qct5g7
  n1qct5g7 --> n1ak1nrh
  n1jzfx4i -->|no| n11m6dn0
  n11m6dn0 --> najd3xb
```

**How it runs**

1. **A call ends.** A transcript of a few words is a missed call, not a meeting, and is left alone.
2. **Summary, decisions, actions.** Extracted as structured data. An unreadable reply is flagged for a manual read.
3. **The deal gets its note.** The summary and decisions are attached to the deal.
4. **Actions become tasks.** Owned actions become dated tasks. Unowned ones are sent to the team to assign, in one message.

**Tested behaviour**

- writes the note, creates owned tasks and asks about unowned ones
- a near-empty transcript is left alone
- an unreadable reply is flagged

## Reviews · Ask after delivery

A week after an order is delivered, asks for a review once. Customers with an open support conversation are not asked.

| | |
|---|---|
| Starts from | Schedule |
| Talks to | Datastore, Email |
| Calls | `error-handler` |
| Files | [`review-request.json`](review-request.json) · [`review-request.workflow.ts`](review-request.workflow.ts) |

```mermaid
flowchart LR
  n1gbpr4d(["10:00 daily"])
  nf6ajoo[/"Delivered orders"/]
  n1dockn3["Delivered a week ago"]
  n1hlg6ct[/"Open conversation?"/]
  ne9gbr2["Happy customers only"]
  n1i35a70[/"Ask for a review"/]
  nnkd1kc[/"Mark asked"/]
  n1gbpr4d --> nf6ajoo
  nf6ajoo --> n1dockn3
  n1dockn3 --> n1hlg6ct
  n1hlg6ct --> ne9gbr2
  ne9gbr2 --> n1i35a70
  n1i35a70 --> nnkd1kc
```

**How it runs**

1. **A week after delivery.** Long enough to have used it, recent enough to remember.
2. **Not while there is a complaint open.** Asking someone with an unresolved problem for a review is how bad reviews happen.
3. **Asked once.** The order is marked as soon as the email goes.

**Tested behaviour**

- asks once for a week-old delivery
- does not ask a customer with an open conversation
- waits for the week to pass

## Feedback · Route survey scores

Sends each survey score where it is useful: unhappy customers to a person today, happy ones to a review request, and every score to the record.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | Datastore, Helpdesk, Email, Chat |
| Calls | `notify`, `error-handler` |
| Files | [`nps-router.json`](nps-router.json) · [`nps-router.workflow.ts`](nps-router.workflow.ts) |

```mermaid
flowchart LR
  n1srs3j0(["Survey answered"])
  ntyneo["Read the score"]
  nqtm42b[/"Record it"/]
  n1cjieui{"Which group?"}
  nb970my[/"Open a ticket"/]
  n4hupti["Detractor message"]
  nzg2gll[["Tell customer success"]]
  n16i6jb4[/"Invite a public review"/]
  nie2dsl["Recorded only"]
  n1srs3j0 --> ntyneo
  ntyneo --> nqtm42b
  nqtm42b --> n1cjieui
  n1cjieui -->|yes| nb970my
  nb970my --> n4hupti
  n4hupti --> nzg2gll
  n1cjieui -->|no| n16i6jb4
  n1cjieui -->|no| nie2dsl
```

**How it runs**

1. **A score comes in.** 0 to 10, with an optional comment. Every one is recorded before anything else.
2. **6 or under: a person, today.** A high-priority ticket and a message with the customer's own words.
3. **9 or 10: ask them to say it publicly.** The best moment to ask for a review is right after someone volunteers that they are happy.
4. **7 or 8: just the record.** No email, no ticket.

**Tested behaviour**

- a low score opens a ticket and tells the team
- a top score gets a review invite
- a middling score is only recorded
- an impossible score fails loudly

## Events · Webinar registration and reminders

Registers someone for a webinar, sends the calendar invite, and reminds them a day and an hour before. Full sessions get a waitlist reply.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | Datastore, Email |
| Calls | `error-handler` |
| Files | [`webinar-registration.json`](webinar-registration.json) · [`webinar-registration.workflow.ts`](webinar-registration.workflow.ts) |

```mermaid
flowchart LR
  nhg7o80(["Registration"])
  ng25lee["Read the form"]
  n2xqlyi{"Valid?"}
  n1clxfxs(["Invalid"])
  nmrvbfs[/"Load the webinar"/]
  n82pjwf{"Seats left?"}
  n1sj7y6i[/"Register"/]
  neds8qr{"Newly registered?"}
  n1vflg6k[/"Count the seat"/]
  n1i4bpk9[/"Send the invite"/]
  n1w4hf6g(["Confirmed"])
  n1zwu5t(["Already registered"])
  nmv87ma[/"Add to waitlist"/]
  n15xdlg9(["Waitlisted"])
  nhg7o80 --> ng25lee
  ng25lee --> n2xqlyi
  n2xqlyi -->|yes| nmrvbfs
  nmrvbfs --> n82pjwf
  n82pjwf -->|yes| n1sj7y6i
  n1sj7y6i --> neds8qr
  neds8qr -->|yes| n1vflg6k
  n1vflg6k --> n1i4bpk9
  n1i4bpk9 --> n1w4hf6g
  n2xqlyi -->|no| n1clxfxs
  n82pjwf -->|no| nmv87ma
  nmv87ma --> n15xdlg9
  neds8qr -->|no| n1zwu5t
```

**How it runs**

1. **Someone registers.** The form gets a real answer: registered, already registered, waitlisted, or what was wrong.
2. **Seats are checked.** A full session puts the person on the waitlist instead of turning them away.
3. **One seat per person.** Registering twice takes one seat and sends one invite.
4. **The invite goes out.** With the calendar file, so it lands in their diary.

**Tested behaviour**

- registers, counts the seat and sends the invite
- registering twice takes one seat
- a full session waitlists
- a bad email is a 400
