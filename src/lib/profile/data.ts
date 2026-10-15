import { createClient } from '@/lib/supabase/server';
import type { ProfileFacts } from './completion';

export type ProfileBundle = ProfileFacts & { email: string | null; onboarding_completed: boolean; contact_visible: boolean; interests: string; link_rows: { label: string; url: string }[]; siwes_eligible: string; required_duration_weeks: string; faculty: string; preferred_locations: string[]; };

export async function getProfileBundle(userId: string): Promise<ProfileBundle> {
  const s = createClient();
  const [{ data: p }, { data: c }, { data: st }] = await Promise.all([
    s.from('profiles').select('full_name, email, phone, onboarding_completed').eq('id', userId).maybeSingle(),
    s.from('candidate_profiles').select('headline, summary, location, skills, links, is_student, preferences, visibility').eq('user_id', userId).maybeSingle(),
    s.from('student_profiles').select('institution, course, faculty, academic_level, expected_graduation, siwes_eligible, required_duration_weeks, preferred_locations').eq('user_id', userId).maybeSingle(),
  ]);
  const prefs = (c?.preferences ?? {}) as { arrangements?: string[]; interests?: string };
  const links = Array.isArray(c?.links) ? (c!.links as { label?: string; url?: string }[]) : [];
  return {
    full_name: p?.full_name, email: p?.email ?? null, phone: p?.phone, onboarding_completed: Boolean(p?.onboarding_completed),
    headline: c?.headline, summary: c?.summary, location: c?.location, skills: c?.skills ?? [], is_student: c?.is_student ?? false,
    links, link_rows: links.map((l) => ({ label: l.label ?? '', url: l.url ?? '' })), arrangements: prefs.arrangements ?? [], interests: prefs.interests ?? '',
    contact_visible: Boolean((c?.visibility as { contact_visible_to_employers?: boolean } | null)?.contact_visible_to_employers),
    institution: st?.institution, course: st?.course, faculty: st?.faculty ?? '', academic_level: st?.academic_level, expected_graduation: st?.expected_graduation,
    siwes_eligible: st?.siwes_eligible === true ? 'yes' : st?.siwes_eligible === false ? 'no' : st ? 'unsure' : '',
    required_duration_weeks: st?.required_duration_weeks ? String(st.required_duration_weeks) : '', preferred_locations: st?.preferred_locations ?? [],
  };
}
