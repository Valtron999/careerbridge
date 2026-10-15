import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Audit logs', robots: { index: false } };
export default async function Audit() {
  await requireRole(['admin', 'super_admin'], '/admin/audit-logs');
  const { data } = await createClient().from('audit_logs').select('id, action, target_type, target_id, metadata, created_at, actor:profiles(full_name, email)').order('created_at', { ascending: false }).limit(100);
  return (<div><h1 className="text-3xl font-bold tracking-tight">Audit logs</h1>
    <div className="mt-6 overflow-x-auto rounded-xl border border-surface-line"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-surface-soft text-ink-muted"><tr><th className="p-3">When (WAT)</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Target</th></tr></thead>
      <tbody>{(data ?? []).map((l) => { const a = l.actor as unknown as { full_name: string | null; email: string | null } | null; return (
        <tr key={l.id} className="border-t border-surface-line"><td className="p-3 whitespace-nowrap">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(l.created_at))}</td><td className="p-3">{a?.full_name ?? a?.email ?? '—'}</td><td className="p-3 font-medium">{l.action}</td><td className="p-3 [overflow-wrap:anywhere]">{l.target_type} {l.target_id}</td></tr>); })}
        {(data ?? []).length === 0 && <tr><td colSpan={4} className="p-4 text-ink-muted">No entries yet.</td></tr>}</tbody></table></div></div>);
}
