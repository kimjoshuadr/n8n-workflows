-- The Supabase tables the workflows keep their state in.
-- Written by `npm run build` from the columns the workflows read and write.
-- Column types are a starting point: tighten them to your data.

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  send_at timestamptz,
  sent_at timestamptz,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists anomalies (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  flags text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  decided_at timestamptz,
  status text,
  token text,
  created_at timestamptz not null default now()
);

create table if not exists backup_checks (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  ok text,
  problems text,
  size_mb text,
  created_at timestamptz not null default now()
);

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  recovered text,
  reminded text,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists community_invites (
  id uuid primary key default gen_random_uuid(),
  email text,
  group_name text,
  invited_at timestamptz,
  tier text,
  created_at timestamptz not null default now()
);

create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  approved_by text,
  body text,
  cover_image text,
  decided_at timestamptz,
  decided_by text,
  edited text,
  has_voice_over text,
  keywords text,
  meta_description text,
  meta_title text,
  post_id text,
  published_at timestamptz,
  reason text,
  rejected_by text,
  shared text,
  shared_at timestamptz,
  slug text,
  sources text,
  status text,
  title text,
  topic_id text,
  words text,
  created_at timestamptz not null default now()
);

create table if not exists content_objects (
  id uuid primary key default gen_random_uuid(),
  date text,
  drive_file_id text,
  external_urls text,
  file_name text,
  source text,
  summary text,
  title text,
  topic text,
  type text,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists content_topics (
  id uuid primary key default gen_random_uuid(),
  note text,
  started_at timestamptz,
  status text,
  suggested_by text,
  topic text,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  last_warning text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  conversation_id text,
  email text,
  handled_by text,
  message text,
  reply text,
  created_at timestamptz not null default now()
);

create table if not exists csat (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  comment text,
  email text,
  score numeric,
  ticket_id text,
  created_at timestamptz not null default now()
);

create table if not exists dead_letters (
  id uuid primary key default gen_random_uuid(),
  attempts numeric,
  parked_at timestamptz,
  payload jsonb,
  reason text,
  replay_url text,
  replayed_at timestamptz,
  source text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists discord_access_codes (
  id uuid primary key default gen_random_uuid(),
  charge_id text,
  code text,
  email text,
  redeemed text,
  roles text,
  created_at timestamptz not null default now()
);

create table if not exists feeds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists finance_questions (
  id uuid primary key default gen_random_uuid(),
  answered text,
  at timestamptz,
  question text,
  user text,
  created_at timestamptz not null default now()
);

create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  email text,
  message text,
  name text,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists heartbeats (
  id uuid primary key default gen_random_uuid(),
  last_seen timestamptz,
  max_gap_minutes numeric,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists icp_profiles (
  id uuid primary key default gen_random_uuid(),
  active text,
  created_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  claimed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists invoice_review (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  extracted text,
  file_url text,
  invoice_number text,
  message_id text,
  problems text,
  status text,
  total numeric,
  vendor text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  last_failure_at timestamptz,
  last_reminder_at timestamptz,
  last_reminder_step text,
  paid_at timestamptz,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz,
  keyword text,
  last_position text,
  created_at timestamptz not null default now()
);

create table if not exists lead_sequences (
  id uuid primary key default gen_random_uuid(),
  company text,
  email text,
  finished_at timestamptz,
  last_reply_at timestamptz,
  last_touch_at timestamptz,
  name text,
  next_touch_at timestamptz,
  reason text,
  replied_at timestamptz,
  research text,
  score numeric,
  status text,
  step text,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  booked text,
  call_at timestamptz,
  company text,
  email text,
  fit text,
  follow_ups text,
  last_contact_at timestamptz,
  message text,
  name text,
  reason text,
  received_at timestamptz,
  score numeric,
  source text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists ledger (
  id uuid primary key default gen_random_uuid(),
  amount numeric,
  at timestamptz,
  charge_id text,
  currency text,
  event_id text,
  invoice_id text,
  kind text,
  created_at timestamptz not null default now()
);

create table if not exists link_checks (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  broken text,
  checked text,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  guild_id text,
  joined_at timestamptz,
  suspicious text,
  user_id text,
  username text,
  created_at timestamptz not null default now()
);

create table if not exists moderation_log (
  id uuid primary key default gen_random_uuid(),
  action text,
  at timestamptz,
  content text,
  message_id text,
  reason text,
  user_id text,
  created_at timestamptz not null default now()
);

create table if not exists monitors (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz,
  down_since text,
  failures text,
  state text,
  created_at timestamptz not null default now()
);

create table if not exists nps_responses (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  comment text,
  email text,
  group text,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  due timestamptz,
  employee text,
  employee_id text,
  owner text,
  status text,
  task text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  currency text,
  email text,
  lines jsonb,
  order_id text,
  review_requested text,
  status text,
  total numeric,
  tracking_url text,
  created_at timestamptz not null default now()
);

create table if not exists outreach_log (
  id uuid primary key default gen_random_uuid(),
  company text,
  email text,
  score numeric,
  sent_at timestamptz,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  email text,
  sent_at timestamptz,
  step text,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists rank_history (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  keyword text,
  position text,
  created_at timestamptz not null default now()
);

create table if not exists reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  charge_id text,
  found_at timestamptz,
  kind text,
  ledger_amount text,
  processor_amount text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  amount numeric,
  at timestamptz,
  auto text,
  charge text,
  email text,
  order_id text,
  ticket_id text,
  created_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  email text,
  key text not null unique,
  name text,
  reminded_day text,
  reminded_hour text,
  webinar_id text,
  created_at timestamptz not null default now()
);

create table if not exists seen_items (
  id uuid primary key default gen_random_uuid(),
  summary text,
  title text,
  url text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists seen_mentions (
  id uuid primary key default gen_random_uuid(),
  author text,
  text text,
  url text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists site_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  data jsonb,
  key text,
  created_at timestamptz not null default now()
);

create table if not exists stock_snapshot (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  quantity numeric,
  sku text,
  created_at timestamptz not null default now()
);

create table if not exists stored_files (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  interval text,
  reminded_for text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  account text,
  at timestamptz,
  bank_line text,
  bill_id text,
  currency text,
  due_date text,
  file_url text,
  invoice_number text,
  matched_how text,
  paid_at timestamptz,
  status text,
  total numeric,
  vendor text,
  created_at timestamptz not null default now()
);

create table if not exists support_audits (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  audited text,
  average text,
  poor text,
  created_at timestamptz not null default now()
);

create table if not exists support_conversations (
  id uuid primary key default gen_random_uuid(),
  email text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists support_log (
  id uuid primary key default gen_random_uuid(),
  answered text,
  at timestamptz,
  confidence text,
  conversation_id text,
  question text,
  reasons text,
  refunded text,
  reply text,
  sources text,
  ticket_id text,
  topic text,
  created_at timestamptz not null default now()
);

create table if not exists sync_cursors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  value text,
  created_at timestamptz not null default now()
);

create table if not exists synced (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

create table if not exists throttle (
  id uuid primary key default gen_random_uuid(),
  bucket text,
  count numeric,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text,
  invited_at timestamptz,
  last_charge_id text,
  name text,
  products text,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  email text,
  webinar_id text,
  created_at timestamptz not null default now()
);

create table if not exists watched_metrics (
  id uuid primary key default gen_random_uuid(),
  last_state text,
  name text,
  state_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists webinars (
  id uuid primary key default gen_random_uuid(),
  registered text,
  created_at timestamptz not null default now()
);

create table if not exists workflow_errors (
  id uuid primary key default gen_random_uuid(),
  at timestamptz,
  execution_id text,
  fingerprint text not null unique,
  message text,
  node text,
  workflow text,
  created_at timestamptz not null default now()
);
