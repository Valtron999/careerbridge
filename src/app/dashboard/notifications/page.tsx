import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };
export default async function Notifications() {
  const { userId } = await requireUser('/dashboard/notifications');
  const { data } = await createClient().from('notifications').select('id, title, body, link, read_at, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  return (<div><h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
    {(data ?? []).length === 0 ? <p className="mt-4 text-ink-muted">Nothing here yet.</p> : (
      <ul className="mt-6 divide-y divide-surface-line rounded-xl border border-surface-line">{(data ?? []).map((n) => (
        <li key={n.id} className="p-4"><p className={n.read_at ? '' : 'font-semibold'}>{n.link ? <Link className="hover:text-brand" href={n.link}>{n.title}</Link> : n.title}</p>
          {n.body && <p className="text-sm text-ink-muted">{n.body}</p>}<p className="text-xs text-ink-muted">{formatDate(n.created_at)}</p></li>))}</ul>)}</div>);
}
