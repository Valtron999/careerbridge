import { describe, expect, it } from 'vitest';
import { as, ids } from './helpers';
import { searchOpportunities, getOpportunity, getFeatured, getSimilar } from '../../src/lib/data/opportunities';
import { searchSchema } from '../../src/lib/validation/search';

const anon = as('anon');
const q = (o: Record<string, string | undefined>, kind?: 'job' | 'placement') => searchOpportunities(searchSchema.parse(o), kind, anon);
const slugs = (r: { items: { slug: string }[] }) => r.items.map((i) => i.slug);

describe('search against a real database', () => {
  it('shows only published, unexpired listings to the public', async () => {
    const all: string[] = [];
    for (let page = 1; page <= 4; page++) all.push(...slugs(await q({ page: String(page) })));
    expect(new Set(all)).toEqual(new Set(ids.visible));
    for (const hidden of ['draft-job', 'expired-job', 'closed-job']) expect(all).not.toContain(hidden);
  });
  it('paginates with a correct total and no overlap', async () => {
    const p1 = await q({}), p2 = await q({ page: '2' }), far = await q({ page: '99' });
    expect(p1.items).toHaveLength(12); expect(p1.total).toBe(ids.visible.length);
    expect(p2.items.length).toBe(ids.visible.length - 12); expect(p2.total).toBe(ids.visible.length);
    expect(new Set([...slugs(p1), ...slugs(p2)]).size).toBe(ids.visible.length);
    expect(far.items).toEqual([]); expect(far.total).toBe(ids.visible.length); // empty page still reports the real total
  });
  it('finds listings by employer name', async () => {
    const r = await q({ q: 'zenith' }); expect(slugs(r).sort()).toEqual(['civil-placement', 'data-analyst', 'direct-job', 'external-job', 'remote-support']);
  });
  it('finds listings by skill, including prefixes', async () => {
    expect(slugs(await q({ q: 'sql' }))).toEqual(['data-analyst']);
    expect(slugs(await q({ q: 'exc' }))).toEqual(['data-analyst']);
    expect(slugs(await q({ q: 'welding' }))).toEqual(['civil-placement']);
  });
  it('requires every word to match', async () => { expect(slugs(await q({ q: 'sql welding' }))).toEqual([]); });
  it('filters placements by course and keeps listings open to all courses', async () => {
    expect(slugs(await q({ course: 'computer science' }, 'placement')).sort()).toEqual(['office-placement', 'swe-placement']);
    expect(slugs(await q({ course: 'civil' }, 'placement')).sort()).toEqual(['civil-placement', 'office-placement']);
    expect(slugs(await q({ course: 'law' }, 'placement'))).toEqual(['office-placement']);
  });
  it('finds placements by course word in the keyword search too', async () => { expect(slugs(await q({ q: 'civil' }, 'placement'))).toContain('civil-placement'); });
  it('ranks title matches above description-only matches', async () => {
    const r = slugs(await q({ q: 'engineer', sort: 'relevance' })); expect(r.indexOf('engineer-title')).toBeLessThan(r.indexOf('engineer-desc')); expect(r).toContain('engineer-desc');
  });
  it('defaults to best match when a keyword is given', async () => { const r = slugs(await q({ q: 'engineer' })); expect(r.slice(0, 2).sort()).toEqual(['engineer-title', 'swe-placement']); expect(r.indexOf('civil-placement')).toBeLessThan(r.indexOf('engineer-desc')); expect(r.at(-1)).toBe('engineer-desc'); }); // title (A) > course/skill/employer text (B) > description (C) // "engineer" also prefix-matches "Engineering" in a title
  it('filters by location, remote, state, type and category', async () => {
    expect(slugs(await q({ location: 'lagos' })).sort()).toEqual(['data-analyst', 'office-placement']);
    expect(slugs(await q({ location: 'remote' }))).toEqual(['remote-support']);
    expect(slugs(await q({ arrangement: 'remote' }))).toEqual(['remote-support']);
    expect(slugs(await q({ location: 'rivers' }))).toEqual(['civil-placement']);
    expect(slugs(await q({ type: 'siwes' })).sort()).toEqual(['civil-placement', 'swe-placement']);
    expect(slugs(await q({ type: 'swep' }))).toEqual(['office-placement']);
    expect(slugs(await q({ type: 'graduate' }))).toEqual(['engineer-title']);
    expect((await q({ type: 'placement' })).total).toBe(3);
  });
  it('entry-level jobs include listings that need no experience, and only jobs', async () => {
    expect(slugs(await q({ type: 'entry' })).sort()).toEqual(['data-analyst', 'remote-support']);
    expect(slugs(await q({ experience: 'entry' })).sort()).toEqual(['data-analyst', 'remote-support']);
    expect(slugs(await q({ experience: 'none' }))).toEqual(['remote-support']);
  });
  it('treats % and _ in locations literally', async () => { expect((await q({ location: '%' })).total).toBe(0); expect((await q({ location: '_' })).total).toBe(0); });
  it('filters by pay, duration and verified employer', async () => {
    expect(slugs(await q({ paid: 'unpaid' }))).toEqual(['swe-placement']);
    expect(slugs(await q({ paid: 'paid' }))).toEqual(['civil-placement']);
    expect(slugs(await q({ duration: '12' }, 'placement')).sort()).toEqual(['civil-placement', 'office-placement']);
    expect(slugs(await q({ verified: '1' })).sort()).toEqual(['civil-placement', 'data-analyst', 'direct-job', 'external-job', 'remote-support']);
  });
  it('sorts by deadline without erroring', async () => { expect((await q({ sort: 'deadline' })).items.length).toBe(12); });
  it('survives hostile input without errors or damage', async () => {
    for (const evil of ["'; drop table opportunities; --", '":*|&!()<>', '%00 \\ \\\\', 'a'.repeat(100)]) { const r = await q({ q: evil }); expect(r.error).toBeUndefined(); }
    expect((await q({})).total).toBe(ids.visible.length);
  });
  it('returns a clean empty result for symbols-only keywords', async () => { const r = await q({ q: '!!!' }); expect(r).toEqual({ items: [], total: 0 }); });
});

describe('detail and feature queries', () => {
  it('loads a listing with employer, category and skills', async () => {
    const o = await getOpportunity('data-analyst', anon);
    expect(o?.employer?.name).toBe('Zenith Labs'); expect(o?.category?.slug).toBe('full-time');
    expect(o?.skills.map((s) => s.skill?.name).sort()).toEqual(['Excel', 'SQL']);
  });
  it('hides drafts from the public but shows closed listings (labelled in the UI)', async () => {
    expect(await getOpportunity('draft-job', anon)).toBeNull(); expect((await getOpportunity('closed-job', anon))?.status).toBe('closed');
  });
  it('lets only the owning employer read their draft (public detail pages never show drafts)', async () => {
    const draft = (who: 'e1' | 'e2' | 'anon') => as(who).from('opportunities').select('status').eq('slug', 'draft-job');
    expect((await draft('e1')).data).toEqual([{ status: 'draft' }]); expect((await draft('e2')).data).toEqual([]); expect((await draft('anon')).data).toEqual([]);
    expect(await getOpportunity('draft-job', as('e1'))).toBeNull();
  });
  it('returns featured and similar listings', async () => {
    expect((await getFeatured('placement', 3, anon)).length).toBe(3);
    const o = (await getOpportunity('data-analyst', anon))!;
    const sim = await getSimilar(o, 3, anon); expect(sim.length).toBe(3); expect(sim.map((s) => s.id)).not.toContain(o.id);
  });
});
