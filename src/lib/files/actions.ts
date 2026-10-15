'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { processAvatar } from './avatar';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { LIMITS, checkUpload, isDocType } from './validate';
import type { FormState } from '@/lib/auth/actions';

const FAIL: FormState = { error: 'We could not save that file. Please try again.' };
async function candidate() {
  const s = await getSession();
  return s && s.profile.role === 'candidate' ? s : null;
}

export async function uploadDocument(_: FormState, form: FormData): Promise<FormState> {
  const s = await candidate();
  if (!s) return { error: 'Sign in with a candidate account to upload documents.' };
  const docType = String(form.get('doc_type') ?? '');
  if (!isDocType(docType)) return { fieldErrors: { doc_type: 'Choose what kind of document this is' } };
  const supabase = createClient();
  const { count } = await supabase.from('candidate_documents').select('*', { count: 'exact', head: true }).eq('user_id', s.userId);
  if ((count ?? 0) >= LIMITS.maxDocsPerUser) return { error: `You can store up to ${LIMITS.maxDocsPerUser} documents. Delete one you no longer need.` };

  const checked = await checkUpload(form.get('file'), { maxBytes: LIMITS.document, allow: ['application/pdf', 'image/jpeg', 'image/png'] });
  if (!checked.ok) return { fieldErrors: { file: checked.error } };
  const path = `${s.userId}/${crypto.randomUUID()}.${checked.kind.ext}`; // user-supplied names never reach the storage path
  const up = await supabase.storage.from('documents').upload(path, checked.bytes, { contentType: checked.kind.mime, upsert: false });
  if (up.error) { console.error('document upload failed', up.error.message.slice(0, 80)); return FAIL; }
  const { error } = await supabase.from('candidate_documents').insert({ user_id: s.userId, doc_type: docType, file_name: checked.name, storage_path: path, size_bytes: checked.bytes.length });
  if (error) { await supabase.storage.from('documents').remove([path]); return FAIL; }
  revalidatePath('/dashboard/documents');
  return { message: `${checked.name} uploaded.` };
}

export async function deleteDocument(form: FormData) {
  const s = await candidate(); const id = z.string().uuid().safeParse(form.get('id'));
  if (!s || !id.success) return;
  const supabase = createClient();
  const { data: doc } = await supabase.from('candidate_documents').select('storage_path').eq('id', id.data).eq('user_id', s.userId).maybeSingle();
  if (!doc) return;
  const { error } = await supabase.from('candidate_documents').delete().eq('id', id.data).eq('user_id', s.userId); // blocked by a trigger while attached to an application
  if (error) redirect(`/dashboard/documents?error=${error.message.includes('document_in_use') ? 'in_use' : 'failed'}`);
  await supabase.storage.from('documents').remove([doc.storage_path]);
  revalidatePath('/dashboard/documents');
}

export async function uploadAvatar(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) return { error: 'Sign in to change your photo.' };
  const checked = await checkUpload(form.get('file'), { maxBytes: LIMITS.avatar, allow: ['image/jpeg', 'image/png', 'image/webp'] });
  if (!checked.ok) return { fieldErrors: { file: checked.error } };
  let out: Buffer;
  try { out = await processAvatar(checked.bytes); }
  catch { return { fieldErrors: { file: 'We could not read that image. Try a different photo.' } }; }
  const supabase = createClient();
  const path = `${s.userId}/avatar-${Date.now()}.webp`;
  const up = await supabase.storage.from('avatars').upload(path, out, { contentType: 'image/webp', upsert: false });
  if (up.error) return FAIL;
  const { data: old } = await supabase.storage.from('avatars').list(s.userId);
  const stale = (old ?? []).map((o) => `${s.userId}/${o.name}`).filter((p) => p !== path);
  const { error } = await supabase.from('profiles').update({ avatar_url: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl }).eq('id', s.userId);
  if (error) { await supabase.storage.from('avatars').remove([path]); return FAIL; }
  if (stale.length) await supabase.storage.from('avatars').remove(stale);
  revalidatePath('/dashboard', 'layout');
  return { message: 'Photo updated.' };
}

export async function removeAvatar() {
  const s = await getSession(); if (!s) return;
  const supabase = createClient();
  const { data: old } = await supabase.storage.from('avatars').list(s.userId);
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', s.userId);
  if (old?.length) await supabase.storage.from('avatars').remove(old.map((o) => `${s.userId}/${o.name}`));
  revalidatePath('/dashboard', 'layout');
}
