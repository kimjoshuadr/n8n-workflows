/**
 * Community operations for a Discord server: welcoming people in, keeping the
 * channels clean, and posting what was scheduled.
 */
import { webhook, schedule, code, iff, route, noop, call, define } from "../lib/wf.mjs";
import { db, discord, api, ask, readAnswer } from "../lib/nodes.mjs";

const base = { folder: "systems/community-ops", tier: "flagship", system: "community-ops", category: "Community" };

export default [
  define({
    ...base,
    id: "community-onboarding",
    name: "Community ops · Member onboarding",
    summary: "Welcomes a new member, gives them the starter role, records them, and flags accounts created minutes ago for a moderator to look at.",
    nodes: [
      webhook("Member joined", "member-joined", { respond: "immediately" }),
      code("Read the member", `const m = $input.first().json.body ?? {};
const created = m.user?.created_at ? new Date(m.user.created_at).getTime() : null;
const ageDays = created ? (Date.now() - created) / 864e5 : null;
return [{ json: { user_id: String(m.user?.id), username: m.user?.username ?? "new member", guild_id: String(m.guild_id), bot: !!m.user?.bot, account_age_days: ageDays === null ? null : Math.floor(ageDays), suspicious: ageDays !== null && ageDays < 1, scope: "member-joined", key: m.guild_id + ":" + m.user?.id } }];`),
      iff("A person?", "!$json.bot"),
      call("Seen before?", "idempotency-guard"),
      iff("First join?", "!$json.duplicate"),
      db.insert("Save the member", "members", { user_id: "$json.user_id", username: "$json.username", guild_id: "$json.guild_id", joined_at: "$now.toISO()", suspicious: "$json.suspicious" }),
      iff("Brand new account?", "$('First join?').first().json.suspicious"),
      code("Review message", `const m = $("First join?").first().json;
return [{ json: { channel: "#mods", level: "warn", text: m.username + " joined with an account under a day old. Held without a role until someone checks." } }];`),
      call("Ask a moderator", "notify"),
      discord.addRole("Give starter role", "$('First join?').first().json.user_id", "100000000000000010"),
      discord.send("Welcome them", "'100000000000000002'", "'Welcome <@' + $('First join?').first().json.user_id + '>! Start in #introductions, and read #rules before posting.'", { onFail: "continue" }),
      noop("Ignore bots"),
      noop("Rejoined"),
    ],
    flow: [
      ["Member joined", "Read the member", "A person?", "Seen before?", "First join?", "Save the member", "Brand new account?", "Review message", "Ask a moderator"],
      ["A person?:1", "Ignore bots"],
      ["First join?:1", "Rejoined"],
      ["Brand new account?:1", "Give starter role", "Welcome them"],
    ],
    story: [
      { title: "Someone joins", copy: "Bots are ignored, and a person who left and came back is not welcomed twice.", nodes: ["Member joined", "Read the member", "A person?", "Ignore bots", "Seen before?", "First join?", "Rejoined"] },
      { title: "They are recorded", copy: "With the age of their account, which is the cheapest spam signal there is.", nodes: ["Save the member", "Brand new account?"] },
      { title: "Normal accounts get in", copy: "The starter role opens the channels, then a welcome points them at the first two.", nodes: ["Give starter role", "Welcome them"] },
      { title: "Day-old accounts wait", copy: "No role is given. A moderator is asked to look first.", nodes: ["Review message", "Ask a moderator"] },
    ],
    tests: [
      { name: "a normal account is given the role and welcomed", request: { body: { guild_id: "g1", user: { id: "200000000000000001", username: "ana", created_at: "2020-01-01T00:00:00Z" } } }, calls: [{ to: "discord", method: "PUT", path: "/api/v10/guilds/100000000000000001/members/200000000000000001/roles/100000000000000010" }, { to: "discord", method: "POST", path: "/api/v10/channels/100000000000000002/messages" }, { to: "supabase", path: "/rest/v1/members", body: { suspicious: false } }], notRan: ["Ask a moderator"] },
      { name: "a day-old account is held for a moderator", request: { body: { guild_id: "g1", user: { id: "200000000000000002", username: "x", created_at: new Date().toISOString() } } }, ran: ["Ask a moderator"], noCalls: ["discord"] },
      { name: "a bot is ignored", request: { body: { guild_id: "g1", user: { id: "200000000000000099", bot: true } } }, ran: ["Ignore bots"], noCalls: ["supabase", "discord"] },
      { name: "a rejoin is not welcomed again", repeat: 2, request: { body: { guild_id: "g1", user: { id: "200000000000000003", username: "ana", created_at: "2020-01-01T00:00:00Z" } } }, callCount: { "discord /api/v10/channels/100000000000000002/messages": 1 } },
    ],
  }),

  define({
    ...base,
    id: "community-moderation",
    name: "Community ops · Message moderation",
    summary: "Checks each message, removes clear scams, sends borderline ones to moderators, and never removes anything when the model is unavailable.",
    nodes: [
      webhook("Message posted", "message-posted", { respond: "immediately" }),
      code("Read the message", `const m = $input.first().json.body ?? {};
const roles = m.member?.roles ?? [];
if (m.author?.bot || roles.includes("moderator") || roles.includes("admin")) return [];
const content = String(m.content ?? "").trim();
if (!content) return [];
return [{ json: { message_id: String(m.id), channel_id: String(m.channel_id), user_id: String(m.author?.id), username: m.author?.username ?? "unknown", content: content.slice(0, 2000) } }];`),
      ...ask("Judge it", { task: "moderate", system: "You moderate a community server. Reply with JSON: { action: 'allow'|'review'|'remove', reason: string }. Remove only clear scams, phishing links and threats. Use review for insults and anything you are unsure about. Disagreement and criticism are allowed.", prompt: "$json.content", example: { action: "allow", reason: "Why." } }),
      readAnswer("Read the verdict", { from: "Read the message", fallback: { action: "review", reason: "The model was unavailable, so a person should look." } }),
      route("What to do?", { remove: "$json.action === 'remove' && !$json.parse_error", review: "$json.action === 'review' || $json.parse_error" }),
      discord.remove("Delete the message", "$json.channel_id", "$json.message_id"),
      api("discord", "discordBotApi", "Time the author out", "PATCH", "'https://discord.com/api/v10/guilds/100000000000000001/members/' + $('What to do?').first().json.user_id", { body: "{ communication_disabled_until: $now.plus({ minutes: 60 }).toISO() }", onFail: "continue" }),
      db.insert("Log the action", "moderation_log", { message_id: "$('What to do?').first().json.message_id", user_id: "$('What to do?').first().json.user_id", action: "'removed'", reason: "$('What to do?').first().json.reason", content: "$('What to do?').first().json.content", at: "$now.toISO()" }),
      code("Removed message", `const m = $("What to do?").first().json;
return [{ json: { channel: "#mods", level: "info", text: "Removed a message from " + m.username + " and timed them out for an hour. Reason: " + m.reason } }];`),
      code("Review message", `const m = $input.first().json;
return [{ json: { channel: "#mods", level: "warn", text: "Please look at a message from " + m.username + ": \\"" + m.content.slice(0, 200) + "\\". Reason: " + m.reason } }];`),
      call("Tell moderators", "notify"),
      noop("Leave it"),
    ],
    flow: [
      ["Message posted", "Read the message", "Judge it", "Read the verdict", "What to do?"],
      ["What to do?:0", "Delete the message", "Time the author out", "Log the action", "Removed message", "Tell moderators"],
      ["What to do?:1", "Review message", "Tell moderators"],
      ["What to do?:2", "Leave it"],
    ],
    story: [
      { title: "A message is posted", copy: "Messages from bots and from the moderators themselves are skipped.", nodes: ["Message posted", "Read the message"] },
      { title: "A model judges it", copy: "Allow, review or remove, with a reason. Criticism is explicitly allowed.", nodes: ["Judge it", "Read the verdict", "What to do?"] },
      { title: "Clear scams are removed", copy: "The message is deleted, the author is timed out for an hour, and the action is logged with the original text.", nodes: ["Delete the message", "Time the author out", "Log the action", "Removed message"] },
      { title: "Anything unsure goes to people", copy: "That includes every message judged while the model is down. The automation never removes on a guess.", nodes: ["Review message", "Tell moderators"] },
      { title: "Everything else is left alone", copy: "Which is most messages.", nodes: ["Leave it"] },
    ],
    tests: [
      { name: "a scam link is removed, logged and reported", request: { body: { id: "400000000000000001", channel_id: "300000000000000001", content: "Free nitro at http://scam.example", author: { id: "200000000000000001", username: "spammer" } } }, calls: [{ to: "discord", method: "DELETE", path: "/api/v10/channels/300000000000000001/messages/400000000000000001" }, { to: "discord", method: "PATCH", path: "/api/v10/guilds/100000000000000001/members/200000000000000001" }, { to: "supabase", path: "/rest/v1/moderation_log", body: { action: "removed" } }, { to: "slack", path: "/api/chat.postMessage", body: { channel: "#mods" } }] },
      { name: "an insult goes to moderators and is not deleted", request: { body: { id: "400000000000000002", channel_id: "300000000000000001", content: "you are an idiot", author: { id: "200000000000000002", username: "rude" } } }, ran: ["Review message", "Tell moderators"], noCalls: ["discord"] },
      { name: "an ordinary message is left alone", request: { body: { id: "400000000000000003", channel_id: "300000000000000001", content: "I disagree with the roadmap", author: { id: "200000000000000003", username: "ana" } } }, ran: ["Leave it"], noCalls: ["discord", "slack"] },
      { name: "nothing is removed while the model is down", fail: [{ path: "/v1/chat/completions", times: 20 }, { path: "/v1/messages", times: 20 }], request: { body: { id: "400000000000000004", channel_id: "300000000000000001", content: "Free nitro at http://scam.example", author: { id: "200000000000000001", username: "spammer" } } }, ran: ["Review message"], noCalls: ["discord"] },
      { name: "a moderator's message is not judged", request: { body: { id: "400000000000000005", channel_id: "300000000000000001", content: "scam warning: do not click http://x", author: { id: "200000000000000009" }, member: { roles: ["moderator"] } } }, noCalls: ["openai", "anthropic"] },
    ],
  }),

  define({
    ...base,
    id: "community-announcements",
    name: "Community ops · Scheduled announcements",
    summary: "Posts announcements at the time they were scheduled for, once, and reports any that could not be posted.",
    nodes: [
      schedule("Every 5 minutes", { minutes: 5 }),
      db.find("Due announcements", "announcements", { status: "'scheduled'", send_at: ["lte", "$now.toISO()"] }),
      iff("Any due?", "!!$json.id"),
      db.update("Claim it", "announcements", { id: "$json.id", status: "'scheduled'" }, { status: "'sending'" }),
      iff("Claimed?", "!!$json.id"),
      discord.send("Post it", "$json.channel_id", "$json.content", { onFail: "continue" }),
      iff("Posted?", "!!$json.id && !$json.error"),
      db.update("Mark sent", "announcements", { id: "$('Claimed?').item.json.id" }, { status: "'sent'", sent_at: "$now.toISO()" }, { alwaysOutput: false }),
      db.update("Mark failed", "announcements", { id: "$('Claimed?').item.json.id" }, { status: "'failed'" }, { alwaysOutput: false }),
      code("Failure message", `return $input.all().map((i) => ({ json: { channel: "#mods", level: "warn", text: "An announcement could not be posted and was marked failed: \\"" + String(i.json.content ?? "").slice(0, 120) + "\\"" } }));`),
      call("Tell the team", "notify"),
      noop("Nothing due"),
    ],
    flow: [
      ["Every 5 minutes", "Due announcements", "Any due?", "Claim it", "Claimed?", "Post it", "Posted?", "Mark sent"],
      ["Any due?:1", "Nothing due"],
      ["Posted?:1", "Mark failed", "Failure message", "Tell the team"],
    ],
    story: [
      { title: "Every five minutes", copy: "It asks for announcements whose time has come.", nodes: ["Every 5 minutes", "Due announcements", "Any due?", "Nothing due"] },
      { title: "Each one is claimed first", copy: "The status moves from scheduled to sending in one update that only succeeds once, so overlapping runs cannot double post.", nodes: ["Claim it", "Claimed?"] },
      { title: "Posted and marked", copy: "Sent announcements keep the time they actually went out.", nodes: ["Post it", "Posted?", "Mark sent"] },
      { title: "A failure is visible", copy: "It is marked failed and the team is told, instead of silently retrying an hour late.", nodes: ["Mark failed", "Failure message", "Tell the team"] },
    ],
    tests: [
      { name: "a due announcement is posted once and marked sent", seed: { announcements: [{ id: "a1", status: "scheduled", send_at: "2020-01-01T00:00:00Z", channel_id: "300000000000000005", content: "AMA at 5pm" }] }, repeat: 2, input: [{}], callCount: { "discord /api/v10/channels/300000000000000005/messages": 1 }, table: { announcements: [{ id: "a1", status: "sent" }] } },
      { name: "a future announcement waits", seed: { announcements: [{ id: "a1", status: "scheduled", send_at: "2999-01-01T00:00:00Z", content: "Later" }] }, input: [{}], ran: ["Nothing due"], noCalls: ["discord"] },
      { name: "a failed post is marked and reported", seed: { announcements: [{ id: "a1", status: "scheduled", send_at: "2020-01-01T00:00:00Z", channel_id: "300000000000000005", content: "AMA" }] }, fail: [{ path: "/api/v10", times: 3 }], input: [{}], ran: ["Tell the team"], table: { announcements: [{ id: "a1", status: "failed" }] } },
    ],
  }),
];
