-- Publish an invalidation, separate from the membership and vote records.
create table public.trip_preference_updates (
  -- Realtime can expose a deleted row's primary key without checking RLS.
  -- Keep it independent of the trip ID.
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.groups (id) on delete cascade,
  revision uuid not null
);

alter table public.trip_preference_updates enable row level security;
revoke all on public.trip_preference_updates from public, anon, authenticated;
grant select on public.trip_preference_updates to authenticated;
create policy "Trip members can receive preference updates"
  on public.trip_preference_updates for select to authenticated
  using (private.is_member(group_id));

create function private.notify_preferences_saved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_preference_updates (group_id, revision)
    values (new.group_id, gen_random_uuid())
    on conflict (group_id) do update set revision = excluded.revision;
  return new;
end;
$$;

revoke all on function private.notify_preferences_saved() from public, anon, authenticated;

-- A successful save writes a timestamp. Individual swipes can clear that
-- timestamp, but do not publish a save event. Realtime streams only commits.
create trigger notify_preferences_saved
  after update of preferences_saved_at on public.group_members
  for each row when (new.preferences_saved_at is not null)
  execute function private.notify_preferences_saved();

alter publication supabase_realtime add table public.trip_preference_updates;
