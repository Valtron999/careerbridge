import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, ExternalLink, Mail } from 'lucide-react';
import { ButtonLink, Tag, container, btn } from './ui';
import { OpportunityCard } from './opportunity-card';
import { ReportForm } from './report-form';
import { getOpportunity, getSimilar, getSavedIds } from '@/lib/data/opportunities';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { markAppliedExternally, toggleSave } from '@/lib/data/actions';
import { ARRANGEMENT_LABEL, EMPLOYMENT_LABEL, formatCompensation, formatDate, formatLocation, listingState } from '@/lib/format';
import { isSafeExternalUrl } from '@/lib/validation/safe-url';

function Block({ title, children }: { title: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <section className="mt-8"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-2 whitespace-pre-line text-slate-700 [overflow-wrap:anywhere]">{children}</div></section>;
}

export async function OpportunityDetail({ slug, path }: { slug: string; path: string }) {
  const o = await getOpportunity(slug);
  if (!o) notFound();
  const session = await getSession();
  const state = listingState(o);
  const pay = formatCompensation(o);
  const [similar, saved] = await Promise.all([getSimilar(o), getSavedIds(session?.userId ?? null, [o.id])]);
  let external: { state: string; applied_on: string | null } | null = null;
  if (session && o.application_method === 'external') {
    const { data } = await createClient().from('external_applications').select('state, applied_on').eq('user_id', session.userId).eq('opportunity_id', o.id).maybeSingle();
    external = data;
  }
  let defaultCvId: string | null = null;
  if (session?.profile.role === 'candidate') { const { data } = await createClient().from('candidate_cvs').select('id').eq('user_id', session.userId).order('is_default', { ascending: false }).order('updated_at', { ascending: false }).limit(1).maybeSingle(); defaultCvId = data?.id ?? null; }
  const extHost = o.external_url && isSafeExternalUrl(o.external_url) ? new URL(o.external_url).hostname : null;
  const skills = o.skills.map((s) => s.skill?.name).filter(Boolean) as string[];
  const row = (k: string, v: React.ReactNode) => v ? <div className="flex justify-between gap-4 border-b border-surface-line py-2 text-sm last:border-0"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium [overflow-wrap:anywhere]">{v}</dd></div> : null;

  const jsonLd = o.kind === 'job' && state === 'open' && o.published_at && o.employer ? {
    '@context': 'https://schema.org', '@type': 'JobPosting', title: o.title, description: o.description, datePosted: o.published_at,
    ...(o.deadline ? { validThrough: o.deadline } : {}), hiringOrganization: { '@type': 'Organization', name: o.employer.name },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: o.location_city ?? undefined, addressRegion: o.location_state ?? undefined, addressCountry: o.location_country ?? undefined } },
    ...(o.work_arrangement === 'remote' ? { jobLocationType: 'TELECOMMUTE' } : {}),
  } : null;

  return (
    <div className={`${container} py-10`}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <Link href={o.kind === 'placement' ? '/placements' : '/jobs'} className="text-sm font-medium text-brand">← Back to results</Link>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {o.category && <Tag>{o.category.name}</Tag>}
            {o.employment_type && <Tag tone="muted">{EMPLOYMENT_LABEL[o.employment_type] ?? o.employment_type}</Tag>}
            <Tag tone="muted">{ARRANGEMENT_LABEL[o.work_arrangement]}</Tag>
            {state !== 'open' && <Tag tone="warn">{state === 'expired' ? 'Deadline passed' : 'Closed'}</Tag>}
            {o.source === 'import' && <Tag tone="muted">Imported listing</Tag>}
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{o.title}</h1>
          {o.employer && <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-muted">
            <Link className="font-medium text-ink hover:text-brand" href={`/companies/${o.employer.slug}`}>{o.employer.name}</Link>
            {o.employer.verification_status === 'verified' ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-ok"><BadgeCheck size={16} aria-hidden /> Verified by CareerBridge</span> : <span className="text-sm">Not yet verified</span>}
          </p>}
          <Block title="About this opportunity">{o.description}</Block>
          <Block title="Responsibilities">{o.responsibilities}</Block>
          <Block title="Requirements">{o.requirements}</Block>
          <Block title="Qualifications">{o.qualifications}</Block>
          <Block title="Benefits">{o.benefits}</Block>
          {skills.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Skills</h2><div className="mt-2 flex flex-wrap gap-1.5">{skills.map((s) => <Tag key={s} tone="muted">{s}</Tag>)}</div></section>}
          <Block title="Application instructions">{o.application_instructions}</Block>
          {o.source === 'import' && <p className="mt-8 rounded-lg bg-surface-soft p-4 text-sm text-ink-muted">This listing was imported from another source{o.last_verified_at ? ` and last checked on ${formatDate(o.last_verified_at)}` : ' and has not been re-checked recently'}. Confirm details with the original source before applying.</p>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-surface-line p-5">
            {state !== 'open' ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">{state === 'expired' ? 'The application deadline has passed.' : 'This opportunity is closed.'}</p>
              : o.application_method === 'direct' ? (
                <div><ButtonLink href={session ? `/apply/${o.slug}` : `/auth/login?next=${encodeURIComponent(`/apply/${o.slug}`)}`} className="w-full">Apply on CareerBridge</ButtonLink>
                  {!session && <p className="mt-2 text-xs text-ink-muted">You will be asked to sign in first.</p>}</div>
              ) : (
                <div className="space-y-3">
                  {o.external_url && extHost && <><a href={`/go/${o.slug}`} rel="noopener noreferrer" className={btn('primary', 'w-full')}>Apply on {extHost} <ExternalLink size={16} aria-hidden /></a>
                    <p className="text-xs text-ink-muted">You will leave CareerBridge. {o.employer?.name ?? 'The employer'} controls that process, and we cannot confirm whether an application there was received.</p></>}
                  {o.external_email && <p className="text-sm"><Mail size={15} className="mr-1 inline" aria-hidden />Apply by email: <a className="font-semibold text-brand [overflow-wrap:anywhere]" href={`mailto:${o.external_email}?subject=${encodeURIComponent(`Application: ${o.title}`)}`}>{o.external_email}</a></p>}
                  {session && (external?.state === 'self_reported_applied'
                    ? <p className="rounded-lg bg-ok-tint p-3 text-sm text-ok">You marked this as applied{external.applied_on ? ` on ${formatDate(external.applied_on)}` : ''}. This is self-reported.</p>
                    : <form action={markAppliedExternally} className="border-t border-surface-line pt-3"><input type="hidden" name="opportunity_id" value={o.id} /><input type="hidden" name="next" value={path} />
                        <button className={btn('secondary', 'w-full')} type="submit">I applied externally</button><p className="mt-1 text-xs text-ink-muted">Tracked in your dashboard as self-reported.</p></form>)}
                </div>)}
            <form action={toggleSave} className="mt-3"><input type="hidden" name="opportunity_id" value={o.id} /><input type="hidden" name="next" value={path} />
              <button type="submit" className={btn('secondary', 'w-full')}>{saved.has(o.id) ? 'Saved ✓ (remove)' : 'Save for later'}</button></form>
          </div>
          {state === 'open' && session?.profile.role === 'candidate' && <Link href={defaultCvId ? `/dashboard/cvs/${defaultCvId}/edit?job=${o.slug}` : '/dashboard/cvs/new'} className={btn('secondary', 'w-full')}>{defaultCvId ? 'Tailor my CV to this role' : 'Build a CV for this role'}</Link>}
          {state === 'open' && session?.profile.role === 'candidate' && <Link href={`/dashboard/cover-letters/new?job=${o.slug}`} className={btn('secondary', 'w-full')}>Write a cover letter for this role</Link>}
          <dl className="rounded-xl border border-surface-line px-5 py-3">
            {row('Location', formatLocation(o))}
            {row('Compensation', pay ?? 'Not specified')}
            {o.compensation_note && row('Note', o.compensation_note)}
            {row('Experience', o.experience_level ? o.experience_level.replace('_', ' ') : null)}
            {row('Education', o.education_level)}
            {row('Duration', o.placement_duration_weeks ? `${o.placement_duration_weeks} weeks` : null)}
            {row('Start date', formatDate(o.start_date))}
            {row('Positions', o.positions_available)}
            {row('Posted', formatDate(o.published_at))}
            {row('Deadline', formatDate(o.deadline) ?? 'Not specified')}
            {row('Eligible courses', o.eligible_courses.length ? o.eligible_courses.join(', ') : null)}
            {row('Eligible institutions', o.eligible_institutions.length ? o.eligible_institutions.join(', ') : null)}
            {row('Documents needed', o.required_documents.length ? o.required_documents.join(', ') : null)}
          </dl>
          {o.kind === 'placement' && <p className="text-xs text-ink-muted">Eligibility and documentation requirements vary by school and organisation. CareerBridge cannot guarantee placement acceptance or school approval.</p>}
          <ReportForm opportunityId={o.id} signedIn={Boolean(session)} loginNext={path} />
        </aside>
      </div>
      {similar.length > 0 && <section className="mt-14"><h2 className="text-2xl font-semibold">Similar opportunities</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <li key={s.id} className="flex"><div className="w-full"><OpportunityCard o={s} saved={false} returnTo={path} /></div></li>)}</ul></section>}
    </div>
  );
}
