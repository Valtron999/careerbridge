export type ProfileFacts = {
  full_name?: string | null; phone?: string | null; headline?: string | null; location?: string | null; summary?: string | null;
  skills?: string[] | null; links?: unknown[] | null; arrangements?: string[] | null; is_student?: boolean | null;
  institution?: string | null; course?: string | null; academic_level?: string | null; expected_graduation?: string | null;
};
/** Honest completeness: counts only fields the user actually filled in. */
export function profileCompletion(f: ProfileFacts): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['your full name', Boolean(f.full_name?.trim())], ['a headline', Boolean(f.headline?.trim())], ['your location', Boolean(f.location?.trim())],
    ['a short summary', Boolean(f.summary?.trim())], ['at least three skills', (f.skills?.length ?? 0) >= 3], ['a phone number', Boolean(f.phone?.trim())],
    ['a portfolio or professional link', (f.links?.length ?? 0) > 0], ['your preferred work arrangement', (f.arrangements?.length ?? 0) > 0],
  ];
  if (f.is_student) checks.push(['your institution', Boolean(f.institution?.trim())], ['your course of study', Boolean(f.course?.trim())], ['your academic level', Boolean(f.academic_level)], ['your expected graduation date', Boolean(f.expected_graduation)]);
  const done = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([n]) => n) };
}
