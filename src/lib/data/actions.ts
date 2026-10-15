'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/validation/safe-url';

export type ActionState = { error?: string; message?: string };
const uuid = z.string().uuid();

export async function toggleSave(form: FormData) {
  const id = uuid.safeParse(form.get('opportunity_id'));
  const next = safeNextPath(String(form.get('next') ?? ''), '/jobs');
  const session = await getSession();
  if (!session) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  if (!id.success) return;
  const supabase = createClient();
  const { data: existing } = await supabase.from('saved_opportunities').select('opportunity_id').eq('user_id', session.userId).eq('opportunity_id', id.data).maybeSingle();
  if (existing) await supabase.from('saved_opportunities').delete().eq('user_id', session.userId).eq('opportunity_id', id.data);
  else await supabase.from('saved_opportunities').insert({ user_id: session.userId, opportunity_id: id.data });
  revalidatePath('/', 'layout');
}

const reportSchema = z.object({ opportunity_id: uuid, reason: z.enum(['scam', 'misleading', 'discriminatory', 'duplicate', 'expired', 'other']), details: z.string().trim().max(2000).optional() });
export async function reportOpportunity(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { error: 'Sign in to report a listing.' };
  const parsed = reportSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Choose a reason for the report.' };
  const { error } = await createClient().from('opportunity_reports').insert({ ...parsed.data, details: parsed.data.details || null, reporter_id: session.userId });
  if (error?.code === '23505') return { message: 'You have already reported this listing. Our team will review it.' };
  if (error) return { error: 'We could not send your report. Please try again.' };
  return { message: 'Thank you. Our team will review this listing.' };
}

export async function markAppliedExternally(form: FormData) {
  const id = uuid.safeParse(form.get('opportunity_id'));
  const next = safeNextPath(String(form.get('next') ?? ''), '/jobs');
  const session = await getSession();
  if (!session) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  if (!id.success) return;
  const date = String(form.get('applied_on') ?? '');
  const applied_on = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  await createClient().from('external_applications').upsert(
    { user_id: session.userId, opportunity_id: id.data, state: 'self_reported_applied', applied_on }, { onConflict: 'user_id,opportunity_id' });
  revalidatePath(next);
}

const ERRORS: Record<string, string> = {
  duplicate_application: 'You have already applied to this opportunity.',
  deadline_passed: 'The application deadline has passed.',
  listing_not_open: 'This opportunity is no longer accepting applications.',
  not_a_direct_listing: 'This opportunity uses an external application process.',
  candidate_account_required: 'Only candidate accounts can submit applications.',
  cv_not_found: 'The selected CV could not be found.',
};
export async function submitApplication(_: ActionState, form: FormData): Promise<ActionState> {
  const opp = uuid.safeParse(form.get('opportunity_id'));
  if (!opp.success) return { error: 'Invalid opportunity.' };
  const cvRaw = String(form.get('cv_id') ?? '');
  const cv = cvRaw ? uuid.safeParse(cvRaw) : null;
  if (cv && !cv.success) return { error: 'Invalid CV selection.' };
  const answers = [...form.entries()].filter(([k]) => k.startsWith('q_')).map(([k, v]) => ({ question_id: k.slice(2), answer: String(v).slice(0, 5000) }));
  const { data, error } = await createClient().rpc('submit_application', { p_opportunity_id: opp.data, p_cv_id: cv?.success ? cv.data : null, p_answers: answers });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (error.message.includes('missing_required_answer')) return { error: 'Please answer all required questions.' };
    if (error.message.includes('not_authenticated') || error.code === '28000') return { error: 'Your session expired. Sign in again to continue.' };
    return { error: key ? ERRORS[key] : 'We could not submit your application. Please try again.' };
  }
  // Attach chosen documents. Each must come from the applicant's own library; the database re-checks this.
  const picks = [...form.entries()].filter(([k, v]) => k.startsWith('doc_') && !k.startsWith('doc_label_') && uuid.safeParse(v).success).map(([k, v]) => ({ id: String(v), label: String(form.get(`doc_label_${k.slice(4)}`) ?? 'Document').slice(0, 80) }));
  let docsFailed = false;
  if (picks.length > 0) {
    const supabase = createClient();
    const { data: lib } = await supabase.from('candidate_documents').select('id, file_name, storage_path').in('id', picks.map((p) => p.id));
    const rows = picks.flatMap((p) => { const d = lib?.find((x) => x.id === p.id); return d ? [{ application_id: data as string, doc_type: p.label, file_name: d.file_name, storage_path: d.storage_path }] : []; });
    if (rows.length !== picks.length) docsFailed = true;
    if (rows.length) { const { error: e2 } = await supabase.from('application_documents').insert(rows); if (e2) docsFailed = true; }
  }
  redirect(`/dashboard/applications/${data}?submitted=1${docsFailed ? '&docs=failed' : ''}`);
}

export async function withdrawApplication(form: FormData) {
  const id = uuid.safeParse(form.get('application_id'));
  if (!id.success) return;
  await createClient().rpc('withdraw_application', { p_application_id: id.data });
  revalidatePath(`/dashboard/applications/${id.data}`);
}
