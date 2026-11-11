alter table public.profiles add column if not exists is_admin boolean not null default false;

revoke update on public.profiles from authenticated;
grant update (name, program) on public.profiles to authenticated;

create or replace function public.add_campus_event(p_title text, p_starts_at timestamptz, p_place text, p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Not allowed';
  end if;
  insert into campus_events (title, starts_at, place, url)
  values (p_title, p_starts_at, p_place, p_url)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.add_campus_event(text, timestamptz, text, text) from public, anon;
grant execute on function public.add_campus_event(text, timestamptz, text, text) to authenticated;

update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'YOUR_UW_EMAIL');
