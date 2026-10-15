-- Employer workspace + moderation RPCs. All privileged transitions happen in SECURITY DEFINER functions.

-- Verification state may only change via reviewer actions or submit_verification_request (flag set inside the function).
create or replace function guard_employer() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() and coalesce(current_setting('app.allow_verification_change', true), '') <> 'on'
     and (new.verification_status <> old.verification_status or new.created_by <> old.created_by) then
    raise exception 'verification status is managed by reviewers' using errcode = '42501';
  end if;
  return new;
end $$;

-- Material edits to a live listing send it back to review.
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
      if old.status = 'published' and new.status = 'published' and (new.title <> old.title or new.description <> old.description) then
        new.status := 'pending_review'; end if;
      new.featured := old.featured; new.moderation_note := old.moderation_note;
      new.employer_id := old.employer_id; new.published_at := old.published_at;
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;

create or replace function schedule_interview(p_application_id uuid, p_at timestamptz, p_tz text, p_format text, p_details text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a applications%rowtype; o opportunities%rowtype; iid uuid;
begin
  select * into a from applications where id = p_application_id;
  if not found then raise exception 'not_found'; end if;
  select * into o from opportunities where id = a.opportunity_id;
  if not member_of(o.employer_id, array['owner','admin','recruiter']::member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if a.status in ('hired','rejected','withdrawn') then raise exception 'application_closed'; end if;
  if p_at <= now() then raise exception 'interview_in_past'; end if;
  if p_format not in ('online','physical') then raise exception 'invalid_format'; end if;
  insert into interviews (application_id, scheduled_at, timezone, format, details, created_by)
    values (a.id, p_at, coalesce(nullif(p_tz,''),'Africa/Lagos'), p_format, left(p_details, 2000), auth.uid()) returning id into iid;
  if a.status <> 'interview_scheduled' then
    update applications set status = 'interview_scheduled' where id = a.id;
    insert into application_status_history (application_id, from_status, to_status, changed_by, note) values (a.id, a.status, 'interview_scheduled', auth.uid(), 'Interview scheduled');
  end if;
  perform create_notification(a.candidate_id, 'interview_scheduled', 'Interview scheduled', o.title, '/dashboard/applications/' || a.id, 'interview:' || iid);
  return iid;
end $$;

create or replace function cancel_interview(p_interview_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i interviews%rowtype; a applications%rowtype; o opportunities%rowtype;
begin
  select * into i from interviews where id = p_interview_id;
  if not found then raise exception 'not_found'; end if;
  select * into a from applications where id = i.application_id;
  select * into o from opportunities where id = a.opportunity_id;
  if not member_of(o.employer_id, array['owner','admin','recruiter']::member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  update interviews set status = 'cancelled' where id = i.id;
  perform create_notification(a.candidate_id, 'interview_cancelled', 'Interview cancelled', o.title, '/dashboard/applications/' || a.id, 'interview-cancel:' || i.id);
end $$;

create or replace function submit_verification_request(p_employer_id uuid, p_evidence jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not member_of(p_employer_id, array['owner','admin']::member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if exists (select 1 from employer_verification_requests where employer_id = p_employer_id and status = 'pending') then raise exception 'request_pending'; end if;
  if (select verification_status from employers where id = p_employer_id) = 'verified' then raise exception 'already_verified'; end if;
  insert into employer_verification_requests (employer_id, submitted_by, evidence) values (p_employer_id, auth.uid(), p_evidence) returning id into rid;
  perform set_config('app.allow_verification_change', 'on', true);
  update employers set verification_status = 'pending' where id = p_employer_id;
  return rid;
end $$;

create or replace function moderate_opportunity(p_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o opportunities%rowtype; new_status opportunity_status;
begin
  if not is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  select * into o from opportunities where id = p_id;
  if not found then raise exception 'not_found'; end if;
  new_status := case p_decision when 'approve' then 'published' when 'reject' then 'rejected' when 'request_changes' then 'draft' else null end;
  if new_status is null then raise exception 'invalid_decision'; end if;
  if p_decision in ('reject','request_changes') and btrim(coalesce(p_note,'')) = '' then raise exception 'note_required'; end if;
  update opportunities set status = new_status, moderation_note = case when p_decision = 'approve' then null else p_note end where id = p_id;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata) values (auth.uid(), 'listing.' || p_decision, 'opportunity', p_id::text, jsonb_build_object('note', p_note));
  perform create_notification(m.user_id, 'listing_moderated', case p_decision when 'approve' then 'Listing approved' when 'reject' then 'Listing rejected' else 'Changes requested' end,
    o.title || coalesce(': ' || nullif(p_note,''), ''), '/employer/opportunities/' || o.id || '/edit', 'mod:' || o.id || ':' || p_decision || ':' || extract(epoch from now())::bigint)
    from employer_memberships m where m.employer_id = o.employer_id and m.role in ('owner','admin','recruiter');
end $$;

create or replace function review_verification(p_request_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r employer_verification_requests%rowtype; st verification_status;
begin
  if not is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  select * into r from employer_verification_requests where id = p_request_id;
  if not found then raise exception 'not_found'; end if;
  st := case p_decision when 'approve' then 'verified' when 'reject' then 'rejected' when 'needs_info' then 'needs_info' else null end;
  if st is null then raise exception 'invalid_decision'; end if;
  if p_decision <> 'approve' and btrim(coalesce(p_note,'')) = '' then raise exception 'note_required'; end if;
  update employer_verification_requests set status = st, reviewer_id = auth.uid(), review_note = p_note, reviewed_at = now() where id = r.id;
  update employers set verification_status = st where id = r.employer_id;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata) values (auth.uid(), 'verification.' || p_decision, 'employer', r.employer_id::text, jsonb_build_object('note', p_note));
  perform create_notification(m.user_id, 'verification_update', 'Verification update', 'Status: ' || replace(st::text, '_', ' ') || coalesce(' — ' || nullif(p_note,''), ''), '/employer/verification', 'ver:' || r.id || ':' || st)
    from employer_memberships m where m.employer_id = r.employer_id and m.role in ('owner','admin');
end $$;

revoke execute on function schedule_interview, cancel_interview, submit_verification_request, moderate_opportunity, review_verification from public, anon;
grant execute on function schedule_interview, cancel_interview, submit_verification_request, moderate_opportunity, review_verification to authenticated;
