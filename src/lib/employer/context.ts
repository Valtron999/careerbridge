import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type Org = { id: string; slug: string; name: string; industry: string | null; description: string | null; website: string | null; location: string | null; public_email: string | null; public_phone: string | null; verification_status: 'unverified' | 'pending' | 'needs_info' | 'verified' | 'rejected' };
export type MemberRole = 'owner' | 'admin' | 'recruiter' | 'viewer';

/** Resolves the signed-in employer's organisation from the database. Redirects to onboarding if none. */
export async function requireOrg(next = '/employer') {
  const { userId, profile } = await requireRole(['employer'], next);
  const { data } = await createClient().from('employer_memberships').select('role, employer:employers(id, slug, name, industry, description, website, location, public_email, public_phone, verification_status)').eq('user_id', userId).order('created_at').limit(1);
  const row = data?.[0];
  if (!row?.employer) redirect('/employer/onboarding');
  return { userId, profile, org: row.employer as unknown as Org, role: row.role as MemberRole };
}
export const canManage = (r: MemberRole) => r === 'owner' || r === 'admin';
export const canRecruit = (r: MemberRole) => r !== 'viewer';
