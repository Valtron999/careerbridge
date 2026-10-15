-- Atomically switch a candidate's default CV (SECURITY INVOKER: RLS still applies).
create or replace function set_default_cv(p_id uuid) returns void language plpgsql as $$
begin
  if not exists (select 1 from candidate_cvs where id = p_id and user_id = auth.uid()) then raise exception 'not_found'; end if;
  update candidate_cvs set is_default = false where user_id = auth.uid() and is_default and id <> p_id;
  update candidate_cvs set is_default = true where id = p_id and user_id = auth.uid();
end $$;
revoke execute on function set_default_cv from public, anon;
grant execute on function set_default_cv to authenticated;
