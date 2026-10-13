/**
 * The platforms this library automates, and how each is reached.
 *
 * One named platform per job, used the same way everywhere. A workflow never
 * says "the CRM": it uses the HubSpot node, and its documentation says HubSpot.
 *
 * `credential` is the n8n credential type a node needs. `test` is throwaway
 * data the test runner creates that credential with; the stack routes each
 * platform's hostname to a stand-in, so nothing here is a real key.
 * `icon` is the platform's Simple Icons slug, used wherever its mark is shown.
 */
const oauth = (extra = {}) => ({ clientId: "test-client", clientSecret: "test-secret", oauthTokenData: { access_token: "test-access-token", refresh_token: "test-refresh", token_type: "Bearer", expires_in: 99999999, expiry_date: 4102444800000 }, ...extra });

export const PLATFORMS = {
  slack: { name: "Slack", hosts: ["slack.com"], job: "Team chat and alerts", icon: "slack", credential: "slackApi", test: { accessToken: "xoxb-test" } },
  hubspot: { name: "HubSpot", hosts: ["api.hubapi.com"], job: "CRM", icon: "hubspot", credential: "hubspotAppToken", test: { appToken: "pat-test" } },
  sendgrid: { name: "SendGrid", hosts: ["api.sendgrid.com"], job: "Customer email", icon: "sendgrid", credential: "sendGridApi", test: { apiKey: "SG.test" } },
  gmail: { name: "Gmail", hosts: ["gmail.googleapis.com", "www.googleapis.com"], job: "Shared inbox", icon: "gmail", credential: "gmailOAuth2", test: oauth() },
  supabase: { name: "Supabase", hosts: ["acme.supabase.co"], job: "Records and state", icon: "supabase", credential: "supabaseApi", test: { host: "https://acme.supabase.co", serviceRole: "test-service-role" } },
  calendly: { name: "Calendly", hosts: ["api.calendly.com"], job: "Booking", icon: "calendly", credential: "calendlyApi", test: { apiKey: "test-calendly" } },
  googleCalendar: { name: "Google Calendar", hosts: ["www.googleapis.com"], job: "Calendar", icon: "googlecalendar", credential: "googleCalendarOAuth2Api", test: oauth() },
  zendesk: { name: "Zendesk", hosts: ["acme.zendesk.com"], job: "Helpdesk", icon: "zendesk", credential: "zendeskApi", test: { subdomain: "acme", email: "agent@example.com", apiToken: "test-zendesk" } },
  wordpress: { name: "WordPress", hosts: ["acme.wordpress.test"], job: "Website and CMS", icon: "wordpress", credential: "wordpressApi", test: { username: "editor", password: "test-app-password", url: "https://acme.wordpress.test", allowUnauthorizedCerts: true } },
  linkedin: { name: "LinkedIn", hosts: ["api.linkedin.com"], job: "Social", icon: "linkedin", credential: "linkedInOAuth2Api", test: oauth() },
  x: { name: "X", hosts: ["api.x.com", "api.twitter.com"], job: "Social", icon: "x", credential: "twitterOAuth2Api", test: oauth() },
  facebook: { name: "Facebook", hosts: ["graph.facebook.com"], job: "Social", icon: "facebook", credential: "facebookGraphApi", test: { accessToken: "test-facebook" } },
  shopify: { name: "Shopify", hosts: ["acme-store.myshopify.com"], job: "Store", icon: "shopify", credential: "shopifyAccessTokenApi", test: { shopSubdomain: "acme-store", accessToken: "shpat_test", appSecretKey: "test-shopify-secret" } },
  stripe: { name: "Stripe", hosts: ["api.stripe.com"], job: "Payments", icon: "stripe", credential: "stripeApi", test: { secretKey: "sk_test_mock" } },
  quickbooks: { name: "QuickBooks", hosts: ["sandbox-quickbooks.api.intuit.com", "quickbooks.api.intuit.com"], job: "Accounting", icon: "quickbooks", credential: "quickBooksOAuth2Api", test: oauth({ environment: "sandbox" }) },
  discord: { name: "Discord", hosts: ["discord.com"], job: "Community", icon: "discord", credential: "discordBotApi", test: { botToken: "test-discord-bot" } },
  typeform: { name: "Typeform", hosts: ["api.typeform.com"], job: "Forms", icon: "typeform", credential: "typeformApi", test: { accessToken: "test-typeform" } },
  mailchimp: { name: "Mailchimp", hosts: ["us1.api.mailchimp.com"], job: "Email marketing", icon: "mailchimp", credential: "mailchimpApi", test: { apiKey: "testkey-us1" } },
  twilio: { name: "Twilio", hosts: ["api.twilio.com"], job: "SMS", icon: "twilio", credential: "twilioApi", test: { authType: "authToken", accountSid: "ACtest", authToken: "test-twilio" } },
  googleDrive: { name: "Google Drive", hosts: ["www.googleapis.com"], job: "Files", icon: "googledrive", credential: "googleDriveOAuth2Api", test: oauth() },
  googleSheets: { name: "Google Sheets", hosts: ["sheets.googleapis.com"], job: "Sheets", icon: "googlesheets", credential: "googleSheetsOAuth2Api", test: oauth() },
  clearbit: { name: "Clearbit", hosts: ["person.clearbit.com", "person-stream.clearbit.com", "company.clearbit.com"], job: "Enrichment", icon: "clearbit", credential: "clearbitApi", test: { apiKey: "test-clearbit" } },
  serpapi: { name: "SerpAPI", hosts: ["serpapi.com"], job: "Web search", icon: "google", credential: "serpApi", test: { apiKey: "test-serpapi" } },
  bamboohr: { name: "BambooHR", hosts: ["api.bamboohr.com"], job: "HR", icon: "bamboohr", credential: "bambooHrApi", test: { apiKey: "test-bamboo", subdomain: "acme" } },
  posthog: { name: "PostHog", hosts: ["app.posthog.com"], job: "Product analytics", icon: "posthog", credential: "postHogApi", test: { url: "https://app.posthog.com", apiKey: "phc_test" } },
  anthropic: { name: "Claude", hosts: ["api.anthropic.com"], job: "AI reasoning and writing", icon: "anthropic", credential: "anthropicApi", test: { apiKey: "sk-ant-test" } },
  openai: { name: "OpenAI", hosts: ["api.openai.com"], job: "AI classification and embeddings", icon: "openai", credential: "openAiApi", test: { apiKey: "sk-test-mock" } },
  pinecone: { name: "Pinecone", hosts: ["api.pinecone.io", "kb-index.svc.pinecone.io"], job: "AI knowledge base", icon: "pinecone", credential: "pineconeApi", test: { apiKey: "test-pinecone" } },
  elevenlabs: { name: "ElevenLabs", hosts: ["api.elevenlabs.io"], job: "AI voice", icon: "elevenlabs", credential: "httpHeaderAuth", credentialName: "ElevenLabs API key", test: { name: "xi-api-key", value: "test-elevenlabs" } },
};

/** The credential block a node carries. The installer fills in the real id. */
export const credentialFor = (platform) => {
  const p = PLATFORMS[platform];
  if (!p) throw new Error(`unknown platform "${platform}"`);
  return { [p.credential]: { id: `__CRED:${platform}__`, name: p.credentialName ?? p.name } };
};
