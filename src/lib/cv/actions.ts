'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { TEMPLATES, ACCENTS, cvSchema, emptyCv, normalizeCv, pruneCv, type Cv, type TemplateId } from './schema';

const MAX_CVS = 20;
const uuid = z.string().uuid();
const titleSchema = z.string().trim().min(1, 'Give your CV a name').max(80);
const templateSchema = z.enum(TEMPLATES);

async function candidate() {
  const s = await getSession();
  if (!s) redirect('/auth/login?next=/dashboard/cvs');
  if (s.profile.role !== 'candidate') redirect('/');
  return s;
}

export async function createCv(form: FormData) {
  const { userId, profile } = await candidate();
  const title = titleSchema.safeParse(form.get('title'));
  const mode = form.get('mode') === 'student' ? 'student' : 'general';
  const template = templateSchema.catch(mode === 'student' ? 'student' : 'professional').parse(form.get('template'));
  if (!title.success) redirect('/dashboard/cvs/new?error=title');
  const supabase = createClient();
  const { count } = await supabase.from('candidate_cvs').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if ((count ?? 0) >= MAX_CVS) redirect('/dashboard/cvs?error=limit');

  // Prefill only from details the user already gave us. Nothing is invented.
  const cv = emptyCv(mode);
  cv.personal.full_name = profile.full_name ?? ''; cv.personal.email = profile.email ?? '';
  const [{ data: cp }, { data: sp }] = await Promise.all([
    supabase.from('candidate_profiles').select('headline, summary, location, skills, links').eq('user_id', userId).maybeSingle(),
    supabase.from('student_profiles').select('institution, course, expected_graduation').eq('user_id', userId).maybeSingle(),
  ]);
  const { data: pr } = await supabase.from('profiles').select('phone').eq('id', userId).maybeSingle();
  cv.personal.phone = pr?.phone ?? '';
  if (cp) { cv.personal.links = (Array.isArray(cp.links) ? (cp.links as { label?: string; url?: string }[]) : []).slice(0, 6).map((l) => ({ label: l.label ?? '', url: l.url ?? '' }));
    cv.personal.headline = cp.headline ?? ''; cv.summary = cp.summary ?? ''; cv.personal.location = cp.location ?? ''; cv.skills.technical = cp.skills ?? []; }
  if (sp?.institution || sp?.course) cv.education = [{ institution: sp.institution ?? '', degree: sp.course ?? '', location: '', start: '', end: sp.expected_graduation ? String(sp.expected_graduation).slice(0, 4) : '', details: '' }];

  const { data, error } = await supabase.from('candidate_cvs').insert({ user_id: userId, title: title.data, template, content: pruneCv(normalizeCv(cv)), is_default: (count ?? 0) === 0 }).select('id').single();
  if (error || !data) redirect('/dashboard/cvs?error=create');
  redirect(`/dashboard/cvs/${data.id}/edit`);
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };
const saveInput = z.object({ id: uuid, title: titleSchema, template: templateSchema, content: z.unknown(), snapshot: z.boolean().optional() });

export async function saveCv(input: unknown): Promise<SaveResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: 'Your session expired. Sign in again; your edits are still on this page.' };
  const p = saveInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Check the CV name and try again.' };
  const content = normalizeCv(p.data.content);
  const checked = cvSchema.safeParse(content);
  if (!checked.success || JSON.stringify(content).length > 100_000) return { ok: false, error: 'Some CV content is too long. Shorten the longest entries and try again.' };
  const supabase = createClient();
  const { data, error } = await supabase.from('candidate_cvs').update({ title: p.data.title, template: p.data.template, content: pruneCv(content) }).eq('id', p.data.id).eq('user_id', s.userId).select('id').maybeSingle();
  if (error || !data) return { ok: false, error: 'We could not save your CV. Check your connection and try again.' };
  if (p.data.snapshot) await supabase.from('cv_versions').insert({ cv_id: p.data.id, label: 'Saved version', content: pruneCv(content) });
  revalidatePath('/dashboard/cvs');
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Tailoring never overwrites the master: the approved changes are saved as a brand-new CV. */
export async function saveTailoredCopy(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: 'Your session expired. Sign in again.' };
  const p = z.object({ title: titleSchema, template: templateSchema, content: z.unknown() }).safeParse(input);
  if (!p.success) return { ok: false, error: 'Check the CV name and try again.' };
  const supabase = createClient();
  const { count } = await supabase.from('candidate_cvs').select('*', { count: 'exact', head: true }).eq('user_id', s.userId);
  if ((count ?? 0) >= MAX_CVS) return { ok: false, error: `You can keep up to ${MAX_CVS} CVs. Delete one first.` };
  const { data, error } = await supabase.from('candidate_cvs').insert({ user_id: s.userId, title: p.data.title, template: p.data.template, content: pruneCv(normalizeCv(p.data.content)), is_default: false }).select('id').single();
  if (error || !data) return { ok: false, error: 'We could not create the tailored copy.' };
  revalidatePath('/dashboard/cvs');
  return { ok: true, id: data.id };
}

export async function duplicateCv(form: FormData) {
  const { userId } = await candidate();
  const id = uuid.safeParse(form.get('id')); if (!id.success) return;
  const supabase = createClient();
  const { count } = await supabase.from('candidate_cvs').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if ((count ?? 0) >= MAX_CVS) redirect('/dashboard/cvs?error=limit');
  const { data: src } = await supabase.from('candidate_cvs').select('title, template, content').eq('id', id.data).eq('user_id', userId).maybeSingle();
  if (!src) return;
  const { data } = await supabase.from('candidate_cvs').insert({ user_id: userId, title: `${src.title} (copy)`.slice(0, 80), template: src.template, content: src.content, is_default: false }).select('id').single();
  revalidatePath('/dashboard/cvs');
  if (data) redirect(`/dashboard/cvs/${data.id}/edit`);
}
export async function setDefaultCv(form: FormData) {
  await candidate(); const id = uuid.safeParse(form.get('id')); if (!id.success) return;
  await createClient().rpc('set_default_cv', { p_id: id.data }); revalidatePath('/dashboard/cvs');
}
export async function deleteCv(form: FormData) {
  const { userId } = await candidate(); const id = uuid.safeParse(form.get('id')); if (!id.success) return;
  await createClient().from('candidate_cvs').delete().eq('id', id.data).eq('user_id', userId); revalidatePath('/dashboard/cvs');
}
export type { Cv, TemplateId }; void ACCENTS;
