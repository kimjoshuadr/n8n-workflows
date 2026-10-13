/**
 * Built and run in production, rebuilt here for publication: onboarding for a
 * paid community.
 *
 * A Stripe charge becomes a user record, a secret code the Discord bot uses to
 * hand out roles, and an invitation to the right Skool group for each tier
 * bought.
 *
 * The original canvas has three sections, kept here under their names. Its
 * nodes could not all be read from the screenshot, so the steps inside each
 * section follow the written description of what the workflow does. Product
 * ids, group names, roles and table names are placeholders.
 */
import { code, iff, route, set, filter, splitOut, batches, merge, aggregate, randomCode, define } from "../lib/wf.mjs";
import { api, db, skool, triggers } from "../lib/nodes.mjs";

/* What each product gives its buyer. */
const COMMUNITY = { prod_community_standard: { tier: "standard", group: "acme-members" }, prod_community_premium: { tier: "premium", group: "acme-inner-circle" } };
const BOT = { prod_bot_signals: "signals", prod_bot_pro: "pro-trader" };
const inList = (map) => `[${Object.keys(map).map((k) => `'${k}'`).join(", ")}].includes($json.price?.product)`;
/** The map as an object literal inside an expression. Written with spaces: n8n reads "}}" as the end of the expression. */
const literal = (v) => (typeof v === "string" ? `'${v}'` : `{ ${Object.entries(v).map(([k, x]) => `${k}: ${literal(x)}`).join(", ")} }`);
const lookup = (map, field) => `(${literal(map)})[$json.price.product]${field ? `.${field}` : ""}`;

const charge = (id = "ch_1", email = "buyer@example.com") => ({ type: "charge.succeeded", data: { object: { id, payment_intent: `pi_${id}`, billing_details: { email, name: "Sam Buyer" } } } });
const stripeRoutes = (products, id = "ch_1") => [
  { path: "/v1/checkout/sessions", response: { data: [{ id: `cs_${id}`, customer_details: { email: "buyer@example.com", name: "Sam Buyer" } }] } },
  { path: `/v1/checkout/sessions/cs_${id}/line_items`, response: { data: products.map((product) => ({ price: { product }, quantity: 1 })) } },
];

export default [
  define({
    source: "production",
    id: "community-provisioning",
    folder: "production/community-provisioning",
    tier: "flagship",
    system: "community-provisioning",
    category: "Community",
    name: "Community · Onboarding and provisioning",
    summary: "When a Stripe charge succeeds, reads what was bought, creates or updates the buyer in Supabase, stores a secret code that the Discord bot exchanges for the right roles, and sends a Skool invitation for each community tier in the purchase.",
    nodes: [
      /* ---- 1. Get checkout details ---- */
      triggers.stripe("on_charge_succeeded", ["charge.succeeded"]),
      api("stripe", "stripeApi", "get_checkout_session", "GET", "'https://api.stripe.com/v1/checkout/sessions'", { query: { payment_intent: "$json.data.object.payment_intent", limit: "'1'" } }),
      api("stripe", "stripeApi", "get_line_items", "GET", "'https://api.stripe.com/v1/checkout/sessions/' + $json.data[0].id + '/line_items'", { query: { limit: "'100'" } }),
      splitOut("split_line_items", "data"),
      filter("filter_community_products", inList(COMMUNITY)),
      set("set_community_access", { kind: "'community'", product: "$json.price.product", tier: lookup(COMMUNITY, "tier"), group: lookup(COMMUNITY, "group") }),
      filter("filter_bot_products", inList(BOT)),
      set("set_bot_access", { kind: "'bot'", product: "$json.price.product", role: lookup(BOT) }),
      merge("merge_products"),
      aggregate("aggregate_products", "items"),

      /* ---- 2. Data manipulation ---- */
      set("set_buyer", {
        email: "String($('get_checkout_session').first().json.data[0].customer_details?.email ?? $('on_charge_succeeded').first().json.data.object.billing_details?.email ?? '').trim().toLowerCase()",
        name: "$('get_checkout_session').first().json.data[0].customer_details?.name ?? ''",
        charge_id: "$('on_charge_succeeded').first().json.data.object.id",
      }),
      db.find("get_user", "users", { email: "$json.email" }, { limit: 1 }),
      iff("if_existing_user", "!!$json.id"),
      set("set_existing_user", { is_new: "false", products: "String($json.products ?? '')" }),
      set("set_new_user", { is_new: "true", products: "''" }),
      merge("merge_user"),
      randomCode("generate_secret_code", "secret_code"),
      code("prepare_access", `const buyer = $("set_buyer").first().json;
const items = $("aggregate_products").first().json.items ?? [];
const user = $input.first().json;
const roles = [...new Set(items.filter((i) => i.kind === "bot").map((i) => i.role))];
const invites = items.filter((i) => i.kind === "community").map((i) => ({ email: buyer.email, tier: i.tier, group: i.group }));
const owned = new Set(String(user.products).split(",").filter(Boolean));
for (const i of items) owned.add(i.product);
return [{ json: { ...buyer, is_new: String(user.is_new) === "true", products: [...owned].sort().join(","), roles: roles.join(","), has_bot: roles.length > 0, invites, has_community: invites.length > 0, secret_code: user.secret_code } }];`),

      /* ---- 3. Database update and invitations ---- */
      db.upsert("upsert_user", "users", "email", "{ email: $json.email, name: $json.name, products: $json.products, last_charge_id: $json.charge_id }"),
      iff("if_bot_access", "$('prepare_access').first().json.has_bot"),
      db.insert("store_secret_code", "discord_access_codes", { code: "$('prepare_access').first().json.secret_code", email: "$('prepare_access').first().json.email", roles: "$('prepare_access').first().json.roles", charge_id: "$('prepare_access').first().json.charge_id", redeemed: "false" }),
      iff("if_community", "$('prepare_access').first().json.has_community"),
      set("set_invites", { invites: "$('prepare_access').first().json.invites" }, { types: { invites: "array" } }),
      splitOut("split_invites", "invites"),
      batches("for_each_invite", 1),
      route("switch_tier", { standard: "$json.tier === 'standard'", premium: "$json.tier === 'premium'" }),
      skool.invite("invite_skool_standard", { group: "$json.group", email: "$json.email" }),
      skool.invite("invite_skool_premium", { group: "$json.group", email: "$json.email" }),
      db.insert("log_invite", "community_invites", { email: "$('for_each_invite').first().json.email", tier: "$('for_each_invite').first().json.tier", group_name: "$('for_each_invite').first().json.group", invited_at: "$now.toISO()" }),
      { ...db.update("update_user_status", "users", { email: "$('prepare_access').first().json.email" }, { invited_at: "$now.toISO()" }), executeOnce: true },
    ],
    flow: [
      ["on_charge_succeeded", "get_checkout_session", "get_line_items", "split_line_items"],
      ["split_line_items", "filter_community_products", "set_community_access", "merge_products"],
      ["split_line_items", "filter_bot_products", "set_bot_access", "merge_products@1"],
      ["merge_products", "aggregate_products", "set_buyer", "get_user", "if_existing_user"],
      ["if_existing_user:0", "set_existing_user", "merge_user"],
      ["if_existing_user:1", "set_new_user", "merge_user@1"],
      ["merge_user", "generate_secret_code", "prepare_access", "upsert_user"],
      ["upsert_user", "if_bot_access", "store_secret_code"],
      ["upsert_user", "if_community", "set_invites", "split_invites", "for_each_invite"],
      ["for_each_invite:1", "switch_tier"],
      ["switch_tier:0", "invite_skool_standard", "log_invite"],
      ["switch_tier:1", "invite_skool_premium", "log_invite"],
      ["log_invite", "for_each_invite"],
      ["for_each_invite:0", "update_user_status"],
    ],
    sections: [
      { title: "Get checkout details", note: "The charge is traced to its checkout and line items, and each line item is sorted into community tiers and bot access.", nodes: ["on_charge_succeeded", "get_checkout_session", "get_line_items", "split_line_items", "filter_community_products", "set_community_access", "filter_bot_products", "set_bot_access", "merge_products", "aggregate_products"] },
      { title: "Data manipulation", note: "New or returning buyer, a fresh secret code, and one record of what this purchase grants.", nodes: ["set_buyer", "get_user", "if_existing_user", "set_existing_user", "set_new_user", "merge_user", "generate_secret_code", "prepare_access"] },
      { title: "Database update and invitations", note: "The user is saved, the Discord bot is given its code, and one Skool invitation goes out per tier.", nodes: ["upsert_user", "if_bot_access", "store_secret_code", "if_community", "set_invites", "split_invites", "for_each_invite", "switch_tier", "invite_skool_standard", "invite_skool_premium", "log_invite", "update_user_status"] },
    ],
    story: [
      { title: "A charge succeeds", copy: "Stripe sends the charge. It does not say what was bought, so the workflow finds the checkout it belongs to and reads its line items.", nodes: ["on_charge_succeeded", "get_checkout_session", "get_line_items", "split_line_items"] },
      { title: "Each product is sorted", copy: "Community memberships go one way and bot access the other. Each is labelled with what it grants: a tier and its Skool group, or a Discord role.", nodes: ["filter_community_products", "set_community_access", "filter_bot_products", "set_bot_access", "merge_products", "aggregate_products"] },
      { title: "New buyer or returning one", copy: "The buyer is looked up in Supabase by email. A returning buyer keeps what they already own and the new products are added to it.", nodes: ["set_buyer", "get_user", "if_existing_user", "set_existing_user", "set_new_user", "merge_user"] },
      { title: "A secret code for the bot", copy: "A random code is generated for this purchase, and everything it grants is gathered into one record.", nodes: ["generate_secret_code", "prepare_access"] },
      { title: "The database is updated", copy: "The user is created or updated. If the purchase includes bot access, the code and its roles are stored where the Discord bot reads them, so the member can redeem the code for the right roles.", nodes: ["upsert_user", "if_bot_access", "store_secret_code"] },
      { title: "One invitation per tier", copy: "Each community tier in the purchase gets its own Skool invitation to its own group, sent one at a time and logged.", nodes: ["if_community", "set_invites", "split_invites", "for_each_invite", "switch_tier", "invite_skool_standard", "invite_skool_premium", "log_invite"] },
      { title: "The user is marked invited", copy: "Once every invitation has gone, the user's record says so.", nodes: ["update_user_status"] },
    ],
    tests: [
      {
        name: "a new buyer gets a user record, a bot code and a Skool invitation",
        routes: stripeRoutes(["prod_community_standard", "prod_bot_signals"]),
        input: [charge()],
        ran: ["set_new_user", "store_secret_code", "invite_skool_standard", "update_user_status"],
        notRan: ["set_existing_user", "invite_skool_premium"],
        calls: [{ to: "skool", path: "/groups/acme-members/invites", body: { email: "buyer@example.com" } }],
        table: { users: [{ email: "buyer@example.com", products: "prod_bot_signals,prod_community_standard", last_charge_id: "ch_1" }], discord_access_codes: [{ email: "buyer@example.com", roles: "signals", charge_id: "ch_1" }], community_invites: [{ email: "buyer@example.com", tier: "standard", group_name: "acme-members" }] },
      },
      {
        name: "a returning buyer keeps what they own and gains the new product",
        seed: { users: [{ id: "u1", email: "buyer@example.com", products: "prod_community_standard" }] },
        routes: stripeRoutes(["prod_bot_pro"]),
        input: [charge("ch_2")],
        ran: ["set_existing_user", "store_secret_code"],
        notRan: ["set_new_user", "split_invites"],
        noCalls: ["skool"],
        table: { users: [{ id: "u1", products: "prod_bot_pro,prod_community_standard", last_charge_id: "ch_2" }], discord_access_codes: [{ roles: "pro-trader" }] },
      },
      {
        name: "two tiers in one purchase send two invitations to two groups",
        routes: stripeRoutes(["prod_community_standard", "prod_community_premium"]),
        input: [charge()],
        notRan: ["store_secret_code"],
        calls: [{ to: "skool", path: "/groups/acme-members/invites", body: { email: "buyer@example.com" } }, { to: "skool", path: "/groups/acme-inner-circle/invites", body: { email: "buyer@example.com" } }],
        callCount: { skool: 2 },
        table: { community_invites: [{ tier: "standard" }, { tier: "premium", group_name: "acme-inner-circle" }] },
      },
      {
        name: "bot access alone stores a 32-character code and sends no invitation",
        routes: stripeRoutes(["prod_bot_signals"]),
        input: [charge()],
        ran: ["generate_secret_code", "store_secret_code"],
        notRan: ["set_invites", "update_user_status"],
        noCalls: ["skool"],
        table: { discord_access_codes: [{ email: "buyer@example.com", roles: "signals", redeemed: false }] },
      },
      {
        name: "a purchase of something else changes nothing",
        routes: stripeRoutes(["prod_ebook"]),
        input: [charge()],
        notRan: ["get_user", "upsert_user"],
        noCalls: ["skool", "/rest/v1/users", "/rest/v1/discord_access_codes"],
      },
      {
        name: "retries the invitation when Skool is briefly down",
        routes: stripeRoutes(["prod_community_premium"]),
        fail: [{ path: "/groups/acme-inner-circle/invites", times: 2 }],
        input: [charge()],
        callCount: { skool: 3 },
        ran: ["log_invite", "update_user_status"],
      },
    ],
  }),
];
