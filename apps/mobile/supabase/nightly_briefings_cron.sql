-- nightly_briefings_cron.sql
--
-- Sets up a pg_cron job that calls the `nightly-briefings` Edge Function
-- at 2 AM UTC every day. This generates AI briefings overnight so that
-- co-users can review and approve them before the patient wakes up.
--
-- Prerequisites: pg_cron and pg_net are already enabled on Supabase hosted projects.
-- Fill in your Project URL and service_role key (Project Settings → API) in the
-- cron.schedule call below before running this in the SQL editor.

-- Enable extensions (no-op if already enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any existing job with this name so this migration is idempotent.
select cron.unschedule('nightly-briefings') where exists (
  select 1 from cron.job where jobname = 'nightly-briefings'
);

-- Schedule the nightly run at 2:00 AM UTC.
-- At that time it is ~10 PM Eastern / ~7 PM Pacific, so the briefing
-- is ready well before the patient's morning in all US time zones.
--
-- Replace the two placeholder values below with your real credentials
-- (Project Settings → API in the Supabase dashboard) before running.
select cron.schedule(
  'nightly-briefings',
  '0 2 * * *',
  $$
  select net.http_post(
    url     := 'https://<your-project-ref>.supabase.co/functions/v1/nightly-briefings',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <your-service-role-key>'
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- Verify the job was created:
-- select * from cron.job where jobname = 'nightly-briefings';
--
-- To check recent run history:
-- select * from cron.job_run_details where jobid = (
--   select jobid from cron.job where jobname = 'nightly-briefings'
-- ) order by start_time desc limit 10;
--
-- To remove the job later:
-- select cron.unschedule('nightly-briefings');
