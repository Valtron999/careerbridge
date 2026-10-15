import Link from 'next/link';
import { Bookmark, BadgeCheck, MapPin } from 'lucide-react';
import { Tag } from './ui';
import { toggleSave } from '@/lib/data/actions';
import { formatCompensation, formatDate, formatLocation, ARRANGEMENT_LABEL } from '@/lib/format';
import type { OpportunityCardData } from '@/lib/data/opportunities';

export const hrefFor = (o: { kind: string; slug: string }) => `/${o.kind === 'placement' ? 'placements' : 'jobs'}/${o.slug}`;

export function OpportunityCard({ o, saved, returnTo }: { o: OpportunityCardData; saved: boolean; returnTo: string }) {
  const pay = formatCompensation(o);
  const deadline = formatDate(o.deadline);
  return (
    <article className="relative flex flex-col gap-3 rounded-xl border border-surface-line bg-white p-5 transition hover:border-brand/50 hover:shadow-md motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">
            <Link href={hrefFor(o)} className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-xl">{o.title}</Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
            <span className="[overflow-wrap:anywhere]">{o.employer?.name ?? 'Employer'}</span>
            {o.employer?.verification_status === 'verified' && <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck size={15} aria-hidden /> <span className="text-xs font-semibold">Verified</span></span>}
          </p>
        </div>
        <form action={toggleSave} className="relative z-10 shrink-0">
          <input type="hidden" name="opportunity_id" value={o.id} /><input type="hidden" name="next" value={returnTo} />
          <button type="submit" aria-label={saved ? `Remove ${o.title} from saved` : `Save ${o.title}`} aria-pressed={saved}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-line text-ink-muted hover:text-brand">
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </form>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={15} aria-hidden /> {formatLocation(o)}</p>
      <div className="flex flex-wrap gap-1.5">
        {o.category && <Tag>{o.category.name}</Tag>}
        <Tag tone="muted">{ARRANGEMENT_LABEL[o.work_arrangement]}</Tag>
        {o.placement_duration_weeks && <Tag tone="muted">{o.placement_duration_weeks} weeks</Tag>}
        {pay && <Tag tone={o.is_unpaid ? 'warn' : 'ok'}>{pay}</Tag>}
      </div>
      <p className="mt-auto text-xs text-ink-muted">{o.published_at ? `Posted ${formatDate(o.published_at)}` : ''}{deadline ? ` · Deadline ${deadline}` : ''}</p>
    </article>
  );
}

export function NoListings({ notConfigured, failed }: { notConfigured?: boolean; failed?: boolean }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">{failed ? 'We could not load opportunities' : notConfigured ? 'The database is not connected yet' : 'No opportunities match yet'}</h3>
      <p className="mx-auto mt-2 max-w-[52ch] text-ink-muted">
        {failed ? 'Something went wrong on our side. Refresh the page or try again shortly.'
          : notConfigured ? 'Add your Supabase environment variables to see published listings here.'
          : 'Try fewer filters, or check back soon. Employers publish new opportunities regularly.'}
      </p>
    </div>
  );
}
