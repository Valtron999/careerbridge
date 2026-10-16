'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_GREETING, TONES, composeLetter, defaultSignoff, isTone } from './model';

const MAX_LETTERS = 30;
const uuid = z.string().uuid();
async function candidate() { const s = await getSession(); return s && s.profile.role === 'candidate' ? s : null; }

export async function createLetter(form: FormData) {
  const s = await candidate(); if (!s) redirect('/auth/login?next=/dashboard/cover-letters');
  const supabase = createClient();
  const { count } = await supabase.from('cover_letters').select('*', { count: 'exact', head: true }).eq('user_id', s.userId);
  if ((count ?? 0) >= MAX_LETTERS) redirect('/dashboard/cover-letters?error=limit');
  const slug = String(form.get('job') ?? '');
  let opp: { id: string; title: string } | null = null;
  if (/^[a-z0-9-]{1,200}$/.test(slug)) { const { data } = await supabase.from('opportunities').select('id, title').eq('slug', slug).in('status', ['published', 'closed']).maybeSingle(); opp = data; }
  const cvRaw = uuid.safeParse(form.get('cv_id'));
  let cvId: string | null = cvRaw.success ? cvRaw.data : null;
  if (!cvId) { const { data } = await supabase.from('candidate_cvs').select('id').eq('user_id', s.userId).order('is_default', { ascending: false }).limit(1).maybeSingle(); cvId = data?.id ?? null; }
  const tone = isTone(form.get('tone')) ? String(form.get('tone')) : 'professional';
  const typed = String(form.get('title') ?? '').trim().slice(0, 120);
  const title = typed || (opp ? `Cover letter: ${opp.title}`.slice(0, 120) : 'General cover letter');
  const body = composeLetter({ greeting: DEFAULT_GREETING, paragraphs: [], signoff: defaultSignoff(s.profile.full_name ?? '') });
  const { data, error } = await supabase.from('cover_letters').insert({ user_id: s.userId, opportunity_id: opp?.id ?? null, cv_id: cvId, title, body, tone }).select('id').single();
  if (error || !data) redirect('/dashboard/cover-letters?error=create');
  redirect(`/dashboard/cover-letters/${data.id}`);
}

const saveInput = z.object({
  id: uuid, title: z.string().trim().min(1, 'Give your letter a name').max(120), body: z.string().max(8000, 'The letter is too long. Keep it under 8,000 characters.'),
  tone: z.enum(TONES), cv_id: uuid.nullable(),
  job_context: z.object({ title: z.string().max(160), employer: z.string().max(160), description: z.string().max(6000) }).nullable(),
});
export type SaveLetterResult = { ok: true; savedAt: string } | { ok: false; error: string };
export async function saveLetter(input: unknown): Promise<SaveLetterResult> {
  const s = await candidate(); if (!s) return { ok: false, error: 'Your session expired. Sign in again; your text is still on this page.' };
  const p = saveInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Check the letter and try again.' };
  const ctx = p.data.job_context && (p.data.job_context.title || p.data.job_context.employer || p.data.job_context.description) ? p.data.job_context : null;
  const { data, error } = await createClient().from('cover_letters').update({ title: p.data.title, body: p.data.body, tone: p.data.tone, cv_id: p.data.cv_id, job_context: ctx }).eq('id', p.data.id).eq('user_id', s.userId).select('id').maybeSingle();
  if (error || !data) return { ok: false, error: 'We could not save your letter. Check your connection and try again.' };
  revalidatePath('/dashboard/cover-letters');
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function deleteLetter(form: FormData) {
  const s = await candidate(); const id = uuid.safeParse(form.get('id')); if (!s || !id.success) return;
  await createClient().from('cover_letters').delete().eq('id', id.data).eq('user_id', s.userId); revalidatePath('/dashboard/cover-letters');
}
export async function duplicateLetter(form: FormData) {
  const s = await candidate(); const id = uuid.safeParse(form.get('id')); if (!s || !id.success) return;
  const supabase = createClient();
  const { count } = await supabase.from('cover_letters').select('*', { count: 'exact', head: true }).eq('user_id', s.userId);
  if ((count ?? 0) >= MAX_LETTERS) redirect('/dashboard/cover-letters?error=limit');
  const { data: src } = await supabase.from('cover_letters').select('title, body, tone, cv_id, opportunity_id, job_context').eq('id', id.data).eq('user_id', s.userId).maybeSingle();
  if (!src) return;
  const { data } = await supabase.from('cover_letters').insert({ ...src, user_id: s.userId, title: `${src.title} (copy)`.slice(0, 120) }).select('id').single();
  revalidatePath('/dashboard/cover-letters'); if (data) redirect(`/dashboard/cover-letters/${data.id}`);
}
