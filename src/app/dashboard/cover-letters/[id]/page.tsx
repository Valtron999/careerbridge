import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { LetterEditor } from '@/components/letters/letter-editor';
import { isTone, parseLetter } from '@/lib/letters/model';
import { aiConfigured } from '@/lib/ai';

export const metadata: Metadata = { title: 'Edit cover letter', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default async function EditLetter({ params }: { params: { id: string } }) {
  const { userId } = await requireUser(`/dashboard/cover-letters/${params.id}`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const { data: l } = await supabase.from('cover_letters').select('id, title, body, tone, cv_id, job_context, opportunity:opportunities(slug, title, employer:employers(name))').eq('id', params.id).eq('user_id', userId).maybeSingle();
  if (!l) notFound();
  const { data: cvs } = await supabase.from('candidate_cvs').select('id, title').eq('user_id', userId).order('is_default', { ascending: false });
  const o = l.opportunity as unknown as { slug: string; title: string; employer: { name: string } | null } | null;
  const ctx = (l.job_context ?? {}) as { title?: string; employer?: string; description?: string };
  return <LetterEditor key={l.id} id={l.id} initialTitle={l.title} initialTone={isTone(l.tone) ? l.tone : 'professional'} initialCvId={l.cv_id} initialParts={parseLetter(l.body)}
    initialJob={{ title: ctx.title ?? '', employer: ctx.employer ?? '', description: ctx.description ?? '' }} cvs={cvs ?? []}
    linked={o ? { slug: o.slug, title: o.title, employer: o.employer?.name ?? '' } : null} aiEnabled={aiConfigured()} />;
}
