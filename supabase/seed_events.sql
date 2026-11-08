-- Campus events are added by you, not by students. Run in the Supabase SQL editor.
-- Source to copy from: https://uwaterloo.ca/events/events (it has no feed or export, so this is manual).
-- Times are Toronto time. Replace the examples below.
insert into public.campus_events (title, starts_at, place, url) values
  ('Drop-in Volleyball', '2026-11-10 17:30 America/Toronto', 'PAC', null),
  ('Example: Trip Around the World at Village 1', '2026-11-10 18:00 America/Toronto', 'Village 1',
   'https://uwaterloo.ca/events/events/trip-around-world-village-1');

-- Remove an event:  delete from public.campus_events where title = 'Drop-in Volleyball';
