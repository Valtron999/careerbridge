import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

export type Profile = { id: string; role: 'candidate' | 'employer' | 'admin' | 'super_admin'; status: 'active' | 'suspended'; full_name: string | null; email: string | null; onboarding_completed: boolean };

/** Returns the verified user + profile, or null. Uses getUser() so the JWT is validated server-side. */
export async function getSession(): Promise<{ userId: string; profile: Profile } | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('id, role, status, full_name, email, onboarding_completed').eq('id', user.id).single();
  if (!profile || profile.status !== 'active') return null;
  return { userId: user.id, profile: profile as Profile };
}

export async function requireUser(next = '/dashboard') {
  const s = await getSession();
  if (!s) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return s;
}

/** Server-side role gate. Never rely on hidden routes; this reads the role from the database. */
export async function requireRole(roles: Profile['role'][], next: string) {
  const s = await requireUser(next);
  if (!roles.includes(s.profile.role)) redirect(roleHome(s.profile.role));
  return s;
}

export function roleHome(role: Profile['role']): string { return role === 'employer' ? '/employer' : role === 'candidate' ? '/dashboard' : '/admin'; }
