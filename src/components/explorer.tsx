import Link from 'next/link';
import { OpportunityCard, NoListings } from './opportunity-card';
import { btn, field, container } from './ui';
import { PAGE_SIZE, searchSchema } from '@/lib/validation/search';
import { getSavedIds, searchOpportunities } from '@/lib/data/opportunities';
import { getSession } from '@/lib/auth/session';

type Raw = Record<string, string | string[] | undefined>;

export async function Explorer({ basePath, rawParams, kind, title, intro }: { basePath: string; rawParams: Raw; kind?: 'job' | 'placement'; title: string; intro: string }) {
  const flat = Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const p = searchSchema.parse(flat);
  const [session, result] = await Promise.all([getSession(), searchOpportunities(p, kind)]);
  const saved = await getSavedIds(session?.userId ?? null, result.items.map((i) => i.id));
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const qs = (page: number) => { const u = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v != null && v !== '' && k !== 'page') u.set(k, String(v)); }); if (page > 1) u.set('page', String(page)); const s = u.toString(); return s ? `${basePath}?${s}` : basePath; };
  const placements = kind === 'placement';
  const label = 'mb-1 block text-sm font-medium';
  return (
    <div className={`${container} py-10`}>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-[60ch] text-ink-muted">{intro}</p>
      <form action={basePath} method="get" className="mt-8 grid gap-3 rounded-xl border border-surface-line bg-surface-soft p-4 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <div><label htmlFor="q" className={label}>Keyword</label><input id="q" name="q" defaultValue={p.q} placeholder="Title, skill or company" className={field} /></div>
        <div><label htmlFor="location" className={label}>Location</label><input id="location" name="location" defaultValue={p.location} placeholder="City, state or remote" className={field} /></div>
        {placements
          ? <div><label htmlFor="category" className={label}>Placement type</label><select id="category" name="category" defaultValue={p.category ?? ''} className={field}><option value="">All placements</option><option value="siwes">SIWES</option><option value="industrial-training">Industrial Training (IT)</option><option value="swep">SWEP</option><option value="internship">Internship</option><option value="industrial-attachment">Industrial attachment</option><option value="research-placement">Research placement</option></select></div>
          : <div><label htmlFor="type" className={label}>Type</label><select id="type" name="type" defaultValue={p.type ?? ''} className={field}><option value="">All types</option><option value="siwes">SIWES / Industrial training</option><option value="swep">SWEP</option><option value="internship">Internships</option><option value="entry">Entry-level jobs</option><option value="graduate">Graduate programmes</option><option value="job">All jobs</option><option value="placement">All student placements</option></select></div>}
        <div><label htmlFor="arrangement" className={label}>Work arrangement</label><select id="arrangement" name="arrangement" defaultValue={p.arrangement ?? ''} className={field}><option value="">Any</option><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
        <div><label htmlFor="paid" className={label}>Pay</label><select id="paid" name="paid" defaultValue={p.paid ?? ''} className={field}><option value="">Paid or unpaid</option><option value="paid">Paid / stipend listed</option><option value="unpaid">Unpaid</option></select></div>
        {placements
          ? <div><label htmlFor="course" className={label}>Your course</label><input id="course" name="course" defaultValue={p.course} placeholder="e.g. Computer Science" className={field} /></div>
        : null}
        {placements
          ? <div><label htmlFor="duration" className={label}>Max duration (weeks)</label><input id="duration" name="duration" type="number" min={1} max={104} defaultValue={p.duration} className={field} /></div>
          : <div><label htmlFor="experience" className={label}>Experience</label><select id="experience" name="experience" defaultValue={p.experience ?? ''} className={field}><option value="">Any</option><option value="none">No experience</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior</option><option value="lead">Lead</option></select></div>}
        <div><label htmlFor="sort" className={label}>Sort by</label><select id="sort" name="sort" defaultValue={p.sort ?? (p.q ? 'relevance' : 'newest')} className={field}><option value="relevance">Best match</option><option value="newest">Newest</option><option value="deadline">Closing soonest</option></select></div>
        <div className="flex items-end gap-3">
          <label className="flex min-h-[46px] items-center gap-2 text-sm font-medium"><input type="checkbox" name="verified" value="1" defaultChecked={Boolean(p.verified)} className="h-5 w-5" /> Verified employers</label>
          <button type="submit" className={btn('primary', 'ml-auto')}>Search</button>
        </div>
      </form>
      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">{result.error ? '' : `${result.total} ${result.total === 1 ? 'opportunity' : 'opportunities'} found`}</p>
      <div className="mt-3">
        {result.items.length === 0 ? <NoListings notConfigured={result.error === 'not_configured'} failed={result.error === 'failed'} /> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((o) => <li key={o.id} className="flex"><div className="flex w-full"><div className="w-full"><OpportunityCard o={o} saved={saved.has(o.id)} returnTo={qs(p.page)} /></div></div></li>)}</ul>)}
      </div>
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
          {p.page > 1 ? <Link className={btn('secondary')} href={qs(p.page - 1)}>Previous</Link> : <span />}
          <span className="text-sm text-ink-muted">Page {p.page} of {pages}</span>
          {p.page < pages ? <Link className={btn('secondary')} href={qs(p.page + 1)}>Next</Link> : <span />}
        </nav>)}
    </div>
  );
}
