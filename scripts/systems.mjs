/** The flagship systems: the order they are shown in, and what each is for. */
export const SYSTEMS = [
  { id: "lead-intake", name: "Lead intake", folder: "systems/lead-intake", line: "An enquiry followed from the form to a booked call.", problem: "Enquiries arrive at any hour, sit in an inbox, and the good ones go cold before anyone replies.", outcome: "Every enquiry is answered in seconds, scored, filed in the CRM and followed up until it books or goes cold." },
  { id: "support-agent", name: "Support agent", folder: "systems/support-agent", line: "Answers what it can, hands over what it cannot.", problem: "The same questions are answered by hand every day, and the hard ones wait behind them.", outcome: "Covered questions are answered from the help centre at once. Everything else reaches a person with the context already written." },
  { id: "content-pipeline", name: "Content pipeline", folder: "systems/content-pipeline", line: "Topic to published article, with a person's approval in the middle.", problem: "Publishing regularly needs research, drafting, review and sharing, and one of them always slips.", outcome: "A researched draft is ready each morning. Nothing is published until a person approves it, and sharing follows by itself." },
  { id: "order-ops", name: "Order operations", folder: "systems/order-ops", line: "An order followed from checkout to the customer's inbox.", problem: "Orders, stock and customer emails live in different tools and are kept in step by hand.", outcome: "Each order is recorded once, stock is taken, the customer is kept informed and abandoned carts are followed up." },
  { id: "payments", name: "Payments", folder: "systems/payments", line: "Every payment recorded exactly once, and checked daily.", problem: "Payment webhooks arrive twice or not at all, and nobody notices the books are wrong until month end.", outcome: "A ledger that matches the processor, a daily proof that it does, and overdue invoices chased on a schedule." },
  { id: "community-ops", name: "Community operations", folder: "systems/community-ops", line: "Welcoming, moderating and announcing on a Discord server.", problem: "A growing server needs someone awake at all hours to welcome people and remove scams.", outcome: "Members are onboarded, scams are removed in seconds, and moderators are only asked about the cases that need judgement." },
  { id: "ops-digest", name: "Ops digest", folder: "systems/ops-digest", line: "The week's numbers on one screen, and an alert when one breaks.", problem: "The numbers exist in five tools and nobody has the hour it takes to gather them.", outcome: "One summary every Monday with week-on-week change, and an alert the moment a number crosses its line." },
  { id: "reliability-kit", name: "Reliability kit", folder: "shared", line: "What every other workflow leans on when something fails.", problem: "Automations fail silently: a webhook arrives twice, an API is down, a schedule stops.", outcome: "Failures are caught, alerted once, parked for replay and noticed even when the failure is that nothing ran." },
];

export const TIERS = {
  flagship: "Flagship systems",
  production: "Production workflows",
  block: "Building blocks",
};
