/**
 * Order operations: an order followed from checkout to the customer's inbox,
 * with stock kept honest along the way.
 */
import { webhook, schedule, code, iff, route, noop, call, define } from "../lib/wf.mjs";
import { db, sendgrid, shopify, triggers } from "../lib/nodes.mjs";

const base = { folder: "systems/order-ops", tier: "flagship", system: "order-ops", category: "E-commerce and payments" };


export default [
  define({
    ...base,
    id: "order-intake",
    name: "Order ops · New order",
    summary: "Takes a new order from the store, records it once, takes its items out of stock, confirms to the customer, and warns the team about anything running low.",
    nodes: [
      triggers.shopify("Order created", "orders/create"),
      code("Read the order", `const o = $("Order created").first().json ?? {};
const lines = (o.line_items ?? []).map((l) => ({ sku: String(l.sku), title: l.title, quantity: Number(l.quantity ?? 1), price: Number(l.price ?? 0) }));
if (!o.id || !lines.length) throw new Error("Order has no id or no line items");
return [{ json: { order_id: String(o.id), email: String(o.email ?? "").toLowerCase(), customer: o.customer?.first_name ?? "there", currency: o.currency ?? "USD", total: lines.reduce((s, l) => s + l.price * l.quantity, 0), lines, scope: "order", key: String(o.id) } }];`),
      call("Seen before?", "idempotency-guard"),
      iff("New order?", "!$json.duplicate"),
      noop("Already handled"),
      db.insert("Save the order", "orders", { order_id: "$json.order_id", email: "$json.email", total: "$json.total", currency: "$json.currency", lines: "$json.lines", status: "'paid'", created_at: "$now.toISO()" }),
      code("One item per line", `return $("New order?").first().json.lines.map((l) => ({ json: { ...l, order_id: $("New order?").first().json.order_id } }));`),
      shopify.adjustStock("Take from stock", { sku: "$json.sku", by: "-$json.quantity" }, { onFail: "branch" }),
      code("What is running low?", `const lines = $("One item per line").all();
const low = $input.all().map((item, i) => ({ sku: lines[i]?.json.sku, title: lines[i]?.json.title, available: item.json.available }))
  .filter((l) => typeof l.available === "number" && l.available <= 5);
return [{ json: { low, any_low: low.length > 0, text: "Running low: " + low.map((l) => l.title + " (" + l.available + " left)").join(", "), level: "warn" } }];`),
      iff("Anything low?", "$json.any_low"),
      call("Warn the team", "notify"),
      sendgrid.send("Confirm to customer", { to: "$('New order?').first().json.email", template: "'d-order-confirmation'", data: { name: "$('New order?').first().json.customer", lines: "$('New order?').first().json.lines", total: "$('New order?').first().json.total" } }),
      code("Stock failure payload", `const l = $input.first().json;
return [{ json: { source: "order-intake", reason: "Stock could not be adjusted for an order line", payload: { order_id: $("New order?").first().json.order_id, lines: $("New order?").first().json.lines } } }];`),
      call("Park for replay", "dead-letter"),
    ],
    flow: [
      ["Order created", "Read the order", "Seen before?", "New order?", "Save the order", "One item per line", "Take from stock", "What is running low?", "Anything low?", "Warn the team"],
      ["New order?:1", "Already handled"],
      ["Save the order", "Confirm to customer"],
      ["Take from stock:1", "Stock failure payload", "Park for replay"],
    ],
    story: [
      { title: "Shopify reports an order", copy: "The Shopify trigger checks the signature on every delivery, so nothing unsigned gets this far.", nodes: ["Order created"] },
      { title: "It is recorded once", copy: "Stores resend webhooks when they are unsure. The order id is claimed first, so stock is never taken twice.", nodes: ["Read the order", "Seen before?", "New order?", "Already handled", "Save the order"] },
      { title: "The customer hears straight away", copy: "The confirmation does not wait for the stock work.", nodes: ["Confirm to customer"] },
      { title: "Each line comes out of stock", copy: "One call per line item, retried three times.", nodes: ["One item per line", "Take from stock"] },
      { title: "Low stock is noticed at the moment it happens", copy: "Anything at five or fewer becomes one message to the team.", nodes: ["What is running low?", "Anything low?", "Warn the team"] },
      { title: "A stock failure is parked", copy: "If the store's stock API stays down, the order is kept for replay with its lines.", nodes: ["Stock failure payload", "Park for replay"] },
    ],
    tests: [
      { name: "a new order is saved, confirmed and taken from stock", routes: [{ path: "acme-store.myshopify.com/admin/api/2025-01/inventory_levels/adjust.json", response: { available: 40 } }], input: [{ id: 1001, email: "Ana@Shop.co", customer: { first_name: "Ana" }, line_items: [{ sku: "A1", title: "Rose box", quantity: 2, price: 30 }, { sku: "B2", title: "Card", quantity: 1, price: 5 }] }], callCount: { "shopify /admin/api/2025-01/inventory_levels/adjust.json": 2, "sendgrid /v3/mail/send": 1 }, calls: [{ to: "supabase", path: "/rest/v1/orders", body: { order_id: "1001", total: 65 } }, { to: "shopify", path: "/admin/api/2025-01/inventory_levels/adjust.json", body: { sku: "A1", available_adjustment: -2 } }], notRan: ["Warn the team"] },
      { name: "low stock warns the team", routes: [{ path: "acme-store.myshopify.com/admin/api/2025-01/inventory_levels/adjust.json", response: { available: 3 } }], input: [{ id: 1002, email: "a@b.co", line_items: [{ sku: "A1", title: "Rose box", quantity: 1, price: 30 }] }], ran: ["Warn the team"], calls: [{ to: "slack", path: "/api/chat.postMessage", body: { text: ":warning: Running low: Rose box (3 left)" } }] },
      { name: "a resent order does not take stock twice", routes: [{ path: "acme-store.myshopify.com/admin/api/2025-01/inventory_levels/adjust.json", response: { available: 40 } }], repeat: 2, input: [{ id: 1003, email: "a@b.co", line_items: [{ sku: "A1", title: "Rose box", quantity: 1, price: 30 }] }], callCount: { "shopify /admin/api/2025-01/inventory_levels/adjust.json": 1, "sendgrid /v3/mail/send": 1 } },
      { name: "a stock outage parks the order", fail: [{ path: "/admin/api", times: 3 }], input: [{ id: 1005, email: "a@b.co", line_items: [{ sku: "A1", title: "Rose box", quantity: 1, price: 30 }] }], ran: ["Park for replay"], calls: [{ to: "supabase", path: "/rest/v1/dead_letters", body: { source: "order-intake" } }, { to: "sendgrid", path: "/v3/mail/send" }] },
    ],
  }),

  define({
    ...base,
    id: "order-fulfilment",
    name: "Order ops · Shipping updates",
    summary: "Turns a courier status into the right message for the customer, and tells a person when a parcel fails delivery.",
    nodes: [
      webhook("Shipment update", "shipment-update", { respond: "immediately" }),
      code("Read the update", `const b = $input.first().json.body ?? {};
const map = { in_transit: "shipped", out_for_delivery: "out_for_delivery", delivered: "delivered", failure: "failed", returned: "failed" };
return [{ json: { order_id: String(b.order_id), status: map[b.status] ?? null, raw_status: b.status, tracking_url: b.tracking_url ?? null } }];`),
      iff("A status we act on?", "!!$json.status"),
      db.update("Update the order", "orders", { order_id: "$json.order_id", status: ["neq", "$json.status"] }, { status: "$json.status", tracking_url: "$json.tracking_url" }),
      iff("Changed?", "!!$json.order_id"),
      route("Which status?", { failed: "$json.status === 'failed'" }),
      sendgrid.send("Email the customer", { to: "$json.email", template: "'d-shipping-' + $json.status", data: { order_id: "$json.order_id", tracking_url: "$json.tracking_url" } }),
      code("Failed delivery message", `const o = $input.first().json;
return [{ json: { text: "Delivery failed for order " + o.order_id + " (" + o.email + "). Someone should contact the customer.", level: "warn" } }];`),
      call("Tell support", "notify"),
      noop("Nothing to do"),
      noop("Ignored status"),
    ],
    flow: [
      ["Shipment update", "Read the update", "A status we act on?", "Update the order", "Changed?", "Which status?"],
      ["A status we act on?:1", "Ignored status"],
      ["Changed?:1", "Nothing to do"],
      ["Which status?:0", "Failed delivery message", "Tell support"],
      ["Which status?:1", "Email the customer"],
    ],
    story: [
      { title: "The courier reports", copy: "Their many statuses are mapped to the four the business cares about. The rest are ignored.", nodes: ["Shipment update", "Read the update", "A status we act on?", "Ignored status"] },
      { title: "Only a real change counts", copy: "The update only matches an order whose status is different, so a repeated event sends no second email.", nodes: ["Update the order", "Changed?", "Nothing to do"] },
      { title: "The customer is told", copy: "Shipped, arriving today and delivered each have their own message.", nodes: ["Which status?", "Email the customer"] },
      { title: "A failed delivery goes to a person", copy: "The customer is not sent an automatic apology. Support is told to call them.", nodes: ["Failed delivery message", "Tell support"] },
    ],
    tests: [
      { name: "a shipped update emails the customer", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "paid" }] }, request: { body: { order_id: 1, status: "in_transit", tracking_url: "https://t.example/1" } }, calls: [{ to: "sendgrid", path: "/v3/mail/send", body: { template_id: "d-shipping-shipped", personalizations: [{ to: [{ email: "a@b.co" }] }] } }], table: { orders: [{ order_id: "1", status: "shipped" }] } },
      { name: "the same update twice emails once", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "paid" }] }, repeat: 2, request: { body: { order_id: 1, status: "in_transit" } }, callCount: { "sendgrid /v3/mail/send": 1 } },
      { name: "a failed delivery goes to support, not the customer", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "shipped" }] }, request: { body: { order_id: 1, status: "failure" } }, ran: ["Tell support"], noCalls: ["sendgrid"] },
      { name: "an unknown courier status is ignored", request: { body: { order_id: 1, status: "label_printed" } }, ran: ["Ignored status"], noCalls: ["supabase"] },
    ],
  }),

  define({
    ...base,
    id: "cart-recovery",
    name: "Order ops · Abandoned cart recovery",
    summary: "Every half hour, writes once to people who left a cart over an hour ago and have not ordered since.",
    nodes: [
      schedule("Every 30 minutes", { minutes: 30 }),
      db.find("Open carts", "carts", { recovered: "'false'", reminded: "'false'" }),
      code("Old enough, with an email", `const now = Date.now();
return $input.all().map((i) => i.json).filter((c) => c.email && c.updated_at)
  .filter((c) => now - new Date(c.updated_at).getTime() > 36e5)
  .filter((c) => now - new Date(c.updated_at).getTime() < 3 * 864e5)
  .map((json) => ({ json }));`),
      db.find("Ordered since?", "orders", { email: "$json.email" }, { limit: 1 }),
      code("Keep the ones who did not", `const carts = $("Old enough, with an email").all();
return $input.all().map((item, i) => ({ cart: carts[i]?.json, ordered: !!item.json.order_id }))
  .filter((x) => x.cart && !x.ordered).map((x) => ({ json: x.cart }));`),
      sendgrid.send("Send the reminder", { to: "$json.email", template: "'d-cart-reminder'", data: { items: "$json.items", cart_url: "$json.cart_url" } }),
      db.update("Mark reminded", "carts", { id: "$('Keep the ones who did not').item.json.id" }, { reminded: "true", reminded_at: "$now.toISO()" }, { alwaysOutput: false }),
    ],
    flow: [["Every 30 minutes", "Open carts", "Old enough, with an email", "Ordered since?", "Keep the ones who did not", "Send the reminder", "Mark reminded"]],
    story: [
      { title: "It looks for open carts", copy: "Not recovered and not yet reminded.", nodes: ["Every 30 minutes", "Open carts"] },
      { title: "An hour old, not three days", copy: "Too soon is pushy and too late is pointless.", nodes: ["Old enough, with an email"] },
      { title: "It checks they did not buy anyway", copy: "Someone who ordered from another device is not chased.", nodes: ["Ordered since?", "Keep the ones who did not"] },
      { title: "One reminder, ever", copy: "The cart is marked the moment the email goes.", nodes: ["Send the reminder", "Mark reminded"] },
    ],
    tests: [
      { name: "reminds an hour-old cart once", seed: { carts: [{ id: "c1", email: "a@b.co", recovered: false, reminded: false, updated_at: new Date(Date.now() - 2 * 36e5).toISOString(), items: ["Rose box"] }] }, input: [{}], calls: [{ to: "sendgrid", path: "/v3/mail/send", body: { template_id: "d-cart-reminder", personalizations: [{ to: [{ email: "a@b.co" }] }] } }], table: { carts: [{ id: "c1", reminded: true }] } },
      { name: "leaves a ten-minute-old cart alone", seed: { carts: [{ id: "c1", email: "a@b.co", recovered: false, reminded: false, updated_at: new Date(Date.now() - 6e5).toISOString() }] }, input: [{}], noCalls: ["sendgrid"] },
      { name: "does not chase someone who ordered", seed: { carts: [{ id: "c1", email: "a@b.co", recovered: false, reminded: false, updated_at: new Date(Date.now() - 2 * 36e5).toISOString() }], orders: [{ order_id: "9", email: "a@b.co" }] }, input: [{}], noCalls: ["sendgrid"] },
    ],
  }),
];
