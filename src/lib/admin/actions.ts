'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { FormState } from '@/lib/auth/actions';

const uuid = z.string().uuid();
const NOTE_ERR = 'Add a note explaining the decision.';

export async function moderateOpportunity(_: FormState, form: FormData): Promise<FormState> {
  await requireRole(['admin', 'super_admin'], '/admin/opportunities');
  const p = z.object({ id: uuid, decision: z.enum(['approve', 'reject', 'request_changes']), note: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: 'Choose a decision.' };
  const { error } = await createClient().rpc('moderate_opportunity', { p_id: p.data.id, p_decision: p.data.decision, p_note: p.data.note || null });
  if (error) return { error: error.message.includes('note_required') ? NOTE_ERR : 'Could not save the decision.' };
  revalidatePath('/admin/opportunities');
  return { message: 'Decision saved.' };
}
export async function reviewVerification(_: FormState, form: FormData): Promise<FormState> {
  await requireRole(['admin', 'super_admin'], '/admin/verifications');
  const p = z.object({ id: uuid, decision: z.enum(['approve', 'reject', 'needs_info']), note: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: 'Choose a decision.' };
  const { error } = await createClient().rpc('review_verification', { p_request_id: p.data.id, p_decision: p.data.decision, p_note: p.data.note || null });
  if (error) return { error: error.message.includes('note_required') ? NOTE_ERR : 'Could not save the decision.' };
  revalidatePath('/admin/verifications');
  return { message: 'Decision saved.' };
}
export async function resolveReport(form: FormData) {
  await requireRole(['admin', 'super_admin'], '/admin/reports');
  const p = z.object({ id: uuid, status: z.enum(['reviewing', 'actioned', 'dismissed']) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const s = createClient();
  await s.from('opportunity_reports').update({ status: p.data.status }).eq('id', p.data.id);
  await s.rpc('log_audit', { p_action: `report.${p.data.status}`, p_target_type: 'opportunity_report', p_target_id: p.data.id });
  revalidatePath('/admin/reports');
}
