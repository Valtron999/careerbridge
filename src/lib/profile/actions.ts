'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ARRANGEMENTS, basicsSchema, interestsSchema, normaliseUrl, splitList, studentSchema } from '@/lib/validation/profile';
import { safeNextPath } from '@/lib/validation/safe-url';
import type { FormState } from '@/lib/auth/actions';

const val = (f: FormData, k: string) => String(f.get(k) ?? '');
const errs = (issues: { path: PropertyKey[]; message: string }[]) => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

/** One action for the full editor and each onboarding step. `sections` says which parts of the form were submitted. */
export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: 'Your session expired. Sign in again; nothing was lost on this page.' };
  if (session.profile.role !== 'candidate') return { error: 'Only candidate accounts have a candidate profile.' };
  const sections = val(form, 'sections').split(',');
  const supabase = createClient();
  const uid = session.userId;
  const errors: Record<string, string> = {};
  const profileUpdate: Record<string, unknown> = {}, candUpdate: Record<string, unknown> = {};
  let studentRow: Record<string, unknown> | null = null;

  if (sections.includes('basics')) {
    const p = basicsSchema.safeParse(Object.fromEntries(['full_name', 'phone', 'headline', 'location', 'summary'].map((k) => [k, val(form, k)])));
    if (!p.success) Object.assign(errors, errs(p.error.issues));
    else {
      Object.assign(profileUpdate, { full_name: p.data.full_name, phone: p.data.phone || null });
      const links: { label: string; url: string }[] = [];
      for (const n of [1, 2, 3]) {
        const raw = val(form, `link_url_${n}`).trim();
        if (!raw) continue;
        const url = normaliseUrl(raw);
        if (!url) { errors[`link_url_${n}`] = 'Enter a valid web address'; continue; }
        links.push({ label: val(form, `link_label_${n}`).trim().slice(0, 40) || new URL(url).hostname, url });
      }
      Object.assign(candUpdate, { headline: p.data.headline || null, location: p.data.location || null, summary: p.data.summary || null, links,
        is_student: form.get('is_student') === 'on', visibility: { contact_visible_to_employers: form.get('contact_visible') === 'on' } });
    }
  }
  const isStudent = sections.includes('basics') ? candUpdate.is_student === true : val(form, 'student_flag') === '1';
  if (sections.includes('student') && isStudent) {
    const p = studentSchema.safeParse(Object.fromEntries(['institution', 'course', 'faculty', 'academic_level', 'expected_graduation', 'siwes_eligible', 'required_duration_weeks', 'preferred_locations'].map((k) => [k, val(form, k)])));
    if (!p.success) Object.assign(errors, errs(p.error.issues));
    else studentRow = { user_id: uid, institution: p.data.institution || null, course: p.data.course || null, faculty: p.data.faculty || null, academic_level: p.data.academic_level || null,
      expected_graduation: p.data.expected_graduation || null, siwes_eligible: p.data.siwes_eligible === 'yes' ? true : p.data.siwes_eligible === 'no' ? false : null,
      required_duration_weeks: p.data.required_duration_weeks ? Number(p.data.required_duration_weeks) : null, preferred_locations: splitList(p.data.preferred_locations, 10, 80) };
  }
  if (sections.includes('interests')) {
    const p = interestsSchema.safeParse({ skills: val(form, 'skills'), interests: val(form, 'interests') });
    if (!p.success) Object.assign(errors, errs(p.error.issues));
    else {
      const { data: cur } = await supabase.from('candidate_profiles').select('preferences').eq('user_id', uid).maybeSingle();
      Object.assign(candUpdate, { skills: splitList(p.data.skills), preferences: { ...((cur?.preferences as object) ?? {}), arrangements: form.getAll('arrangements').map(String).filter((a) => (ARRANGEMENTS as readonly string[]).includes(a)), interests: p.data.interests } });
    }
  }
  if (Object.keys(errors).length) return { fieldErrors: errors, error: 'Please fix the highlighted fields.' };

  const writes = await Promise.all([
    Object.keys(profileUpdate).length ? supabase.from('profiles').update(profileUpdate).eq('id', uid) : null,
    Object.keys(candUpdate).length ? supabase.from('candidate_profiles').upsert({ user_id: uid, ...candUpdate }, { onConflict: 'user_id' }) : null,
    studentRow ? supabase.from('student_profiles').upsert(studentRow, { onConflict: 'user_id' }) : null,
  ]);
  if (writes.some((w) => w?.error)) return { error: 'We could not save your profile. Check your connection and try again.' };
  if (form.get('finish') === '1') await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', uid);
  revalidatePath('/dashboard', 'layout');
  const next = val(form, 'next');
  if (next) redirect(safeNextPath(next));
  return { message: 'Profile saved.' };
}
