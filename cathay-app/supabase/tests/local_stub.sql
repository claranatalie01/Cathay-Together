-- LOCAL TESTING ONLY. Never run this on the real Supabase project.
--
-- A plain Postgres database has none of the things Supabase adds: the three roles,
-- the auth schema and the auth.uid() function. This file creates stand-ins for them
-- so that the migrations and tests/access_rules.sql can run on a throwaway local database.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create publication supabase_realtime;

create schema auth;
create table auth.users (id uuid primary key, email text unique);

-- The real auth.uid() reads the verified sign-in token. This one reads a setting the tests control.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth   to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Mimics the project setting "Automatically expose new tables": every new table is
-- granted to all three roles. The migration must stay safe even with this on.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
