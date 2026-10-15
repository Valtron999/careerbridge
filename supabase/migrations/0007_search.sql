-- Search over employer name, skills, category and eligible courses, with prefix matching, relevance ranking and a course filter.

alter table opportunities add column search_extra text not null default '';
alter table opportunities drop column search_vector;  -- drops its index too
alter table opportunities add column search_vector tsvector generated always as (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(search_extra, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(location_city, '') || ' ' || coalesce(location_state, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'C')) stored;
create index opportunities_search_idx on opportunities using gin (search_vector);

-- Denormalised text (employer, category, skills, courses) that the generated vector above is built from.
create or replace function rebuild_search_extra(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select btrim(concat_ws(' ',
    (select e.name from employers e where e.id = o.employer_id),
    (select c.name from opportunity_categories c where c.id = o.category_id),
    (select string_agg(s.name, ' ') from opportunity_skills os join skills s on s.id = os.skill_id where os.opportunity_id = o.id),
    array_to_string(o.eligible_courses, ' '))) into v from opportunities o where o.id = p_id;
  update opportunities set search_extra = coalesce(v, '') where id = p_id and search_extra is distinct from coalesce(v, '');
end $$;
revoke execute on function rebuild_search_extra(uuid) from public, anon, authenticated;

create or replace function trg_rebuild_from_opportunity() returns trigger language plpgsql security definer set search_path = public as $$
begin perform rebuild_search_extra(new.id); return null; end $$;
create trigger rebuild_search_ins after insert on opportunities for each row execute function trg_rebuild_from_opportunity();
create trigger rebuild_search_upd after update of employer_id, category_id, eligible_courses on opportunities for each row execute function trg_rebuild_from_opportunity();

create or replace function trg_rebuild_from_skill_link() returns trigger language plpgsql security definer set search_path = public as $$
begin perform rebuild_search_extra(coalesce(new.opportunity_id, old.opportunity_id)); return null; end $$;
create trigger rebuild_search_skill_link after insert or delete on opportunity_skills for each row execute function trg_rebuild_from_skill_link();

create or replace function trg_rebuild_from_employer() returns trigger language plpgsql security definer set search_path = public as $$
begin perform rebuild_search_extra(id) from opportunities where employer_id = new.id; return null; end $$;
create trigger rebuild_search_employer after update of name on employers for each row execute function trg_rebuild_from_employer();

do $$ declare r record; begin for r in select id from opportunities loop perform rebuild_search_extra(r.id); end loop; end $$;

-- Fix: a non-admin update that leaves a rejected listing rejected (for example the search refresh) must not raise.
-- (Keeps the 0004 rule that editing a live listing's title or description sends it back to review.)
create or replace function guard_opportunity() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then
      if new.status not in ('draft','pending_review') then raise exception 'new listings must be draft or pending_review' using errcode='42501'; end if;
      new.featured := false; new.moderation_note := null; new.source := 'employer';
    else
      if new.status = 'published' and old.status not in ('published','paused') then
        raise exception 'listings must be approved by a moderator before publishing' using errcode='42501'; end if;
      if new.status = 'rejected' and old.status <> 'rejected' then raise exception 'only moderators can reject' using errcode='42501'; end if;
      if old.status = 'published' and new.status = 'published' and (new.title <> old.title or new.description <> old.description) then
        new.status := 'pending_review'; end if;
      new.featured := old.featured; new.moderation_note := old.moderation_note;
      new.employer_id := old.employer_id; new.published_at := old.published_at;
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;

-- One search entry point: filters, relevance ranking, pagination and the total count in a single call. SECURITY INVOKER, so RLS still applies.
create or replace function search_opportunities(
  p_q text default null, p_location text default null, p_kind opportunity_kind default null, p_category_slugs text[] default null,
  p_arrangement work_arrangement default null, p_experience text default null, p_paid text default null, p_duration int default null,
  p_verified boolean default false, p_course text default null, p_sort text default 'newest', p_limit int default 12, p_offset int default 0)
returns table (id uuid, total bigint) language sql stable security invoker set search_path = public as $$
  with prm as (select
      case when coalesce(btrim(p_q), '') = '' then null else to_tsquery('simple', p_q) end as tsq,
      lower(btrim(coalesce(p_location, ''))) as loc,
      '%' || replace(replace(replace(btrim(coalesce(p_location, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as locpat,
      '%' || replace(replace(replace(btrim(coalesce(p_course, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as coursepat,
      btrim(coalesce(p_course, '')) <> '' as has_course)
  select o.id, count(*) over () as total
  from opportunities o
  join employers e on e.id = o.employer_id
  left join opportunity_categories c on c.id = o.category_id
  cross join prm
  where o.status = 'published' and (o.deadline is null or o.deadline >= now())
    and (p_kind is null or o.kind = p_kind)
    and (p_category_slugs is null or c.slug = any (p_category_slugs))
    and (prm.tsq is null or o.search_vector @@ prm.tsq)
    and (p_arrangement is null or o.work_arrangement = p_arrangement)
    and (prm.loc = '' or (prm.loc = 'remote' and o.work_arrangement = 'remote')
         or (prm.loc <> 'remote' and (o.location_city ilike prm.locpat or o.location_state ilike prm.locpat or o.location_country ilike prm.locpat)))
    and (p_experience is null or o.experience_level = p_experience)
    and (p_paid is null or (p_paid = 'unpaid' and o.is_unpaid) or (p_paid = 'paid' and not o.is_unpaid and (o.salary_min is not null or o.salary_max is not null)))
    and (p_duration is null or o.placement_duration_weeks <= p_duration)
    and (not coalesce(p_verified, false) or e.verification_status = 'verified')
    -- listings that name no courses are open to every course, so they match too
    and (not prm.has_course or cardinality(o.eligible_courses) = 0 or exists (select 1 from unnest(o.eligible_courses) ec where ec ilike prm.coursepat))
  order by
    case when p_sort = 'relevance' and prm.tsq is not null then ts_rank(o.search_vector, prm.tsq) end desc nulls last,
    case when p_sort = 'deadline' then o.deadline end asc nulls last,
    o.published_at desc nulls last, o.id
  limit greatest(1, least(coalesce(p_limit, 12), 50)) offset greatest(0, coalesce(p_offset, 0))
$$;
grant execute on function search_opportunities to anon, authenticated;
