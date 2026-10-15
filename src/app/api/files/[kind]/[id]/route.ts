import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const NOT_FOUND = () => NextResponse.json({ error: 'Not found.' }, { status: 404 });

/** Hands out a 60-second signed link. Authorisation is the database: each lookup runs as the signed-in user under RLS,
 *  and the storage read itself is also checked by storage policies, so guessed ids and paths return nothing. */
export async function GET(req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to open this file.' }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NOT_FOUND();
  const supabase = createClient();
  let bucket: 'documents' | 'verification'; let path: string; let name: string;

  if (params.kind === 'document') {
    const { data } = await supabase.from('candidate_documents').select('storage_path, file_name').eq('id', params.id).eq('user_id', session.userId).maybeSingle();
    if (!data) return NOT_FOUND(); bucket = 'documents'; path = data.storage_path; name = data.file_name;
  } else if (params.kind === 'application') {
    const { data } = await supabase.from('application_documents').select('storage_path, file_name').eq('id', params.id).maybeSingle(); // RLS: the applicant or the receiving employer's team
    if (!data) return NOT_FOUND(); bucket = 'documents'; path = data.storage_path; name = data.file_name;
  } else if (params.kind === 'verification') {
    const i = Number(new URL(req.url).searchParams.get('i') ?? 0);
    const { data } = await supabase.from('employer_verification_requests').select('document_paths').eq('id', params.id).maybeSingle(); // RLS: the organisation's team or an admin
    const p = data?.document_paths?.[i]; if (!p || !Number.isInteger(i) || i < 0) return NOT_FOUND();
    bucket = 'verification'; path = p; name = `evidence-${i + 1}.${p.split('.').pop() ?? 'pdf'}`;
  } else return NOT_FOUND();

  const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name });
  if (error || !signed) return NOT_FOUND();
  return NextResponse.redirect(signed.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } });
}
