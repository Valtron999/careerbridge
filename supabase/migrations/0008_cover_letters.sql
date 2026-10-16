-- Cover letters: tone, pasted job context, size limits, and ownership checks on linked CVs.
alter table cover_letters
  add column tone text not null default 'professional' check (tone in ('professional','concise','enthusiastic')),
  add column job_context jsonb,
  add constraint cover_letter_body_len check (char_length(body) <= 8000),
  add constraint cover_letter_title_len check (char_length(title) between 1 and 120),
  add constraint cover_letter_job_context_size check (job_context is null or pg_column_size(job_context) <= 20000);
create index cover_letters_user_idx on cover_letters (user_id, updated_at desc);

-- A letter may only link to the owner's own CV (the old single policy did not check this).
drop policy if exists cl_self on cover_letters;
create policy cl_read on cover_letters for select using (user_id = auth.uid());
create policy cl_delete on cover_letters for delete using (user_id = auth.uid());
create policy cl_insert on cover_letters for insert with check (user_id = auth.uid()
  and (cv_id is null or exists (select 1 from candidate_cvs c where c.id = cv_id and c.user_id = auth.uid())));
create policy cl_update on cover_letters for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and (cv_id is null or exists (select 1 from candidate_cvs c where c.id = cv_id and c.user_id = auth.uid())));
