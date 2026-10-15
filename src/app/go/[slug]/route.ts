import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { isSafeExternalUrl } from '@/lib/validation/safe-url';
import { supabaseConfigured } from '@/lib/env';

/** Outbound click for external listings. The destination comes from the database, never from the query string. */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  if (!supabaseConfigured()) return NextResponse.redirect(new URL('/jobs', request.url));
  const supabase = createClient();
  const { data: o } = await supabase.from('opportunities').select('id, external_url, status, deadline').eq('slug', params.slug).eq('status', 'published').maybeSingle();
  const back = new URL(`/jobs`, request.url);
  if (!o?.external_url || !isSafeExternalUrl(o.external_url) || (o.deadline && new Date(o.deadline) < new Date())) return NextResponse.redirect(back);
  const session = await getSession();
  if (session) await supabase.from('external_applications').upsert({ user_id: session.userId, opportunity_id: o.id, state: 'clicked' }, { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true });
  return NextResponse.redirect(o.external_url);
}
