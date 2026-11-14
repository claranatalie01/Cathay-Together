alter table public.group_members add column preference_categories text[] not null default '{}';

-- Keep the one-argument version for callers that have no saved category selection.
create function public.finish_picking(target_group uuid, selected_categories text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  traveller uuid := private.member_id(target_group);
begin
  if selected_categories is null or cardinality(selected_categories) > 8 or not (
    selected_categories <@ array['food','culture','nature','shopping','views','art','entertainment','relaxation']::text[]
  ) then raise exception 'validation_failed'; end if;

  update public.group_members
    set preference_categories = selected_categories
    where group_id = target_group and user_id = traveller
      and preference_categories is distinct from selected_categories;

  perform public.finish_picking(target_group);
end;
$$;

revoke all on function public.finish_picking(uuid, text[]) from public, anon;
grant execute on function public.finish_picking(uuid, text[]) to authenticated;

-- The app previews conflicts against these revisions. Lock the shared plan before
-- checking them so a personal save cannot change the result before the group save.
create function public.save_group_itinerary_batch(
  target_group uuid, expected_group_revision timestamptz, expected_personal_revisions jsonb, new_plan jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  traveller uuid := private.member_id(target_group);
  group_revision timestamptz;
begin
  if expected_personal_revisions is null or jsonb_typeof(expected_personal_revisions) <> 'object' then
    raise exception 'validation_failed';
  end if;
  select updated_at into group_revision from public.itineraries where group_id = target_group for update;
  if not found then raise exception 'itinerary_not_built'; end if;
  if group_revision is distinct from expected_group_revision or exists (
    select 1
    from (select user_id::text as id, updated_at from public.itinerary_personal_changes where group_id = target_group) saved
    full join jsonb_each_text(expected_personal_revisions) expected(id, revision) using (id)
    where saved.updated_at is distinct from expected.revision::timestamptz
  ) then raise exception 'itinerary_changed'; end if;
  if new_plan is null or jsonb_typeof(new_plan) <> 'object' or octet_length(new_plan::text) > 500000 then
    raise exception 'validation_failed';
  end if;

  update public.itineraries
    set plan = new_plan, updated_by = traveller, updated_at = greatest(clock_timestamp(), group_revision + interval '1 microsecond')
    where group_id = target_group;
end;
$$;

revoke all on function public.save_group_itinerary_batch(uuid, timestamptz, jsonb, jsonb) from public, anon;
grant execute on function public.save_group_itinerary_batch(uuid, timestamptz, jsonb, jsonb) to authenticated;
