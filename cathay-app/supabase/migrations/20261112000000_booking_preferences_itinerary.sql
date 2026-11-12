-- Cathay Together: review and pay, saved preferences, and the shared itinerary.
--
-- What this adds
--   1. `bookings`     one row per member and group: the 20-minute payment hold and, after the
--                     pretend payment, the booking reference. NO card data exists anywhere: the
--                     payment is simulated and the table has no column that could hold a card.
--   2. Four functions the app calls for booking: get_booking, start_booking, release_booking,
--      pay_booking. The app cannot write to `bookings` directly, so nobody can mark themselves
--      as paid, and the 20 minutes are counted on the database's clock, not the phone's.
--   3. save_preferences: marks a member's swipes as finished, after checking that they have
--      answered every place. Changing any swipe afterwards un-marks it automatically.
--   4. `itineraries`  one saved plan per group, so every phone shows the same itinerary.
--   5. A member's status in the group list becomes 'booked' once they have paid, and each member
--      carries `preferencesSaved`.
--
-- How to run it
--   SQL Editor > New query > paste this whole file > Run. Expect "Success. No rows returned".
--   Run it once. A second run stops at "relation ... already exists" and changes nothing.
--
-- Errors raised (see docs/api-contract.md): unauthenticated, profile_not_found, group_not_found,
-- no_flights, already_booked, hold_expired, choices_incomplete.

-- ---------------------------------------------------------------------------
-- 1. Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  group_id        uuid not null,
  user_id         uuid not null,
  -- "Confirm and pay" holds the fare until this moment. Null = no hold.
  hold_expires_at timestamptz,
  -- Filled in by the pretend payment.
  paid_at         timestamptz,
  reference       text check (reference ~ '^[A-Z0-9]{6}$'),
  ticket_number   text,
  total_minor     integer check (total_minor >= 0),
  currency        text not null default 'HKD' check (currency ~ '^[A-Z]{3}$'),
  primary key (group_id, user_id),
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade,
  -- Paid means every payment field is present; not paid means none is.
  check ((paid_at is null) = (reference is null)),
  check ((paid_at is null) = (ticket_number is null)),
  check ((paid_at is null) = (total_minor is null))
);

-- The app reads and changes bookings only through the functions below.
revoke all on public.bookings from anon, authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Itineraries
-- ---------------------------------------------------------------------------
-- `plan` is the timetable the app built from the votes (which stop, which day, what time).
-- Any member may build or edit it: the app tells members they have equal rights.
-- The database does not check the timetable itself; the app's checker does.
create table public.itineraries (
  group_id   uuid primary key references public.groups (id) on delete cascade,
  plan       jsonb not null check (jsonb_typeof(plan) = 'object'),
  updated_by uuid not null references public.profiles (id),
  updated_at timestamptz not null default now()
);

revoke all on public.itineraries from anon, authenticated;
grant select, insert, update on public.itineraries to authenticated;
grant all on public.itineraries to service_role;
alter table public.itineraries enable row level security;

create policy "Members can read their group's itinerary"
  on public.itineraries for select to authenticated
  using (private.is_member(group_id));

create policy "Members can save their group's itinerary"
  on public.itineraries for insert to authenticated
  with check (private.is_member(group_id) and updated_by = (select auth.uid()));

create policy "Members can change their group's itinerary"
  on public.itineraries for update to authenticated
  using (private.is_member(group_id))
  with check (private.is_member(group_id) and updated_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Group JSON: booked status and saved preferences
-- ---------------------------------------------------------------------------
-- Replaces the helper from the second migration. Status is now
--   'booked'   the member has paid,
--   'picked'   they have chosen both flights,
--   'browsing' otherwise.
create or replace function private.group_json(target_group uuid, viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',                 g.id,
    'name',               g.name,
    'destinationAirport', g.destination_airport,
    'startDate',          g.start_date,
    'endDate',            g.end_date,
    'code',               g.invite_code,
    'creatorId',          g.creator_id,
    'inviteCopied',       g.invite_copied,
    'createdAt',          g.created_at,
    'isMember',           exists (
                            select 1 from public.group_members m
                            where m.group_id = g.id and m.user_id = viewer
                          ),
    'members',            coalesce((
                            select jsonb_agg(
                              jsonb_build_object(
                                'userId',  m.user_id,
                                'name',    p.display_name,
                                'airport', jsonb_build_object('code', a.code, 'city', a.city),
                                'status',  case
                                             when exists (select 1 from public.bookings b
                                                          where b.group_id = m.group_id and b.user_id = m.user_id
                                                            and b.paid_at is not null)
                                             then 'booked'
                                             when (select count(*) from public.flight_selections s
                                                   where s.group_id = m.group_id and s.user_id = m.user_id) = 2
                                             then 'picked' else 'browsing'
                                           end,
                                'preferencesSaved', m.preferences_saved_at is not null
                              )
                              order by m.joined_at, m.user_id
                            )
                            from public.group_members m
                            join public.profiles p on p.id = m.user_id
                            join public.airports a on a.code = p.home_airport
                            where m.group_id = g.id
                          ), '[]'::jsonb)
  )
  from public.groups g
  where g.id = target_group;
$$;

-- ---------------------------------------------------------------------------
-- 4. Booking functions
-- ---------------------------------------------------------------------------

-- The caller's id, after checking they belong to the group.
create function private.member_id(target_group uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
begin
  if not exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = caller
  ) then
    raise exception 'group_not_found';
  end if;
  return caller;
end;
$$;

-- One member's booking as JSON. Times are milliseconds since 1970, which is what the app's
-- countdown uses. `serverNow` lets the app count down against the database's clock.
create function private.booking_json(target_group uuid, member uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'holdExpiresAt', (select (extract(epoch from b.hold_expires_at) * 1000)::bigint from public.bookings b
                      where b.group_id = target_group and b.user_id = member),
    'paidAt',        (select (extract(epoch from b.paid_at) * 1000)::bigint from public.bookings b
                      where b.group_id = target_group and b.user_id = member),
    'reference',     (select b.reference from public.bookings b
                      where b.group_id = target_group and b.user_id = member),
    'ticketNumber',  (select b.ticket_number from public.bookings b
                      where b.group_id = target_group and b.user_id = member),
    'totalMinor',    (select b.total_minor from public.bookings b
                      where b.group_id = target_group and b.user_id = member),
    'serverNow',     (extract(epoch from clock_timestamp()) * 1000)::bigint
  );
$$;

-- Refuses unless the member has chosen both flights and has not paid yet.
create function private.require_open_trip(target_group uuid, member uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.flight_selections s
      where s.group_id = target_group and s.user_id = member) < 2 then
    raise exception 'no_flights';
  end if;
  if exists (select 1 from public.bookings b
             where b.group_id = target_group and b.user_id = member and b.paid_at is not null) then
    raise exception 'already_booked';
  end if;
end;
$$;

-- The caller's booking in this group.
create function public.get_booking(target_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
begin
  return private.booking_json(target_group, caller);
end;
$$;

-- "Confirm and pay": holds the fare for 20 minutes. A hold that is still running is kept.
create function public.start_booking(target_group uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
begin
  perform private.require_open_trip(target_group, caller);
  insert into public.bookings (group_id, user_id, hold_expires_at)
  values (target_group, caller, now() + interval '20 minutes')
  on conflict (group_id, user_id) do update
    set hold_expires_at = excluded.hold_expires_at
    where public.bookings.hold_expires_at is null or public.bookings.hold_expires_at <= now();
  return private.booking_json(target_group, caller);
end;
$$;

-- "Change flight": gives up the hold. Does nothing once paid.
create function public.release_booking(target_group uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
begin
  update public.bookings set hold_expires_at = null
  where group_id = target_group and user_id = caller and paid_at is null;
  return private.booking_json(target_group, caller);
end;
$$;

-- The pretend payment. Needs a hold that has not run out. No card details are involved:
-- it only records that the demo payment happened and makes up a reference and ticket number.
-- The total is added up here from the member's saved flights, not sent by the app.
create function public.pay_booking(target_group uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
  total integer;
begin
  perform private.require_open_trip(target_group, caller);
  if not exists (select 1 from public.bookings b
                 where b.group_id = target_group and b.user_id = caller and b.hold_expires_at > now()) then
    raise exception 'hold_expired';
  end if;
  select sum(s.price_minor) into total from public.flight_selections s
  where s.group_id = target_group and s.user_id = caller;

  update public.bookings
  set paid_at = now(),
      hold_expires_at = null,
      reference = private.new_invite_code(),
      ticket_number = '160 ' || lpad((floor(random() * 9000000000) + 1000000000)::bigint::text, 10, '0'),
      total_minor = total
  where group_id = target_group and user_id = caller;
  return private.booking_json(target_group, caller);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Preferences
-- ---------------------------------------------------------------------------

-- Marks the caller's swipes as finished. `place_ids` is the full list of places on offer;
-- the caller must have a like or a pass for every one of them.
create function public.save_preferences(target_group uuid, place_ids text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
begin
  if coalesce(array_length(place_ids, 1), 0) = 0 or exists (
    select 1 from unnest(place_ids) as wanted (place_id)
    where not exists (
      select 1 from public.votes v
      where v.group_id = target_group and v.user_id = caller and v.place_id = wanted.place_id
    )
  ) then
    raise exception 'choices_incomplete';
  end if;
  update public.group_members set preferences_saved_at = now()
  where group_id = target_group and user_id = caller;
end;
$$;

-- Changing, adding or removing a swipe means the member is no longer "ready": they must save again.
create function private.unsave_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_members
  set preferences_saved_at = null
  where group_id = coalesce(new.group_id, old.group_id)
    and user_id = coalesce(new.user_id, old.user_id)
    and preferences_saved_at is not null;
  return null;
end;
$$;

create trigger votes_unsave_preferences
  after insert or update or delete on public.votes
  for each row execute function private.unsave_preferences();

-- ---------------------------------------------------------------------------
-- 6. Who may call what
-- ---------------------------------------------------------------------------
revoke all on function private.member_id(uuid)                from public, anon, authenticated;
revoke all on function private.booking_json(uuid, uuid)       from public, anon, authenticated;
revoke all on function private.require_open_trip(uuid, uuid)  from public, anon, authenticated;
revoke all on function private.unsave_preferences()           from public, anon, authenticated;

revoke all on function public.get_booking(uuid)               from public, anon;
revoke all on function public.start_booking(uuid)             from public, anon;
revoke all on function public.release_booking(uuid)           from public, anon;
revoke all on function public.pay_booking(uuid)               from public, anon;
revoke all on function public.save_preferences(uuid, text[])  from public, anon;

grant execute on function public.get_booking(uuid)              to authenticated, service_role;
grant execute on function public.start_booking(uuid)            to authenticated, service_role;
grant execute on function public.release_booking(uuid)          to authenticated, service_role;
grant execute on function public.pay_booking(uuid)              to authenticated, service_role;
grant execute on function public.save_preferences(uuid, text[]) to authenticated, service_role;
