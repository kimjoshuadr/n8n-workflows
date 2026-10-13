# Community operations

**Welcoming, moderating and announcing on a Discord server.**

**The problem.** A growing server needs someone awake at all hours to welcome people and remove scams.

**What this does about it.** Members are onboarded, scams are removed in seconds, and moderators are only asked about the cases that need judgement.

3 workflows, 12 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

## Community ops · Member onboarding

Welcomes a new member, gives them the starter role, records them, and flags accounts created minutes ago for a moderator to look at.

- **Starts from:** Webhook
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/discord.svg" width="16" height="16" alt=""> Discord
- **Nodes:** 13
- **Calls:** `idempotency-guard`, `notify`, `error-handler`
- **Files:** [`community-onboarding.json`](community-onboarding.json) · [`community-onboarding.workflow.ts`](community-onboarding.workflow.ts)

```mermaid
flowchart LR
  n1wc3he0(["Member joined"])
  nmzmep8["Read the member"]
  nauhg90{"A person?"}
  n1ja4syq[["Seen before?"]]
  n151u8u{"First join?"}
  n1gmr6p1["Save the member"]
  n1y0mjyq{"Brand new account?"}
  n20moti["Review message"]
  n15is060[["Ask a moderator"]]
  n1mu36bz["Give starter role"]
  n112nutd["Welcome them"]
  n1v01rpv["Ignore bots"]
  n1u1h2lf["Rejoined"]
  n1wc3he0 --> nmzmep8
  nmzmep8 --> nauhg90
  nauhg90 -->|yes| n1ja4syq
  n1ja4syq --> n151u8u
  n151u8u -->|yes| n1gmr6p1
  n1gmr6p1 --> n1y0mjyq
  n1y0mjyq -->|yes| n20moti
  n20moti --> n15is060
  nauhg90 -->|no| n1v01rpv
  n151u8u -->|no| n1u1h2lf
  n1y0mjyq -->|no| n1mu36bz
  n1mu36bz --> n112nutd
```

**How it runs**

1. **Someone joins.** Bots are ignored, and a person who left and came back is not welcomed twice.
2. **They are recorded.** With the age of their account, which is the cheapest spam signal there is.
3. **Normal accounts get in.** The starter role opens the channels, then a welcome points them at the first two.
4. **Day-old accounts wait.** No role is given. A moderator is asked to look first.

**Tested behaviour**

- a normal account is given the role and welcomed
- a day-old account is held for a moderator
- a bot is ignored
- a rejoin is not welcomed again

## Community ops · Message moderation

Checks each message, removes clear scams, sends borderline ones to moderators, and never removes anything when the model is unavailable.

- **Starts from:** Webhook
- **Platforms:** <img src="../../assets/platforms/openai.svg" width="16" height="16" alt=""> OpenAI &nbsp;·&nbsp; <img src="../../assets/platforms/discord.svg" width="16" height="16" alt=""> Discord &nbsp;·&nbsp; <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase
- **Nodes:** 14
- **Calls:** `notify`, `error-handler`
- **Files:** [`community-moderation.json`](community-moderation.json) · [`community-moderation.workflow.ts`](community-moderation.workflow.ts)

```mermaid
flowchart LR
  ntse8nz(["Message posted"])
  n2grn5h["Read the message"]
  n1vc1kvv[["Judge it"]]
  nsyc3zx("Judge it · GPT")
  n1g6vvmb("Judge it · shape")
  n1riexmv["Read the verdict"]
  n1ekp1l0{"What to do?"}
  n6sabii["Delete the message"]
  n137b0xg[/"Time the author out"/]
  n1mplts8["Log the action"]
  n61hr9c["Removed message"]
  n20moti["Review message"]
  n1iyws7q[["Tell moderators"]]
  nv0a53v["Leave it"]
  ntse8nz --> n2grn5h
  n2grn5h --> n1vc1kvv
  n1vc1kvv --> n1riexmv
  n1riexmv --> n1ekp1l0
  n1ekp1l0 -->|yes| n6sabii
  n6sabii --> n137b0xg
  n137b0xg --> n1mplts8
  n1mplts8 --> n61hr9c
  n61hr9c --> n1iyws7q
  n1ekp1l0 -->|no| n20moti
  n20moti --> n1iyws7q
  n1ekp1l0 -->|no| nv0a53v
  nsyc3zx -.-> n1vc1kvv
  n1g6vvmb -.-> n1vc1kvv
```

**How it runs**

1. **A message is posted.** Messages from bots and from the moderators themselves are skipped.
2. **A model judges it.** Allow, review or remove, with a reason. Criticism is explicitly allowed.
3. **Clear scams are removed.** The message is deleted, the author is timed out for an hour, and the action is logged with the original text.
4. **Anything unsure goes to people.** That includes every message judged while the model is down. The automation never removes on a guess.
5. **Everything else is left alone.** Which is most messages.

**Tested behaviour**

- a scam link is removed, logged and reported
- an insult goes to moderators and is not deleted
- an ordinary message is left alone
- nothing is removed while the model is down
- a moderator's message is not judged

## Community ops · Scheduled announcements

Posts announcements at the time they were scheduled for, once, and reports any that could not be posted.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/supabase.svg" width="16" height="16" alt=""> Supabase &nbsp;·&nbsp; <img src="../../assets/platforms/discord.svg" width="16" height="16" alt=""> Discord
- **Nodes:** 12
- **Calls:** `notify`, `error-handler`
- **Files:** [`community-announcements.json`](community-announcements.json) · [`community-announcements.workflow.ts`](community-announcements.workflow.ts)

```mermaid
flowchart LR
  n1pdql2g(["Every 5 minutes"])
  n1efj2c9["Due announcements"]
  n1x75dpi{"Any due?"}
  ng7nr92["Claim it"]
  ng7p697{"Claimed?"}
  n9q64kk["Post it"]
  n9q7jkp{"Posted?"}
  n1sxbt1g["Mark sent"]
  nmbehd5["Mark failed"]
  n1u1ajxm["Failure message"]
  n8m5mk4[["Tell the team"]]
  nnsfmoq["Nothing due"]
  n1pdql2g --> n1efj2c9
  n1efj2c9 --> n1x75dpi
  n1x75dpi -->|yes| ng7nr92
  ng7nr92 --> ng7p697
  ng7p697 --> n9q64kk
  n9q64kk --> n9q7jkp
  n9q7jkp -->|yes| n1sxbt1g
  n1x75dpi -->|no| nnsfmoq
  n9q7jkp -->|no| nmbehd5
  nmbehd5 --> n1u1ajxm
  n1u1ajxm --> n8m5mk4
```

**How it runs**

1. **Every five minutes.** It asks for announcements whose time has come.
2. **Each one is claimed first.** The status moves from scheduled to sending in one update that only succeeds once, so overlapping runs cannot double post.
3. **Posted and marked.** Sent announcements keep the time they actually went out.
4. **A failure is visible.** It is marked failed and the team is told, instead of silently retrying an hour late.

**Tested behaviour**

- a due announcement is posted once and marked sent
- a future announcement waits
- a failed post is marked and reported
