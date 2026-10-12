# Lead intake

**An enquiry followed from the form to a booked call.**

**The problem.** Enquiries arrive at any hour, sit in an inbox, and the good ones go cold before anyone replies.

**What this does about it.** Every enquiry is answered in seconds, scored, filed in the CRM and followed up until it books or goes cold.

3 workflows, 14 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Lead intake · Capture and qualify

Takes an enquiry from any form, rejects junk, ignores repeats, has a model score the fit, then files it in the CRM and sends the right first reply.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | LLM, CRM, Email, Chat, Datastore |
| Calls | `idempotency-guard`, `notify`, `dead-letter`, `error-handler` |
| Files | [`lead-capture.json`](lead-capture.json) · [`lead-capture.workflow.ts`](lead-capture.workflow.ts) |

```mermaid
flowchart LR
  na6y088(["Enquiry form"])
  n1gx4olk["Validate and normalise"]
  n2xqlyi{"Valid?"}
  n13pxty(["Reject"])
  n1s1udbj(["Accept"])
  nssd3oc[["Seen today?"]]
  ndk0vlv{"New enquiry?"}
  n1ntcjch["Ignore the repeat"]
  n1yduzd9[/"Score the fit"/]
  n1riexmv["Read the verdict"]
  nem5cfb[/"Save the lead"/]
  n1ie8epc{"Which path?"}
  nwklbsx[/"Create CRM contact"/]
  n16viuuq[/"Send booking link"/]
  n7dloas[["Tell sales"]]
  naa7b4d[["Park for replay"]]
  n142sp6y[/"Send nurture email"/]
  n3pnali[["Ask a person to look"]]
  nu9z030["Sales message"]
  n20moti["Review message"]
  n1x46bex["Dead letter payload"]
  na6y088 --> n1gx4olk
  n1gx4olk --> n2xqlyi
  n2xqlyi -->|yes| n1s1udbj
  n1s1udbj --> nssd3oc
  nssd3oc --> ndk0vlv
  ndk0vlv -->|yes| n1yduzd9
  n1yduzd9 --> n1riexmv
  n1riexmv --> nem5cfb
  nem5cfb --> n1ie8epc
  n2xqlyi -->|no| n13pxty
  ndk0vlv -->|no| n1ntcjch
  n1ie8epc -->|yes| nwklbsx
  nwklbsx --> n16viuuq
  n16viuuq --> nu9z030
  nu9z030 --> n7dloas
  nwklbsx -->|failed| n1x46bex
  n1x46bex --> naa7b4d
  n1ie8epc -->|no| n142sp6y
  n1ie8epc -->|no| n20moti
  n20moti --> n3pnali
```

**How it runs**

1. **An enquiry arrives.** Any form can post here. Bad emails, empty messages and bots that fill the hidden field are turned away with a 400.
2. **The form gets its answer first.** The visitor sees success in milliseconds. Everything slower happens after the response.
3. **Repeats are ignored.** The same email on the same day is one enquiry, however many times the button was pressed.
4. **A model scores the fit.** It returns a score and a reason. If its reply cannot be read, the lead goes to a person rather than being guessed at.
5. **Three paths.** A fit goes to the CRM and gets a booking link. A poor fit gets a helpful email. Anything unclear is flagged for review.
6. **Sales is told, and nothing is lost.** If the CRM is down after three tries, the lead is parked for replay instead of disappearing.

**Tested behaviour**

- a good enquiry reaches the CRM and gets a booking link
- a poor fit gets the nurture email and no CRM record
- a bad email is rejected with a 400
- a bot filling the hidden field is rejected
- the same enquiry twice is handled once
- an unreadable model reply goes to a person
- a CRM outage parks the lead

## Lead intake · Follow up the unbooked

Each morning, writes to qualified leads who have not booked. Three nudges, two days apart, then the lead is marked cold and left alone.

| | |
|---|---|
| Starts from | Schedule |
| Talks to | Datastore, Email |
| Calls | `error-handler` |
| Files | [`lead-follow-up.json`](lead-follow-up.json) · [`lead-follow-up.workflow.ts`](lead-follow-up.workflow.ts) |

```mermaid
flowchart LR
  n1r5iigo(["Every morning"])
  nfjzwzj[/"Unbooked leads"/]
  n1kk7fa0["Who is due?"]
  n1xhp9w7{"Nudges left?"}
  nk5m1h7[/"Send the nudge"/]
  nkmhosk[/"Record the nudge"/]
  n1sx1sls[/"Mark cold"/]
  nuc14dg[/"Check in"/]
  n1r5iigo --> nfjzwzj
  nfjzwzj --> n1kk7fa0
  n1kk7fa0 --> n1xhp9w7
  n1xhp9w7 -->|yes| nk5m1h7
  nk5m1h7 --> nkmhosk
  n1xhp9w7 -->|no| n1sx1sls
  n1r5iigo --> nuc14dg
```

**How it runs**

1. **Every weekday morning.** It reads the qualified leads who have not booked, and checks in with the heartbeat monitor.
2. **Only the ones that are due.** Two days since the last contact. State lives in the datastore, so no workflow sits waiting for days.
3. **A nudge, then it is recorded.** Each of the three emails is different. The count is written back straight away.
4. **It knows when to stop.** After three, the lead is marked cold and never written to again.

**Tested behaviour**

- nudges a lead that is due and counts it
- leaves a lead contacted yesterday alone
- marks a lead cold after three nudges
- skips leads that already booked

## Lead intake · Booking sync

When a call is booked, moves the lead forward everywhere at once: the lead record, the CRM deal and the sales channel.

| | |
|---|---|
| Starts from | Webhook |
| Talks to | Calendar, Datastore, CRM, Chat |
| Calls | `idempotency-guard`, `notify`, `error-handler` |
| Files | [`lead-booking-sync.json`](lead-booking-sync.json) · [`lead-booking-sync.workflow.ts`](lead-booking-sync.workflow.ts) |

```mermaid
flowchart LR
  n1m0y7mi(["Booking created"])
  n1mrusef["Read the booking"]
  n1ja4syq[["Seen before?"]]
  nbp2ii5{"New booking?"}
  n14sy1gg[/"Mark lead booked"/]
  no98tz3{"Known lead?"}
  n2xndnh[/"Open CRM deal"/]
  ncl9lau["Booked message"]
  n7dloas[["Tell sales"]]
  n5tuhwq["Unknown message"]
  n3b5xlk[["Flag it"]]
  n15km3ql["Already handled"]
  n1m0y7mi --> n1mrusef
  n1mrusef --> n1ja4syq
  n1ja4syq --> nbp2ii5
  nbp2ii5 -->|yes| n14sy1gg
  n14sy1gg --> no98tz3
  no98tz3 -->|yes| n2xndnh
  n2xndnh --> ncl9lau
  ncl9lau --> n7dloas
  nbp2ii5 -->|no| n15km3ql
  no98tz3 -->|no| n5tuhwq
  n5tuhwq --> n3b5xlk
```

**How it runs**

1. **The calendar reports a booking.** Calendar tools resend webhooks, so the booking id is checked first.
2. **The lead moves forward.** The lead is marked booked, which is also what stops the follow-up emails.
3. **The CRM and the team catch up.** A deal opens at the right stage and sales sees it in the channel.
4. **Strangers are flagged.** A booking from someone who never enquired still gets noticed.

**Tested behaviour**

- a booking marks the lead and opens a deal
- a booking from a stranger is flagged
- a resent webhook is handled once
