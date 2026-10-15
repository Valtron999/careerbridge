-- File uploads: stricter storage policies, document rules, verification evidence.

-- A cast that returns NULL instead of raising, so policies never error on unexpected folder names.
create or replace function try_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- Verification evidence: org owners/admins manage their own folder; reviewers may only read.
drop policy if exists "verification members" on storage.objects;
create policy "verification members" on storage.objects for all to authenticated
  using (bucket_id = 'verification' and member_of(try_uuid((storage.foldername(name))[1]), array['owner','admin']::member_role[]))
  with check (bucket_id = 'verification' and member_of(try_uuid((storage.foldername(name))[1]), array['owner','admin']::member_role[]));
create policy "admins read verification" on storage.objects for select to authenticated
  using (bucket_id = 'verification' and is_admin());

-- Employers may read a candidate's file only when it is attached to an application on one of their listings.
create policy "employers read applicant documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and exists (
    select 1 from application_documents ad
    join applications a on a.id = ad.application_id
    join opportunities o on o.id = a.opportunity_id
    where ad.storage_path = storage.objects.name and member_of(o.employer_id)));

-- Candidate document rules enforced in the database, not only in the app.
alter table candidate_documents add constraint doc_path_in_own_folder check (storage_path like user_id::text || '/%');
alter table candidate_documents add constraint doc_type_known check (doc_type in ('school_letter','acceptance_letter','logbook','transcript','certificate','id_document','other'));
alter table application_documents add constraint one_attachment_per_file unique (application_id, storage_path);

-- A candidate can only attach files from their own library to their own application.
drop policy if exists adoc_add on application_documents;
create policy adoc_add on application_documents for insert with check (
  exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
  and exists (select 1 from candidate_documents d where d.user_id = auth.uid() and d.storage_path = application_documents.storage_path));

-- A file attached to an application cannot be deleted from the library (the employer still needs it).
create or replace function block_attached_doc_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from application_documents where storage_path = old.storage_path) then raise exception 'document_in_use' using errcode = '23503'; end if;
  return old;
end $$;
create trigger trg_block_attached_doc_delete before delete on candidate_documents for each row execute function block_attached_doc_delete();

-- Verification requests now carry uploaded evidence paths (each must sit in the organisation's own folder).
drop function if exists submit_verification_request(uuid, jsonb);
create or replace function submit_verification_request(p_employer_id uuid, p_evidence jsonb, p_document_paths text[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; p text;
begin
  if not member_of(p_employer_id, array['owner','admin']::member_role[]) then raise exception 'forbidden' using errcode='42501'; end if;
  if coalesce(array_length(p_document_paths, 1), 0) > 3 then raise exception 'too_many_files'; end if;
  foreach p in array p_document_paths loop
    if p not like p_employer_id::text || '/%' then raise exception 'bad_file_path' using errcode='42501'; end if;
  end loop;
  if exists (select 1 from employer_verification_requests where employer_id = p_employer_id and status = 'pending') then raise exception 'request_pending'; end if;
  if (select verification_status from employers where id = p_employer_id) = 'verified' then raise exception 'already_verified'; end if;
  insert into employer_verification_requests (employer_id, submitted_by, evidence, document_paths) values (p_employer_id, auth.uid(), p_evidence, p_document_paths) returning id into rid;
  perform set_config('app.allow_verification_change', 'on', true);
  update employers set verification_status = 'pending' where id = p_employer_id;
  return rid;
end $$;
revoke execute on function submit_verification_request(uuid, jsonb, text[]) from public, anon;
grant execute on function submit_verification_request(uuid, jsonb, text[]) to authenticated;
