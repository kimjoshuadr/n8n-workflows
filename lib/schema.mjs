/**
 * The Supabase tables the workflows keep their state in.
 *
 * `UNIQUE` is the one constraint each table needs for a workflow to be safe to
 * run twice: it is the database, not the workflow, that refuses a duplicate.
 * `npm run build` writes these out as `schema.sql`.
 */
export const UNIQUE = {
  idempotency_keys: "idempotency_key",
  workflow_errors: "fingerprint",
  heartbeats: "name",
  seen_items: "url",
  seen_mentions: "url",
  registrations: "key",
  stored_files: "key",
  sync_cursors: "name",
};
