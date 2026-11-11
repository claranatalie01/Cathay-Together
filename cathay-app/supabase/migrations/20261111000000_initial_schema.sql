-- Cathay Together: first database tables.
--
-- What this file does
--   Creates six tables and the access rules that protect them:
--     airports, profiles, groups, group_members, flight_selections, votes
--
-- How to run it
--   Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
--   Run it once. A second run stops at "already exists" and changes nothing.
--
-- Words used below
--   primary key   the column (or columns) that identify one row; no two rows may share it
--   references    "this value must exist in that other table" (a foreign key)
--   check         a rule every row must pass, or the database refuses to save it
--   RLS           row-level security: rules about which rows each signed-in person may see or change
--   auth.uid()    the id of the person making the request, taken from their verified sign-in
--
-- Safety model
--   Every table has RLS switched on. With RLS on and no rule, nobody gets in.
--   Each rule below then opens exactly one door. Visitors who are not signed in get nothing.

-- ---------------------------------------------------------------------------
-- A private area for helper functions. It is not reachable from the browser.
-- ---------------------------------------------------------------------------
create schema private;

-- ---------------------------------------------------------------------------
-- 1. airports: the four airports the demo uses, with their time zones.
--    Needed so that local flight times can be converted correctly.
-- ---------------------------------------------------------------------------
create table public.airports (
  code      text primary key check (code ~ '^[A-Z]{3}$'),
  city      text not null,
  time_zone text not null
);

insert into public.airports (code, city, time_zone) values
  ('HKG', 'Hong Kong', 'Asia/Hong_Kong'),
  ('SHA', 'Shanghai',  'Asia/Shanghai'),
  ('SIN', 'Singapore', 'Asia/Singapore'),
  ('HND', 'Tokyo',     'Asia/Tokyo');

-- ---------------------------------------------------------------------------
-- 2. profiles: one row per signed-in person.
--    Supabase keeps sign-in details (email, password) in its own auth.users table.
--    This table holds only what the app shows: a name and a home airport.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  home_airport text not null references public.airports (code),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. groups: one row per shared trip.
--    Dates are stored as real dates, not as a label such as "Nov 21–24, 2026".
-- ---------------------------------------------------------------------------
create table public.groups (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 1 and 30),
  destination_airport   text not null default 'HND' references public.airports (code),
  start_date            date not null,
  end_date              date not null,
  creator_id            uuid not null references public.profiles (id),
  invite_code           text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  invite_copied         boolean not null default false,
  budget_per_person_jpy integer not null default 15000 check (budget_per_person_jpy >= 0),
  created_at            timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- 4. group_members: who has joined which group.
--    The primary key is the pair (group, person), so joining twice cannot
--    create two memberships.
-- ---------------------------------------------------------------------------
create table public.group_members (
  group_id             uuid not null references public.groups (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  joined_at            timestamptz not null default now(),
  -- Set when the member saves their likes and passes; empty means "not ready yet".
  preferences_saved_at timestamptz,
  primary key (group_id, user_id)
);

-- Makes "which groups am I in?" fast.
create index group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- 5. flight_selections: the flight each member chose, one per direction.
--    depart_at and arrive_at are complete timestamps (date + time + time zone).
--    This is what fixes the overnight and different-day comparison bugs.
--    Money is a whole number of the smallest unit (cents) with its currency.
-- ---------------------------------------------------------------------------
create table public.flight_selections (
  group_id    uuid not null,
  user_id     uuid not null,
  direction   text not null check (direction in ('outbound', 'return')),
  offer_id    text not null,
  flight_no   text not null,
  cabin       text not null check (cabin in ('economy', 'premium', 'business')),
  fare        text not null check (fare in ('light', 'essential', 'flex')),
  depart_at   timestamptz not null,
  arrive_at   timestamptz not null,
  price_minor integer not null check (price_minor >= 0),
  currency    text not null default 'HKD' check (currency ~ '^[A-Z]{3}$'),
  selected_at timestamptz not null default now(),
  primary key (group_id, user_id, direction),
  -- Only a member of the group can have a selection in it.
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade,
  check (arrive_at > depart_at)
);

-- ---------------------------------------------------------------------------
-- 6. votes: one like or pass per member per place.
--    place_id is the id used in the app's place list, for example 'food'.
-- ---------------------------------------------------------------------------
create table public.votes (
  group_id   uuid not null,
  user_id    uuid not null,
  place_id   text not null check (char_length(place_id) between 1 and 40),
  choice     text not null check (choice in ('like', 'pass')),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id, place_id),
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Helper questions used by the access rules.
--   is_member(group)   "is the person making this request a member of this group?"
--   shares_group(user) "are they in at least one group together with this person?"
-- They run with the table owner's rights so that they can look at memberships
-- without tripping over the very rules they are helping to enforce.
-- ---------------------------------------------------------------------------
create function private.is_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    where m.group_id = target_group
      and m.user_id = (select auth.uid())
  );
$$;

create function private.shares_group(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other_user
  );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.shares_group(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.shares_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Who may touch which table at all.
--   anon          visitors who are not signed in: nothing
--   authenticated signed-in people: only what is listed, and only the rows the rules allow
--   service_role  our own server code, which uses the secret key
-- Written out in full so the result does not depend on project settings.
-- ---------------------------------------------------------------------------
revoke all on public.airports, public.profiles, public.groups, public.group_members,
              public.flight_selections, public.votes
  from anon, authenticated;

grant select                         on public.airports          to authenticated;
grant select, insert, update         on public.profiles          to authenticated;
grant select                         on public.groups            to authenticated;
grant select                         on public.group_members     to authenticated;
grant select, insert, update, delete on public.flight_selections to authenticated;
grant select, insert, update, delete on public.votes             to authenticated;

grant all on public.airports, public.profiles, public.groups, public.group_members,
             public.flight_selections, public.votes
  to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security: switch it on everywhere, then add the rules.
-- ---------------------------------------------------------------------------
alter table public.airports          enable row level security;
alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.flight_selections enable row level security;
alter table public.votes             enable row level security;

-- airports: any signed-in person can read the list. Nobody can change it from the app.
create policy "Signed-in people can read airports"
  on public.airports for select to authenticated
  using (true);

-- profiles: you can read your own profile and the profiles of people you share a group with.
create policy "Read own profile and group-mates' profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group(id));

create policy "Create own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Edit own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- groups: only members can read a group.
-- There is deliberately no rule for creating, editing or deleting a group from the app.
-- Creating and joining go through our server code, which checks the invite code first.
create policy "Members can read their groups"
  on public.groups for select to authenticated
  using (private.is_member(id));

-- group_members: only members can see who else is in the group.
-- No rule for adding a membership: nobody can add themselves to a group they were not invited to.
create policy "Members can read the member list"
  on public.group_members for select to authenticated
  using (private.is_member(group_id));

-- flight_selections: members read everyone's choices in their group (that is the board);
-- each member changes only their own.
-- Note: the server still has to check that a chosen flight is real and its price is right.
create policy "Members can read the group's flight choices"
  on public.flight_selections for select to authenticated
  using (private.is_member(group_id));

create policy "Add own flight choice"
  on public.flight_selections for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(group_id));

create policy "Change own flight choice"
  on public.flight_selections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_member(group_id));

create policy "Remove own flight choice"
  on public.flight_selections for delete to authenticated
  using (user_id = (select auth.uid()));

-- votes: same pattern as flight choices.
create policy "Members can read the group's votes"
  on public.votes for select to authenticated
  using (private.is_member(group_id));

create policy "Add own vote"
  on public.votes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(group_id));

create policy "Change own vote"
  on public.votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_member(group_id));

create policy "Remove own vote"
  on public.votes for delete to authenticated
  using (user_id = (select auth.uid()));
