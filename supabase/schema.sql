-- WatsTheMove database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor. Privacy is enforced here with row level security,
-- not just in the app, so a modified client still cannot read what it should not.

-- ---------------------------------------------------------------- sign-up gate
-- Only @uwaterloo.ca addresses can ever create an account.
create or replace function public.enforce_uw_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email, '')) !~ '^[^@[:space:]]+@uwaterloo\.ca$' then
    raise exception 'Only @uwaterloo.ca emails can sign up';
  end if;
  return new;
end $$;

drop trigger if exists enforce_uw_email on auth.users;
create trigger enforce_uw_email before insert on auth.users
  for each row execute function public.enforce_uw_email();

-- ---------------------------------------------------------------- tables
-- Email is NOT stored here: profiles are visible to other students, auth.users is not.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  program text not null default '' check (char_length(program) <= 60),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, initcap(split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mutual friendships, stored once as an ordered pair.
create table if not exists public.friendships (
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- Who each person has marked as a close friend (one direction).
create table if not exists public.close_friends (
  owner uuid not null references public.profiles on delete cascade,
  friend uuid not null references public.profiles on delete cascade,
  primary key (owner, friend),
  check (owner <> friend)
);

create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles on delete cascade,
  category text not null check (category in ('gym', 'food', 'study', 'hang')),
  starts_at timestamptz not null,
  place text not null check (char_length(place) between 1 and 80),
  audience text not null check (audience in ('close', 'friends', 'open')),
  created_at timestamptz not null default now()
);
create index if not exists moves_starts_at_idx on public.moves (starts_at);

create table if not exists public.move_joins (
  move_id uuid not null references public.moves on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (move_id, user_id)
);

-- Weekly repeating busy blocks. Only day and time are stored, never course names.
create table if not exists public.busy_blocks (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  day smallint not null check (day between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  check (end_min > start_min)
);
create index if not exists busy_blocks_user_idx on public.busy_blocks (user_id);

-- Campus events are added by the team with the service role / SQL editor, not by students.
create table if not exists public.campus_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  place text not null default 'Campus',
  url text
);

create table if not exists public.event_joins (
  event_id uuid not null references public.campus_events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  primary key (event_id, user_id)
);

-- ---------------------------------------------------------------- helpers
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_a = least(a, b) and user_b = greatest(a, b));
$$;

create or replace function public.can_see_move(m_host uuid, m_audience text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = m_host
      or m_audience = 'open'
      or (m_audience = 'friends' and are_friends(auth.uid(), m_host))
      or (m_audience = 'close' and are_friends(auth.uid(), m_host)
          and exists (select 1 from close_friends c where c.owner = m_host and c.friend = auth.uid()));
$$;

-- Joining an invite link makes a mutual friendship. The inviter shared the link on purpose.
create or replace function public.accept_invite(inviter uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if inviter = auth.uid() then raise exception 'You cannot invite yourself'; end if;
  if not exists (select 1 from profiles where id = inviter) then raise exception 'Unknown inviter'; end if;
  insert into friendships (user_a, user_b) values (least(auth.uid(), inviter), greatest(auth.uid(), inviter))
  on conflict do nothing;
end $$;

-- Friends who have shared a schedule and are free at this local day/minute.
-- Returns only ids, so friends learn "free", never what the busy time is.
create or replace function public.friends_free_now(dow int, minute int) returns table (friend_id uuid)
language sql stable security definer set search_path = public as $$
  select f.friend
  from (
    select case when user_a = auth.uid() then user_b else user_a end as friend
    from friendships where auth.uid() in (user_a, user_b)
  ) f
  where exists (select 1 from busy_blocks b where b.user_id = f.friend)
    and not exists (
      select 1 from busy_blocks b
      where b.user_id = f.friend and b.day = dow and b.start_min <= minute and minute < b.end_min
    );
$$;

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.close_friends enable row level security;
alter table public.moves enable row level security;
alter table public.move_joins enable row level security;
alter table public.busy_blocks enable row level security;
alter table public.campus_events enable row level security;
alter table public.event_joins enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy friendships_read on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

create policy close_manage on public.close_friends for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid() and public.are_friends(owner, friend));

create policy moves_read on public.moves for select to authenticated
  using (public.can_see_move(host_id, audience));
create policy moves_insert on public.moves for insert to authenticated
  with check (host_id = auth.uid());
create policy moves_delete on public.moves for delete to authenticated
  using (host_id = auth.uid());

-- You can only see or join a move you can already see (the sub-select is itself filtered by moves_read).
create policy joins_read on public.move_joins for select to authenticated
  using (exists (select 1 from public.moves m where m.id = move_id));
create policy joins_insert on public.move_joins for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.moves m where m.id = move_id));
create policy joins_delete on public.move_joins for delete to authenticated
  using (user_id = auth.uid());

create policy busy_own on public.busy_blocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy events_read on public.campus_events for select to authenticated using (true);
create policy event_joins_read on public.event_joins for select to authenticated using (true);
create policy event_joins_insert on public.event_joins for insert to authenticated
  with check (user_id = auth.uid());
create policy event_joins_delete on public.event_joins for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- grants
revoke all on all tables in schema public from anon;
grant select, update on public.profiles to authenticated;
grant select, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.close_friends to authenticated;
grant select, insert, delete on public.moves to authenticated;
grant select, insert, delete on public.move_joins to authenticated;
grant select, insert, delete, update on public.busy_blocks to authenticated;
grant select on public.campus_events to authenticated;
grant select, insert, delete on public.event_joins to authenticated;
revoke execute on function public.accept_invite(uuid) from public, anon;
revoke execute on function public.friends_free_now(int, int) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.friends_free_now(int, int) to authenticated;
