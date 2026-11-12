-- Cathay Together: more home airports, with coordinates.
--
-- Why this file exists
--   New people choose their home airport on their first sign-in, from a list. The first
--   migration only had four airports. This adds a few more and gives every airport a position
--   (latitude and longitude) so the app can suggest the nearest one when the person allows it.
--   The person's own location is compared with this list inside their browser; it is never
--   sent to the server.
--
-- Rules are unchanged: signed-in people can read airports and nobody can change them from
-- the app. Tokyo (HND) stays in the table as the destination; the app does not offer it as a
-- home airport.
--
-- How to run it
--   SQL Editor > New query > paste this whole file > Run. Expect "Success. No rows returned".
--   Run it once. A second run stops at "column ... already exists" and changes nothing.

alter table public.airports
  add column latitude  numeric(8, 5),
  add column longitude numeric(8, 5);

insert into public.airports (code, city, time_zone) values
  ('PVG', 'Shanghai',     'Asia/Shanghai'),
  ('TPE', 'Taipei',       'Asia/Taipei'),
  ('ICN', 'Seoul',        'Asia/Seoul'),
  ('MNL', 'Manila',       'Asia/Manila'),
  ('BKK', 'Bangkok',      'Asia/Bangkok'),
  ('KUL', 'Kuala Lumpur', 'Asia/Kuala_Lumpur'),
  ('CAN', 'Guangzhou',    'Asia/Shanghai');

update public.airports a
set latitude = v.latitude, longitude = v.longitude
from (values
  ('HKG', 22.30800, 113.91800),
  ('SHA', 31.19700, 121.33600),
  ('PVG', 31.14340, 121.80520),
  ('SIN',  1.36440, 103.99150),
  ('HND', 35.54940, 139.77980),
  ('TPE', 25.07770, 121.23280),
  ('ICN', 37.46020, 126.44070),
  ('MNL', 14.50860, 121.01980),
  ('BKK', 13.69000, 100.75010),
  ('KUL',  2.74560, 101.70990),
  ('CAN', 23.39240, 113.29880)
) as v (code, latitude, longitude)
where a.code = v.code;

alter table public.airports
  alter column latitude  set not null,
  alter column longitude set not null,
  add constraint airports_latitude_range  check (latitude  between -90  and 90),
  add constraint airports_longitude_range check (longitude between -180 and 180);
