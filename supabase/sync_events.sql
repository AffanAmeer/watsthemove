-- Run once in the Supabase SQL editor, AFTER deploying the sync-events function.
-- Adds the column the sync uses to avoid duplicates, then schedules the sync every 3 hours.
--
-- Before running the last block, replace:
--   <PROJECT_REF>  with the part of your Project URL before .supabase.co
--   <SYNC_SECRET>  with the same value you set using `supabase secrets set SYNC_SECRET=...`
-- Do not commit the filled-in version to GitHub.

alter table public.campus_events add column if not exists source_uid text unique;

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'sync-campus-events',
  '0 */3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-events',
    headers := jsonb_build_object('x-sync-secret', '<SYNC_SECRET>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- To stop the schedule later:  select cron.unschedule('sync-campus-events');
