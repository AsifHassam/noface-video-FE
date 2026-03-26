# pg_cron + Edge Function `automation-tick`

## Prerequisites

1. Apply migration `20250317120000_automation_instagram.sql` (tables + `claim_due_automation_rules`).
2. Deploy Edge Function `automation-tick` and set secrets in Supabase Dashboard → Edge Functions:
   - `CRON_SECRET` — high-entropy shared secret (pg_cron and manual curl send this).
   - `REMOTION_SERVER_URL` — public base URL of the Remotion API (e.g. `https://api.example.com`).
   - `AUTOMATION_API_SECRET` — must match `AUTOMATION_API_SECRET` on the Remotion server.
3. Remotion server env:
   - `AUTOMATION_API_SECRET` — same value as Edge.
   - `OPENAI_API_KEY` — script generation (OpenAI Chat Completions).

## Enable extensions (Supabase Dashboard → Database → Extensions)

- `pg_cron`
- `pg_net` (for `net.http_post`)

## Schedule (run in SQL Editor)

Replace placeholders:

- `YOUR_PROJECT_REF` — Supabase project ref.
- `YOUR_CRON_SECRET` — same as Edge `CRON_SECRET` (or use Vault to avoid literals).

```sql
select cron.schedule(
  'automation-tick-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/automation-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Do **not** commit real secrets into git. Prefer storing the Bearer token in [Vault](https://supabase.com/docs/guides/database/vault) and building the header in a thin SQL wrapper function.

## Manual test

```bash
curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/automation-tick" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```
