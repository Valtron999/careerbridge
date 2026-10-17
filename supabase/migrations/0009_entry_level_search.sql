-- Entry-level search: the 'entry' filter now includes listings marked 'none' (no experience needed).
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
    -- "entry" also covers listings that say no experience is needed
    and (p_experience is null or o.experience_level = p_experience or (p_experience = 'entry' and o.experience_level = 'none'))
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
