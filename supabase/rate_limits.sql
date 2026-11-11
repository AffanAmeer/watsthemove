-- Rate limits for spam control. Run after schema.sql and friend_requests.sql.
-- Every counted action is logged here, so deleting a move does not reset the count.
create table if not exists public.rate_events (
  id bigserial primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup_idx on public.rate_events (user_id, action, created_at);

alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

-- Trigger arguments: action name, max allowed, window in seconds.
create or replace function public.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who uuid;
  act_name text := tg_argv[0];
  max_allowed int := tg_argv[1]::int;
  window_secs int := tg_argv[2]::int;
begin
  -- Pick the column per table; each table only has its own field.
  if tg_table_name = 'moves' then
    who := new.host_id;
  else
    who := new.from_id;
  end if;

  if (
    select count(*) from public.rate_events e
    where e.user_id = who and e.action = act_name
      and e.created_at > now() - make_interval(secs => window_secs)
  ) >= max_allowed then
    raise exception 'Too many in a short time. Please try again later.';
  end if;
  insert into public.rate_events (user_id, action) values (who, act_name);
  return new;
end $$;

drop trigger if exists moves_rate_limit on public.moves;
create trigger moves_rate_limit before insert on public.moves
  for each row execute function public.rate_limit('post_move', '20', '3600');

drop trigger if exists friend_requests_rate_limit on public.friend_requests;
create trigger friend_requests_rate_limit before insert on public.friend_requests
  for each row execute function public.rate_limit('friend_request', '30', '86400');
