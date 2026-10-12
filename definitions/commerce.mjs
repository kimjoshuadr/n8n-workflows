/**
 * Order operations: an order followed from checkout to the customer's inbox,
 * with stock kept honest along the way.
 */
import { define, webhook, schedule, http, code, iff, route, call, respond, noop } from "../lib/wf.mjs";

const base = { folder: "systems/order-ops", tier: "flagship", system: "order-ops", category: "E-commerce and payments" };

const secretCheck = (name, envVar) => iff(name, `$json.headers['x-webhook-secret'] === $env.${envVar}`);

export default [
  define({
    ...base,
    id: "order-intake",
    name: "Order ops · New order",
    summary: "Takes a new order from the store, records it once, takes its items out of stock, confirms to the customer, and warns the team about anything running low.",
    integrations: ["Webhook", "Shop", "Datastore", "Email", "Chat"],
    nodes: [
      webhook("Order created", "order-created"),
      secretCheck("From the store?", "SHOP_API_KEY"),
      respond("Unauthorised", "{ ok: false }", { status: 401 }),
      respond("Received", "{ ok: true }"),
      code("Read the order", `const o = $("Order created").first().json.body ?? {};
const lines = (o.line_items ?? []).map((l) => ({ sku: String(l.sku), title: l.title, quantity: Number(l.quantity ?? 1), price: Number(l.price ?? 0) }));
if (!o.id || !lines.length) throw new Error("Order has no id or no line items");
return [{ json: { order_id: String(o.id), email: String(o.email ?? "").toLowerCase(), customer: o.customer?.first_name ?? "there", currency: o.currency ?? "USD", total: lines.reduce((s, l) => s + l.price * l.quantity, 0), lines, scope: "order", key: String(o.id) } }];`),
      call("Seen before?", "idempotency-guard"),
      iff("New order?", "!$json.duplicate"),
      noop("Already handled"),
      http("Save the order", "DB:/orders", { body: "{ order_id: $json.order_id, email: $json.email, total: $json.total, currency: $json.currency, lines: $json.lines, status: 'paid', created_at: $now.toISO() }" }),
      code("One item per line", `return $("New order?").first().json.lines.map((l) => ({ json: { ...l, order_id: $("New order?").first().json.order_id } }));`),
      http("Take from stock", "SHOP:/inventory_levels/adjust", { body: "{ sku: $json.sku, available_adjustment: -$json.quantity }", onFail: "branch" }),
      code("What is running low?", `const lines = $("One item per line").all();
const low = $input.all().map((item, i) => ({ sku: lines[i]?.json.sku, title: lines[i]?.json.title, available: item.json.available }))
  .filter((l) => typeof l.available === "number" && l.available <= 5);
return [{ json: { low, any_low: low.length > 0, text: "Running low: " + low.map((l) => l.title + " (" + l.available + " left)").join(", "), level: "warn" } }];`),
      iff("Anything low?", "$json.any_low"),
      call("Warn the team", "notify"),
      http("Confirm to customer", "EMAIL:/emails", { body: "{ to: $('New order?').first().json.email, subject: 'Order ' + $('New order?').first().json.order_id + ' confirmed', template: 'order-confirmation', data: { name: $('New order?').first().json.customer, lines: $('New order?').first().json.lines, total: $('New order?').first().json.total } }" }),
      code("Stock failure payload", `const l = $input.first().json;
return [{ json: { source: "order-intake", reason: "Stock could not be adjusted for an order line", payload: { order_id: $("New order?").first().json.order_id, lines: $("New order?").first().json.lines } } }];`),
      call("Park for replay", "dead-letter"),
    ],
    flow: [
      ["Order created", "From the store?", "Received", "Read the order", "Seen before?", "New order?", "Save the order", "One item per line", "Take from stock", "What is running low?", "Anything low?", "Warn the team"],
      ["From the store?:1", "Unauthorised"],
      ["New order?:1", "Already handled"],
      ["Save the order", "Confirm to customer"],
      ["Take from stock:1", "Stock failure payload", "Park for replay"],
    ],
    story: [
      { title: "The store reports an order", copy: "The request must carry the shared secret. Anything else gets a 401 and goes no further.", nodes: ["Order created", "From the store?", "Unauthorised", "Received"] },
      { title: "It is recorded once", copy: "Stores resend webhooks when they are unsure. The order id is claimed first, so stock is never taken twice.", nodes: ["Read the order", "Seen before?", "New order?", "Already handled", "Save the order"] },
      { title: "The customer hears straight away", copy: "The confirmation does not wait for the stock work.", nodes: ["Confirm to customer"] },
      { title: "Each line comes out of stock", copy: "One call per line item, retried three times.", nodes: ["One item per line", "Take from stock"] },
      { title: "Low stock is noticed at the moment it happens", copy: "Anything at five or fewer becomes one message to the team.", nodes: ["What is running low?", "Anything low?", "Warn the team"] },
      { title: "A stock failure is parked", copy: "If the store's stock API stays down, the order is kept for replay with its lines.", nodes: ["Stock failure payload", "Park for replay"] },
    ],
    tests: [
      { name: "a new order is saved, confirmed and taken from stock", routes: [{ path: "/shop/inventory_levels/adjust", response: { available: 40 } }], request: { headers: { "x-webhook-secret": "test-key" }, body: { id: 1001, email: "Ana@Shop.co", customer: { first_name: "Ana" }, line_items: [{ sku: "A1", title: "Rose box", quantity: 2, price: 30 }, { sku: "B2", title: "Card", quantity: 1, price: 5 }] } }, response: { status: 200 }, callCount: { "/shop/inventory_levels/adjust": 2, "/email/emails": 1 }, calls: [{ path: "/db/orders", body: { order_id: "1001", total: 65 } }, { path: "/shop/inventory_levels/adjust", body: { sku: "A1", available_adjustment: -2 } }], notRan: ["Warn the team"] },
      { name: "low stock warns the team", routes: [{ path: "/shop/inventory_levels/adjust", response: { available: 3 } }], request: { headers: { "x-webhook-secret": "test-key" }, body: { id: 1002, email: "a@b.co", line_items: [{ sku: "A1", title: "Rose box", quantity: 1, price: 30 }] } }, ran: ["Warn the team"], calls: [{ path: "/chat/chat.postMessage", body: { text: ":warning: Running low: Rose box (3 left)" } }] },
      { name: "a resent order does not take stock twice", routes: [{ path: "/shop/inventory_levels/adjust", response: { available: 40 } }], repeat: 2, request: { headers: { "x-webhook-secret": "test-key" }, body: { id: 1003, email: "a@b.co", line_items: [{ sku: "A1", title: "Rose box", quantity: 1, price: 30 }] } }, callCount: { "/shop/inventory_levels/adjust": 1, "/email/emails": 1 } },
      { name: "a request without the secret is refused", request: { body: { id: 1004, line_items: [{ sku: "A1", quantity: 1 }] } }, response: { status: 401 }, noCalls: ["/db", "/shop"] },
      { name: "a stock outage parks the order", fail: [{ path: "/shop", times: 3 }], request: { headers: { "x-webhook-secret": "test-key" }, body: { id: 1005, email: "a@b.co", line_items: [{ sku: "A1", title: "Rose box", quantity: 1, price: 30 }] } }, ran: ["Park for replay"], calls: [{ path: "/db/dead_letters", body: { source: "order-intake" } }, { path: "/email/emails" }] },
    ],
  }),

  define({
    ...base,
    id: "order-fulfilment",
    name: "Order ops · Shipping updates",
    summary: "Turns a courier status into the right message for the customer, and tells a person when a parcel fails delivery.",
    integrations: ["Webhook", "Datastore", "Email", "Chat"],
    nodes: [
      webhook("Shipment update", "shipment-update", { respond: "immediately" }),
      code("Read the update", `const b = $input.first().json.body ?? {};
const map = { in_transit: "shipped", out_for_delivery: "out_for_delivery", delivered: "delivered", failure: "failed", returned: "failed" };
return [{ json: { order_id: String(b.order_id), status: map[b.status] ?? null, raw_status: b.status, tracking_url: b.tracking_url ?? null } }];`),
      iff("A status we act on?", "!!$json.status"),
      http("Update the order", "DB:/orders", { method: "PATCH", query: { order_id: "'eq.' + $json.order_id", status: "'neq.' + $json.status" }, body: "{ status: $json.status, tracking_url: $json.tracking_url }", alwaysOutput: true }),
      iff("Changed?", "!!$json.order_id"),
      route("Which status?", { failed: "$json.status === 'failed'" }),
      http("Email the customer", "EMAIL:/emails", { body: "{ to: $json.email, subject: { shipped: 'Your order is on its way', out_for_delivery: 'Arriving today', delivered: 'Delivered' }[$json.status], template: 'shipping-' + $json.status, data: { order_id: $json.order_id, tracking_url: $json.tracking_url } }" }),
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
      { name: "a shipped update emails the customer", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "paid" }] }, request: { body: { order_id: 1, status: "in_transit", tracking_url: "https://t.example/1" } }, calls: [{ path: "/email/emails", body: { template: "shipping-shipped", to: "a@b.co" } }], table: { orders: [{ order_id: "1", status: "shipped" }] } },
      { name: "the same update twice emails once", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "paid" }] }, repeat: 2, request: { body: { order_id: 1, status: "in_transit" } }, callCount: { "/email/emails": 1 } },
      { name: "a failed delivery goes to support, not the customer", seed: { orders: [{ order_id: "1", email: "a@b.co", status: "shipped" }] }, request: { body: { order_id: 1, status: "failure" } }, ran: ["Tell support"], noCalls: ["/email"] },
      { name: "an unknown courier status is ignored", request: { body: { order_id: 1, status: "label_printed" } }, ran: ["Ignored status"], noCalls: ["/db"] },
    ],
  }),

  define({
    ...base,
    id: "cart-recovery",
    name: "Order ops · Abandoned cart recovery",
    summary: "Every half hour, writes once to people who left a cart over an hour ago and have not ordered since.",
    integrations: ["Schedule", "Datastore", "Email"],
    nodes: [
      schedule("Every 30 minutes", { minutes: 30 }),
      http("Open carts", "DB:/carts", { method: "GET", query: { recovered: "'eq.false'", reminded: "'eq.false'" }, alwaysOutput: true }),
      code("Old enough, with an email", `const now = Date.now();
return $input.all().map((i) => i.json).filter((c) => c.email && c.updated_at)
  .filter((c) => now - new Date(c.updated_at).getTime() > 36e5)
  .filter((c) => now - new Date(c.updated_at).getTime() < 3 * 864e5)
  .map((json) => ({ json }));`),
      http("Ordered since?", "DB:/orders", { method: "GET", query: { email: "'eq.' + $json.email", limit: "'1'" }, alwaysOutput: true }),
      code("Keep the ones who did not", `const carts = $("Old enough, with an email").all();
return $input.all().map((item, i) => ({ cart: carts[i]?.json, ordered: !!item.json.order_id }))
  .filter((x) => x.cart && !x.ordered).map((x) => ({ json: x.cart }));`),
      http("Send the reminder", "EMAIL:/emails", { body: "{ to: $json.email, subject: 'You left something behind', template: 'cart-reminder', data: { items: $json.items, cart_url: $json.cart_url } }" }),
      http("Mark reminded", "DB:/carts", { method: "PATCH", query: { id: "'eq.' + $('Keep the ones who did not').item.json.id" }, body: "{ reminded: true, reminded_at: $now.toISO() }" }),
    ],
    flow: [["Every 30 minutes", "Open carts", "Old enough, with an email", "Ordered since?", "Keep the ones who did not", "Send the reminder", "Mark reminded"]],
    story: [
      { title: "It looks for open carts", copy: "Not recovered and not yet reminded.", nodes: ["Every 30 minutes", "Open carts"] },
      { title: "An hour old, not three days", copy: "Too soon is pushy and too late is pointless.", nodes: ["Old enough, with an email"] },
      { title: "It checks they did not buy anyway", copy: "Someone who ordered from another device is not chased.", nodes: ["Ordered since?", "Keep the ones who did not"] },
      { title: "One reminder, ever", copy: "The cart is marked the moment the email goes.", nodes: ["Send the reminder", "Mark reminded"] },
    ],
    tests: [
      { name: "reminds an hour-old cart once", seed: { carts: [{ id: "c1", email: "a@b.co", recovered: false, reminded: false, updated_at: new Date(Date.now() - 2 * 36e5).toISOString(), items: ["Rose box"] }] }, input: [{}], calls: [{ path: "/email/emails", body: { template: "cart-reminder", to: "a@b.co" } }], table: { carts: [{ id: "c1", reminded: true }] } },
      { name: "leaves a ten-minute-old cart alone", seed: { carts: [{ id: "c1", email: "a@b.co", recovered: false, reminded: false, updated_at: new Date(Date.now() - 6e5).toISOString() }] }, input: [{}], noCalls: ["/email"] },
      { name: "does not chase someone who ordered", seed: { carts: [{ id: "c1", email: "a@b.co", recovered: false, reminded: false, updated_at: new Date(Date.now() - 2 * 36e5).toISOString() }], orders: [{ order_id: "9", email: "a@b.co" }] }, input: [{}], noCalls: ["/email"] },
    ],
  }),
];
