create table if not exists public.friend_requests (
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

alter table public.friend_requests enable row level security;
create policy friend_requests_read_incoming on public.friend_requests for select to authenticated
  using (auth.uid() = to_id);
grant select on public.friend_requests to authenticated;

create or replace function public.send_friend_request(target_email text) returns void
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into target from auth.users where lower(email) = lower(trim(target_email));
  if target is null or target = auth.uid() then return; end if;

  if exists (select 1 from friend_requests where from_id = target and to_id = auth.uid()) then
    insert into friendships (user_a, user_b) values (least(auth.uid(), target), greatest(auth.uid(), target))
    on conflict do nothing;
    delete from friend_requests where from_id = target and to_id = auth.uid();
    return;
  end if;

  insert into friend_requests (from_id, to_id) values (auth.uid(), target) on conflict do nothing;
end $$;

create or replace function public.respond_friend_request(from_user uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if accept then
    insert into friendships (user_a, user_b) values (least(auth.uid(), from_user), greatest(auth.uid(), from_user))
    on conflict do nothing;
  end if;
  delete from friend_requests where from_id = from_user and to_id = auth.uid();
end $$;

revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
