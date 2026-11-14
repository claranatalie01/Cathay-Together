-- Personal stop overrides belong to one traveller and are independent of the shared plan.
create table public.itinerary_personal_changes (
  group_id uuid not null,
  user_id uuid not null,
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (group_id, user_id),
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade
);

alter table public.itinerary_personal_changes enable row level security;
revoke all on public.itinerary_personal_changes from public, anon, authenticated;
grant select on public.itinerary_personal_changes to authenticated;
grant all on public.itinerary_personal_changes to service_role;
create policy "Trip members can see timeline changes"
  on public.itinerary_personal_changes for select to authenticated
  using (private.is_member(group_id));

create function public.save_personal_itinerary(
  target_group uuid, expected_group_revision timestamptz, expected_personal_revision timestamptz, new_changes jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  traveller uuid := private.member_id(target_group);
  group_revision timestamptz;
  personal_revision timestamptz;
begin
  -- Serialize edits against the shared revision and other saves by this traveller.
  perform 1 from public.group_members
    where group_id = target_group and user_id = traveller for no key update;
  if not found then raise exception 'group_not_found'; end if;

  select updated_at into group_revision from public.itineraries where group_id = target_group for share;
  if not found then raise exception 'itinerary_not_built'; end if;

  select updated_at into personal_revision from public.itinerary_personal_changes
    where group_id = target_group and user_id = traveller;
  if group_revision is distinct from expected_group_revision or personal_revision is distinct from expected_personal_revision then
    raise exception 'itinerary_changed';
  end if;
  if new_changes is null or jsonb_typeof(new_changes) <> 'object' or octet_length(new_changes::text) > 150000 then
    raise exception 'validation_failed';
  end if;

  insert into public.itinerary_personal_changes (group_id, user_id, changes)
    values (target_group, traveller, new_changes)
    on conflict (group_id, user_id) do update set changes = excluded.changes, updated_at = clock_timestamp();
end;
$$;

revoke all on function public.save_personal_itinerary(uuid, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.save_personal_itinerary(uuid, timestamptz, timestamptz, jsonb) to authenticated;
