-- Cathay Together: profiles for the three demo accounts.
--
-- Before running this
--   Create the three sign-in accounts in the Supabase dashboard:
--   Authentication > Users > Add user > Create new user, with "Auto Confirm User" ticked.
--   Use any email whose part before the @ is (or ends in +) gaudi, clara and kabe, for example
--     gaudi@example.com            or   yourname+gaudi@gmail.com
--     clara@example.com            or   yourname+clara@gmail.com
--     kabe@example.com             or   yourname+kabe@gmail.com
--
-- What it does
--   Finds each account by its email and gives it a name and a home airport.
--   Clara flies from Shanghai Pudong (PVG), not Hongqiao (SHA): Cathay has about ten flights a day
--   from Pudong to Hong Kong and one from Hongqiao, so real schedules work much better from PVG.
--   PVG is added by supabase/migrations/20261111020000_more_airports.sql: run that first.
--   Passwords are not stored here or anywhere in the repository.
--
-- How to run it
--   SQL Editor > New query > paste this whole file > Run.
--   Safe to run again: it updates the same three rows.
--   The result table at the bottom should list three people.

insert into public.profiles (id, display_name, home_airport)
select u.id, demo.display_name, demo.home_airport
from (values
  ('gaudi', 'Gaudi', 'HKG'),
  ('clara', 'Clara', 'PVG'),
  ('kabe',  'Kabe',  'SIN')
) as demo (handle, display_name, home_airport)
join auth.users u
  on lower(u.email) like demo.handle || '@%'
  or lower(u.email) like '%+' || demo.handle || '@%'
on conflict (id) do update
  set display_name = excluded.display_name,
      home_airport = excluded.home_airport;

-- What is in the table now. Expect three rows: Clara PVG, Gaudi HKG, Kabe SIN.
select p.display_name, p.home_airport, a.city
from public.profiles p
join public.airports a on a.code = p.home_airport
order by p.display_name;
