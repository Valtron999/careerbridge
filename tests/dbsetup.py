"""Shared bootstrap: stand-ins for Supabase's auth/storage schemas, then the real migrations."""
import glob

STUBS = """
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''))::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select (string_to_array(n,'/'))[1:array_length(string_to_array(n,'/'),1)-1] $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
"""
GRANTS = """
grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant usage on all sequences in schema public to authenticated;
grant usage on schema storage to anon, authenticated; grant select, insert, update, delete on storage.objects to authenticated; grant select on storage.objects to anon;
revoke update on notifications from authenticated; grant update (read_at) on notifications to authenticated;
"""
def bootstrap(cur, root='.'):
    cur.execute(STUBS)
    for f in sorted(glob.glob(f'{root}/supabase/migrations/*.sql')):
        cur.execute(open(f).read())
    cur.execute(GRANTS)
