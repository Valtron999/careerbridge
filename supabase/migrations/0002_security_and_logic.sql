-- Helper functions, guard triggers, RLS policies, transactional RPCs.

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','super_admin') and status = 'active') $$;

create or replace function member_of(eid uuid, roles member_role[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employer_memberships m join profiles p on p.id = m.user_id
    where m.employer_id = eid and m.user_id = auth.uid() and p.status = 'active'
      and (roles is null or m.role = any (roles))) $$;

-- Roles come ONLY from this trigger and ONLY candidate/employer. Admins are granted by SQL/service role.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r account_role := 'candidate';
begin
  if new.raw_user_meta_data ->> 'account_type' = 'employer' then r := 'employer'; end if;
  insert into profiles (id, role, full_name, email)
    values (new.id, r, nullif(left(new.raw_user_meta_data ->> 'full_name', 120), ''), new.email);
  if r = 'candidate' then insert into candidate_profiles (user_id) values (new.id); end if;
  insert into notification_preferences (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function guard_profile() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() and (new.role <> old.role or new.status <> old.status or new.id <> old.id) then
    raise exception 'role and status cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_profile before update on profiles for each row execute function guard_profile();

create or replace function guard_employer() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() and
     (new.verification_status <> old.verification_status or new.created_by <> old.created_by) then
    raise exception 'verification status is managed by reviewers' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_employer before update on employers for each row execute function guard_employer();

create or replace function employer_owner_membership() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into employer_memberships (employer_id, user_id, role) values (new.id, new.created_by, 'owner'); return new; end $$;
create trigger trg_employer_owner after insert on employers for each row execute function employer_owner_membership();

create or replace function guard_opportunity() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then
      if new.status not in ('draft','pending_review') then raise exception 'new listings must be draft or pending_review' using errcode='42501'; end if;
      new.featured := false; new.moderation_note := null; new.source := 'employer';
    else
      if new.status = 'published' and old.status not in ('published','paused') then
        raise exception 'listings must be approved by a moderator before publishing' using errcode='42501'; end if;
      if new.status = 'rejected' then raise exception 'only moderators can reject' using errcode='42501'; end if;
      new.featured := old.featured; new.moderation_note := old.moderation_note;
      new.employer_id := old.employer_id; new.published_at := old.published_at;
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger trg_guard_opportunity before insert or update on opportunities for each row execute function guard_opportunity();

-- Internal-only notification writer (not callable by clients).
create or replace function create_notification(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_dedupe text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link, dedupe_key) values (p_user, p_type, p_title, p_body, p_link, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing $$;
revoke all on function create_notification(uuid,text,text,text,text,text) from public, anon, authenticated;

create or replace function log_audit(p_action text, p_target_type text, p_target_id text, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata) values (auth.uid(), p_action, p_target_type, p_target_id, p_meta);
end $$;

-- ───────── Transactional application RPCs ─────────
create or replace function submit_application(p_opportunity_id uuid, p_cv_id uuid, p_answers jsonb default '[]')
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o opportunities%rowtype; cv_content jsonb; app_id uuid; q record; a jsonb; ans text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if not exists (select 1 from profiles where id = uid and status = 'active' and role = 'candidate') then
    raise exception 'candidate_account_required' using errcode='42501'; end if;
  select * into o from opportunities where id = p_opportunity_id;
  if not found or o.status <> 'published' then raise exception 'listing_not_open'; end if;
  if o.application_method <> 'direct' then raise exception 'not_a_direct_listing'; end if;
  if o.deadline is not null and o.deadline < now() then raise exception 'deadline_passed'; end if;
  if p_cv_id is not null then
    select content into cv_content from candidate_cvs where id = p_cv_id and user_id = uid;
    if not found then raise exception 'cv_not_found'; end if;
  end if;
  for q in select * from application_questions where opportunity_id = p_opportunity_id loop
    select x ->> 'answer' into ans from jsonb_array_elements(p_answers) x where (x ->> 'question_id')::uuid = q.id limit 1;
    if q.required and (ans is null or btrim(ans) = '') then raise exception 'missing_required_answer:%', q.id; end if;
  end loop;
  begin
    insert into applications (opportunity_id, candidate_id, cv_id, cv_snapshot) values (p_opportunity_id, uid, p_cv_id, cv_content) returning id into app_id;
  exception when unique_violation then raise exception 'duplicate_application';
  end;
  for a in select * from jsonb_array_elements(p_answers) loop
    if exists (select 1 from application_questions where id = (a ->> 'question_id')::uuid and opportunity_id = p_opportunity_id)
       and btrim(coalesce(a ->> 'answer','')) <> '' then
      insert into application_answers (application_id, question_id, answer) values (app_id, (a ->> 'question_id')::uuid, left(a ->> 'answer', 5000));
    end if;
  end loop;
  insert into application_status_history (application_id, from_status, to_status, changed_by) values (app_id, null, 'submitted', uid);
  perform create_notification(m.user_id, 'application_received', 'New application received', o.title, '/employer/opportunities/' || o.id || '/applicants', 'app:' || app_id)
    from employer_memberships m where m.employer_id = o.employer_id and m.role in ('owner','admin','recruiter');
  perform create_notification(uid, 'application_submitted', 'Application submitted', o.title, '/dashboard/applications/' || app_id, 'sub:' || app_id);
  return app_id;
end $$;

create or replace function set_application_status(p_application_id uuid, p_status application_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a applications%rowtype; o opportunities%rowtype;
begin
  select * into a from applications where id = p_application_id;
  if not found then raise exception 'not_found'; end if;
  select * into o from opportunities where id = a.opportunity_id;
  if not member_of(o.employer_id, array['owner','admin','recruiter']::member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_status in ('submitted','withdrawn') then raise exception 'invalid_status'; end if;
  if a.status in ('hired','rejected','withdrawn') then raise exception 'application_closed'; end if;
  update applications set status = p_status where id = a.id;
  insert into application_status_history (application_id, from_status, to_status, changed_by, note) values (a.id, a.status, p_status, auth.uid(), p_note);
  perform create_notification(a.candidate_id, 'application_status', 'Application update', o.title || ': ' || replace(p_status::text, '_', ' '),
    '/dashboard/applications/' || a.id, 'status:' || a.id || ':' || p_status);
end $$;

create or replace function withdraw_application(p_application_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a applications%rowtype;
begin
  select * into a from applications where id = p_application_id and candidate_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if a.status in ('hired','rejected','withdrawn') then raise exception 'application_closed'; end if;
  update applications set status = 'withdrawn' where id = a.id;
  insert into application_status_history (application_id, from_status, to_status, changed_by) values (a.id, a.status, 'withdrawn', auth.uid());
end $$;
revoke execute on function submit_application, set_application_status, withdraw_application, log_audit from public, anon;
grant execute on function submit_application, set_application_status, withdraw_application, log_audit to authenticated;

-- ───────── Row Level Security ─────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

-- profiles & candidate data
create policy profiles_self on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_applicant_visible on profiles for select using (exists (
  select 1 from applications a join opportunities o on o.id = a.opportunity_id
  where a.candidate_id = profiles.id and member_of(o.employer_id)));
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on profiles for update using (is_admin());

create policy cand_self on candidate_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cand_admin on candidate_profiles for select using (is_admin());
create policy cand_applicant on candidate_profiles for select using (exists (
  select 1 from applications a join opportunities o on o.id = a.opportunity_id where a.candidate_id = candidate_profiles.user_id and member_of(o.employer_id)));
create policy stud_self on student_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy stud_admin on student_profiles for select using (is_admin());
create policy stud_applicant on student_profiles for select using (exists (
  select 1 from applications a join opportunities o on o.id = a.opportunity_id where a.candidate_id = student_profiles.user_id and member_of(o.employer_id)));

-- employers
create policy emp_public_read on employers for select using (true);
create policy emp_create on employers for insert with check (created_by = auth.uid() and exists (select 1 from profiles where id = auth.uid() and role = 'employer' and status = 'active'));
create policy emp_update on employers for update using (member_of(id, array['owner','admin']::member_role[]) or is_admin());
create policy mem_read on employer_memberships for select using (user_id = auth.uid() or member_of(employer_id) or is_admin());
create policy mem_manage on employer_memberships for all using (member_of(employer_id, array['owner','admin']::member_role[]))
  with check (member_of(employer_id, array['owner','admin']::member_role[]) and role <> 'owner');
create policy ver_read on employer_verification_requests for select using (member_of(employer_id) or is_admin());
create policy ver_submit on employer_verification_requests for insert with check (submitted_by = auth.uid() and status = 'pending' and member_of(employer_id, array['owner','admin']::member_role[]));
create policy ver_admin on employer_verification_requests for update using (is_admin());

-- taxonomy
create policy cat_read on opportunity_categories for select using (true);
create policy cat_admin on opportunity_categories for all using (is_admin()) with check (is_admin());
create policy skill_read on skills for select using (true);
create policy skill_add on skills for insert with check (auth.uid() is not null);
create policy skill_admin on skills for all using (is_admin());

-- opportunities
create policy opp_public on opportunities for select using (status in ('published','closed'));
create policy opp_member_read on opportunities for select using (member_of(employer_id));
create policy opp_admin on opportunities for all using (is_admin()) with check (is_admin());
create policy opp_insert on opportunities for insert with check (created_by = auth.uid() and member_of(employer_id, array['owner','admin','recruiter']::member_role[]));
create policy opp_update on opportunities for update using (member_of(employer_id, array['owner','admin','recruiter']::member_role[]));
create policy opp_delete on opportunities for delete using (status = 'draft' and member_of(employer_id, array['owner','admin']::member_role[]));
create policy oskill_read on opportunity_skills for select using (true);
create policy oskill_write on opportunity_skills for all using (exists (select 1 from opportunities o where o.id = opportunity_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])))
  with check (exists (select 1 from opportunities o where o.id = opportunity_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])));
create policy saved_self on saved_opportunities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rep_insert on opportunity_reports for insert with check (reporter_id = auth.uid());
create policy rep_read on opportunity_reports for select using (reporter_id = auth.uid() or is_admin());
create policy rep_admin on opportunity_reports for update using (is_admin());

-- career documents (owner only; no employer/admin read policy by design)
create policy cv_self on candidate_cvs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cvv_self on cv_versions for all using (exists (select 1 from candidate_cvs c where c.id = cv_id and c.user_id = auth.uid()))
  with check (exists (select 1 from candidate_cvs c where c.id = cv_id and c.user_id = auth.uid()));
create policy cl_self on cover_letters for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy doc_self on candidate_documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- applications (inserts/updates only through RPCs)
create policy q_public on application_questions for select using (exists (select 1 from opportunities o where o.id = opportunity_id and o.status in ('published','closed')) or exists (select 1 from opportunities o where o.id = opportunity_id and member_of(o.employer_id)));
create policy q_write on application_questions for all using (exists (select 1 from opportunities o where o.id = opportunity_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])))
  with check (exists (select 1 from opportunities o where o.id = opportunity_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])));
create policy app_candidate on applications for select using (candidate_id = auth.uid());
create policy app_employer on applications for select using (exists (select 1 from opportunities o where o.id = opportunity_id and member_of(o.employer_id)));
create policy app_admin on applications for select using (is_admin());
create policy ans_read on application_answers for select using (exists (select 1 from applications a where a.id = application_id and (a.candidate_id = auth.uid() or exists (select 1 from opportunities o where o.id = a.opportunity_id and member_of(o.employer_id)))));
create policy adoc_read on application_documents for select using (exists (select 1 from applications a where a.id = application_id and (a.candidate_id = auth.uid() or exists (select 1 from opportunities o where o.id = a.opportunity_id and member_of(o.employer_id)))));
create policy adoc_add on application_documents for insert with check (exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid()));
create policy hist_read on application_status_history for select using (exists (select 1 from applications a where a.id = application_id and (a.candidate_id = auth.uid() or exists (select 1 from opportunities o where o.id = a.opportunity_id and member_of(o.employer_id)))));
create policy note_employer on application_notes for all using (exists (select 1 from applications a join opportunities o on o.id = a.opportunity_id where a.id = application_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])))
  with check (author_id = auth.uid() and exists (select 1 from applications a join opportunities o on o.id = a.opportunity_id where a.id = application_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])));
create policy ext_self on external_applications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy int_read on interviews for select using (exists (select 1 from applications a where a.id = application_id and (a.candidate_id = auth.uid() or exists (select 1 from opportunities o where o.id = a.opportunity_id and member_of(o.employer_id)))));
create policy int_write on interviews for all using (exists (select 1 from applications a join opportunities o on o.id = a.opportunity_id where a.id = application_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])))
  with check (exists (select 1 from applications a join opportunities o on o.id = a.opportunity_id where a.id = application_id and member_of(o.employer_id, array['owner','admin','recruiter']::member_role[])));

-- notifications & settings
create policy notif_read on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid());
revoke update on notifications from authenticated; grant update (read_at) on notifications to authenticated;
create policy prefs_self on notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy email_admin on email_delivery_logs for select using (is_admin());

-- billing & admin (writes happen with the service role on the server)
create policy plan_read on subscription_plans for select using (is_active or is_admin());
create policy plan_admin on subscription_plans for all using (is_admin()) with check (is_admin());
create policy sub_read on employer_subscriptions for select using (member_of(employer_id, array['owner','admin']::member_role[]) or is_admin());
create policy pay_read on payment_transactions for select using (member_of(employer_id, array['owner','admin']::member_role[]) or is_admin());
create policy audit_admin on audit_logs for select using (is_admin());
create policy settings_admin on platform_settings for all using (is_admin()) with check (is_admin());
create policy ai_read on ai_usage_records for select using (user_id = auth.uid() or is_admin());
create policy ai_insert on ai_usage_records for insert with check (user_id = auth.uid());
-- payment_events: RLS on, no policies => service role only.

-- ───────── Storage ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cvs','cvs',false, 5242880, array['application/pdf']),
  ('documents','documents',false, 5242880, array['application/pdf','image/jpeg','image/png']),
  ('verification','verification',false, 10485760, array['application/pdf','image/jpeg','image/png']),
  ('avatars','avatars',true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "own folder cvs/docs" on storage.objects for all to authenticated
  using (bucket_id in ('cvs','documents') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('cvs','documents') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder avatars write" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verification members" on storage.objects for all to authenticated
  using (bucket_id = 'verification' and (member_of(((storage.foldername(name))[1])::uuid, array['owner','admin']::member_role[]) or is_admin()))
  with check (bucket_id = 'verification' and member_of(((storage.foldername(name))[1])::uuid, array['owner','admin']::member_role[]));
