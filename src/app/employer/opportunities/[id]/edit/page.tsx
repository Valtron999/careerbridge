import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireOrg, canRecruit } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { OpportunityForm } from '@/components/opportunity-form';

export const metadata: Metadata = { title: 'Edit opportunity', robots: { index: false } };
const REV: Record<string, string> = { short_text: 'short', long_text: 'long', yes_no: 'yes_no', date: 'date', number: 'number' };
export default async function Edit({ params }: { params: { id: string } }) {
  const { org, role } = await requireOrg(`/employer/opportunities/${params.id}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const s = createClient();
  const { data: o } = await s.from('opportunities').select('*, skills:opportunity_skills(skill:skills(name))').eq('id', params.id).eq('employer_id', org.id).maybeSingle();
  if (!o) notFound();
  const [{ data: cats }, { data: qs }, { count }] = await Promise.all([
    s.from('opportunity_categories').select('id, name, kind').eq('is_active', true).order('sort_order'),
    s.from('application_questions').select('prompt, type, required').eq('opportunity_id', o.id).order('sort_order'),
    s.from('applications').select('*', { count: 'exact', head: true }).eq('opportunity_id', o.id)]);
  const questions = (qs ?? []).map((q) => `${q.prompt} | ${REV[q.type] ?? 'short'}${q.required ? ' | required' : ''}`).join('\n');
  const skills = (o.skills as { skill: { name: string } | null }[]).map((k) => k.skill?.name).filter(Boolean) as string[];
  return (<div className="max-w-3xl"><h1 className="text-3xl font-bold tracking-tight">Edit opportunity</h1>
    {o.moderation_note && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Moderator note: {o.moderation_note}</p>}
    {o.status === 'published' && <p className="mt-3 rounded-lg bg-surface-soft p-3 text-sm text-ink-muted">This listing is live. Changing the title or description sends it back for review.</p>}
    {canRecruit(role) ? <div className="mt-6"><OpportunityForm o={o} categories={cats ?? []} skills={skills} questions={questions} locked={(count ?? 0) > 0} /></div> : <p className="mt-4 text-ink-muted">Your role is read-only.</p>}</div>);
}
