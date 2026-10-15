'use server';
import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { LIMITS, checkUpload } from '@/lib/files/validate';
import { createClient } from '@/lib/supabase/server';
import { canManage, canRecruit, requireOrg } from './context';
import { opportunitySchema, orgSchema, parseQuestions } from '@/lib/validation/employer';
import { isSafeExternalUrl } from '@/lib/validation/safe-url';
import { requireRole } from '@/lib/auth/session';
import { zonedToUtc, INTERVIEW_ZONES } from '@/lib/time';
import type { FormState } from '@/lib/auth/actions';

const uuid = z.string().uuid();
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';
const suffix = () => randomBytes(3).toString('hex');
function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) { const o: Record<string, string> = {}; for (const i of issues) { const k = String(i.path[0] ?? 'form'); if (!o[k]) o[k] = i.message; } return o; }
const FAIL: FormState = { error: 'Something went wrong on our side. Please try again.' };

// ───────── Organisation ─────────
export async function createOrganisation(_: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireRole(['employer'], '/employer/onboarding');
  const parsed = orgSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const s = createClient();
  const { data: existing } = await s.from('employer_memberships').select('employer_id').eq('user_id', userId).limit(1);
  if (existing?.length) redirect('/employer');
  const { error } = await s.from('employers').insert({ ...parsed.data, slug: `${slugify(parsed.data.name)}-${suffix()}`, created_by: userId });
  if (error) { console.error('createOrganisation', error.code); return FAIL; }
  await s.from('profiles').update({ onboarding_completed: true }).eq('id', userId);
  redirect('/employer/verification?welcome=1');
}

export async function updateOrganisation(_: FormState, form: FormData): Promise<FormState> {
  const { org, role } = await requireOrg('/employer/company');
  if (!canManage(role)) return { error: 'Only owners and admins can edit the company profile.' };
  const parsed = orgSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const { error } = await createClient().from('employers').update(parsed.data).eq('id', org.id);
  if (error) { console.error('updateOrganisation', error.code); return FAIL; }
  revalidatePath('/employer/company');
  return { message: 'Company profile saved.' };
}

export async function submitVerification(_: FormState, form: FormData): Promise<FormState> {
  const { org, role } = await requireOrg('/employer/verification');
  if (!canManage(role)) return { error: 'Only owners and admins can request verification.' };
  const parsed = z.object({
    website: z.string().url('Enter your official website').refine(isSafeExternalUrl, 'Website must start with https://'),
    business_email: z.string().email('Enter a valid business email'),
    registration_number: z.string().trim().max(60).optional(), notes: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = createClient();
  const files = form.getAll('evidence_files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > LIMITS.maxVerificationFiles) return { fieldErrors: { evidence_files: `Upload at most ${LIMITS.maxVerificationFiles} files.` } };
  const checks = await Promise.all(files.map((f) => checkUpload(f, { maxBytes: LIMITS.verification, allow: ['application/pdf', 'image/jpeg', 'image/png'] })));
  const bad = checks.find((c) => !c.ok);
  if (bad && !bad.ok) return { fieldErrors: { evidence_files: bad.error } };
  const uploaded: string[] = [];
  for (const c of checks) {
    if (!c.ok) continue;
    const path = `${org.id}/${crypto.randomUUID()}.${c.kind.ext}`;
    const up = await supabase.storage.from('verification').upload(path, c.bytes, { contentType: c.kind.mime, upsert: false });
    if (up.error) { if (uploaded.length) await supabase.storage.from('verification').remove(uploaded); return FAIL; }
    uploaded.push(path);
  }
  const { error } = await supabase.rpc('submit_verification_request', { p_employer_id: org.id, p_evidence: parsed.data, p_document_paths: uploaded });
  if (error && uploaded.length) await supabase.storage.from('verification').remove(uploaded); // do not leave orphaned evidence behind
  if (error) return { error: error.message.includes('request_pending') ? 'A request is already waiting for review.' : error.message.includes('already_verified') ? 'Your organisation is already verified.' : FAIL.error };
  revalidatePath('/employer/verification');
  return { message: 'Request submitted. A reviewer will check the evidence and respond here.' };
}

// ───────── Opportunities ─────────
function deadlineIso(d?: string) { return d ? new Date(`${d}T23:59:59+01:00`).toISOString() : null; }

export async function saveOpportunity(_: FormState, form: FormData): Promise<FormState> {
  const { userId, org, role } = await requireOrg('/employer/opportunities');
  if (!canRecruit(role)) return { error: 'Your role is read-only.' };
  const parsed = opportunitySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const intent = String(form.get('intent') ?? 'save');
  const id = form.get('id') ? uuid.safeParse(form.get('id')) : null;
  if (id && !id.success) return { error: 'Invalid listing.' };
  const { skills, questions, deadline, ...rest } = parsed.data;
  if (intent === 'submit' && deadline && new Date(`${deadline}T23:59:59+01:00`) < new Date()) return { fieldErrors: { deadline: 'The deadline is in the past' } };
  if (rest.application_method === 'direct') { rest.external_url = undefined; rest.external_email = undefined; }
  const unpaid = form.get('is_unpaid') === 'on';
  const row = { ...rest, category_id: rest.category_id ?? null, is_unpaid: unpaid, salary_min: unpaid ? null : rest.salary_min ?? null, salary_max: unpaid ? null : rest.salary_max ?? null, deadline: deadlineIso(deadline), external_url: rest.external_url ?? null, external_email: rest.external_email ?? null };
  const s = createClient();
  let oppId: string;

  if (id?.success) {
    const { data: cur } = await s.from('opportunities').select('id, status').eq('id', id.data).eq('employer_id', org.id).maybeSingle();
    if (!cur) return { error: 'Listing not found.' };
    const patch: Record<string, unknown> = { ...row };
    if (intent === 'submit' && ['draft', 'rejected'].includes(cur.status)) patch.status = 'pending_review';
    const { error } = await s.from('opportunities').update(patch).eq('id', cur.id);
    if (error) { console.error('saveOpportunity update', error.code); return FAIL; }
    oppId = cur.id;
  } else {
    const { data, error } = await s.from('opportunities').insert({ ...row, employer_id: org.id, created_by: userId, slug: `${slugify(row.title)}-${suffix()}`, status: intent === 'submit' ? 'pending_review' : 'draft' }).select('id').single();
    if (error || !data) { console.error('saveOpportunity insert', error?.code); return FAIL; }
    oppId = data.id;
  }

  // Skills (create missing, then link)
  if (skills.length) {
    await s.from('skills').upsert(skills.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
    const { data: found } = await s.from('skills').select('id').in('name', skills);
    await s.from('opportunity_skills').delete().eq('opportunity_id', oppId);
    if (found?.length) await s.from('opportunity_skills').insert(found.map((k: { id: string }) => ({ opportunity_id: oppId, skill_id: k.id })));
  } else await s.from('opportunity_skills').delete().eq('opportunity_id', oppId);

  // Questions: only replaced while no applications exist (answers reference question ids)
  const { count } = await s.from('applications').select('*', { count: 'exact', head: true }).eq('opportunity_id', oppId);
  if (!count) {
    await s.from('application_questions').delete().eq('opportunity_id', oppId);
    const qs = parseQuestions(questions);
    if (qs.length) await s.from('application_questions').insert(qs.map((q) => ({ ...q, opportunity_id: oppId })));
  }
  revalidatePath('/employer/opportunities');
  redirect(`/employer/opportunities?${intent === 'submit' ? 'submitted' : 'saved'}=1`);
}

const STATUS_ACTIONS: Record<string, { from: string[]; to: string }> = {
  pause: { from: ['published'], to: 'paused' }, resume: { from: ['paused'], to: 'published' },
  close: { from: ['published', 'paused'], to: 'closed' }, archive: { from: ['draft', 'closed', 'rejected', 'paused'], to: 'archived' },
  submit: { from: ['draft', 'rejected'], to: 'pending_review' },
};
export async function setOpportunityStatus(form: FormData) {
  const { org, role } = await requireOrg('/employer/opportunities');
  const id = uuid.safeParse(form.get('id')); const act = STATUS_ACTIONS[String(form.get('action'))];
  if (!id.success || !act || !canRecruit(role)) return;
  const s = createClient();
  const { data: cur } = await s.from('opportunities').select('status').eq('id', id.data).eq('employer_id', org.id).maybeSingle();
  if (!cur || !act.from.includes(cur.status)) return;
  await s.from('opportunities').update({ status: act.to }).eq('id', id.data);
  revalidatePath('/employer/opportunities');
}

// ───────── Applicants ─────────
async function ownedApplication(id: string) {
  const { org, userId, role } = await requireOrg('/employer');
  const { data } = await createClient().from('applications').select('id, status, opportunity:opportunities!inner(employer_id)').eq('id', id).eq('opportunity.employer_id', org.id).maybeSingle();
  return data ? { app: data, userId, role } : null;
}
const STATUSES = ['under_review', 'shortlisted', 'interview_scheduled', 'assessment', 'offer', 'hired', 'rejected'] as const;
export async function changeApplicationStatus(_: FormState, form: FormData): Promise<FormState> {
  const p = z.object({ application_id: uuid, status: z.enum(STATUSES), note: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: 'Choose a valid status.' };
  const own = await ownedApplication(p.data.application_id);
  if (!own || !canRecruit(own.role)) return { error: 'Application not found.' };
  const { error } = await createClient().rpc('set_application_status', { p_application_id: p.data.application_id, p_status: p.data.status, p_note: p.data.note || null });
  if (error) return { error: error.message.includes('application_closed') ? 'This application is already closed.' : FAIL.error };
  revalidatePath(`/employer/applicants/${p.data.application_id}`);
  return { message: 'Status updated and the candidate has been notified.' };
}
export async function addNote(_: FormState, form: FormData): Promise<FormState> {
  const p = z.object({ application_id: uuid, note: z.string().trim().min(1, 'Write a note first').max(4000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: 'Write a note first.' };
  const own = await ownedApplication(p.data.application_id);
  if (!own || !canRecruit(own.role)) return { error: 'Application not found.' };
  const { error } = await createClient().from('application_notes').insert({ application_id: p.data.application_id, author_id: own.userId, note: p.data.note });
  if (error) return FAIL;
  revalidatePath(`/employer/applicants/${p.data.application_id}`);
  return { message: 'Note saved. Candidates cannot see internal notes.' };
}
export async function scheduleInterview(_: FormState, form: FormData): Promise<FormState> {
  const p = z.object({ application_id: uuid, when: z.string(), tz: z.enum(INTERVIEW_ZONES), format: z.enum(['online', 'physical']), details: z.string().trim().max(2000).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: 'Fill in the date, time zone and format.' };
  const own = await ownedApplication(p.data.application_id);
  if (!own || !canRecruit(own.role)) return { error: 'Application not found.' };
  const at = zonedToUtc(p.data.when, p.data.tz);
  if (!at) return { error: 'Enter a valid date and time.' };
  const { error } = await createClient().rpc('schedule_interview', { p_application_id: p.data.application_id, p_at: at.toISOString(), p_tz: p.data.tz, p_format: p.data.format, p_details: p.data.details ?? null });
  if (error) return { error: error.message.includes('interview_in_past') ? 'Choose a time in the future.' : error.message.includes('application_closed') ? 'This application is already closed.' : FAIL.error };
  revalidatePath(`/employer/applicants/${p.data.application_id}`); revalidatePath('/employer/interviews');
  return { message: 'Interview scheduled and the candidate has been notified.' };
}
export async function cancelInterview(form: FormData) {
  const id = uuid.safeParse(form.get('interview_id'));
  if (!id.success) return;
  await requireOrg('/employer/interviews');
  await createClient().rpc('cancel_interview', { p_interview_id: id.data });
  revalidatePath('/employer/interviews');
}
