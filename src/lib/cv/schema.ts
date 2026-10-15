import { z } from 'zod';
import { toWebUrl } from '@/lib/validation/safe-url';

export const SECTION_IDS = ['summary', 'education', 'experience', 'internships', 'projects', 'skills', 'certifications', 'leadership', 'achievements', 'languages'] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export const SECTION_TITLES: Record<SectionId, string> = {
  summary: 'Professional summary', education: 'Education', experience: 'Work experience', internships: 'Internships and industrial training', projects: 'Projects',
  skills: 'Skills', certifications: 'Certifications', leadership: 'Volunteering and leadership', achievements: 'Achievements', languages: 'Languages',
};
export const TEMPLATES = ['professional', 'modern', 'student'] as const;
export type TemplateId = (typeof TEMPLATES)[number];
export const TEMPLATE_LABELS: Record<TemplateId, { name: string; blurb: string }> = {
  professional: { name: 'Professional', blurb: 'Classic serif, centred header. Safest for applicant tracking systems.' },
  modern: { name: 'Modern graduate', blurb: 'Clean sans-serif with an accent colour.' },
  student: { name: 'Student and internship', blurb: 'Education, projects and skills come first.' },
};
export const ACCENTS = ['#315EFB', '#16865C', '#7C3AED', '#B42318', '#0F766E', '#152238'] as const;

const t = (n: number) => z.string().max(n);
const entry = z.object({ title: t(160), organisation: t(160), location: t(120), start: t(30), end: t(30), bullets: z.array(t(400)).max(10) });
export const cvSchema = z.object({
  personal: z.object({ full_name: t(120), headline: t(160), email: t(160), phone: t(40), location: t(120), links: z.array(z.object({ label: t(40), url: t(300) })).max(6) }),
  summary: t(1200),
  education: z.array(z.object({ institution: t(160), degree: t(160), location: t(120), start: t(30), end: t(30), details: t(600) })).max(8),
  experience: z.array(entry).max(15),
  internships: z.array(entry).max(15),
  projects: z.array(z.object({ name: t(160), link: t(300), description: t(400), bullets: z.array(t(400)).max(8) })).max(12),
  skills: z.object({ technical: z.array(t(60)).max(40), soft: z.array(t(60)).max(30) }),
  certifications: z.array(z.object({ name: t(160), issuer: t(160), date: t(30) })).max(15),
  leadership: z.array(entry).max(10),
  achievements: z.array(t(300)).max(10),
  languages: z.array(z.object({ name: t(60), level: t(60) })).max(10),
  sectionOrder: z.array(z.enum(SECTION_IDS)).max(10),
  hidden: z.array(z.enum(SECTION_IDS)).max(10),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Cv = z.infer<typeof cvSchema>;
export type Entry = z.infer<typeof entry>;

export const ORDER_STUDENT: SectionId[] = ['summary', 'education', 'projects', 'skills', 'internships', 'experience', 'certifications', 'leadership', 'achievements', 'languages'];
export const ORDER_GENERAL: SectionId[] = ['summary', 'experience', 'internships', 'education', 'skills', 'projects', 'certifications', 'leadership', 'achievements', 'languages'];

export function emptyCv(mode: 'student' | 'general' = 'general'): Cv {
  return {
    personal: { full_name: '', headline: '', email: '', phone: '', location: '', links: [] }, summary: '', education: [], experience: [], internships: [], projects: [],
    skills: { technical: [], soft: [] }, certifications: [], leadership: [], achievements: [], languages: [],
    sectionOrder: [...(mode === 'student' ? ORDER_STUDENT : ORDER_GENERAL)], hidden: [], accent: ACCENTS[0],
  };
}
export const blankEntry = (): Entry => ({ title: '', organisation: '', location: '', start: '', end: '', bullets: [] });

const trimDeep = (v: unknown): unknown => typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.map(trimDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimDeep(x)])) : v;

/** Makes stored or client-supplied content safe to use: fills gaps, trims, and drops invalid parts. Never throws. */
export function normalizeCv(raw: unknown): Cv {
  const base = emptyCv();
  const merged = { ...base, ...(raw && typeof raw === 'object' ? (raw as object) : {}) } as Record<string, unknown>;
  const parsed = cvSchema.safeParse(trimDeep(merged));
  if (!parsed.success) {
    // Keep what is valid section-by-section instead of discarding the whole CV.
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base) as (keyof Cv)[]) {
      const one = cvSchema.shape[key].safeParse(trimDeep(merged[key]));
      if (one.success) out[key] = one.data;
    }
    return out as Cv;
  }
  const cv = parsed.data;
  const known = new Set(cv.sectionOrder);
  cv.sectionOrder = [...cv.sectionOrder, ...SECTION_IDS.filter((s) => !known.has(s))];
  return cv;
}
/** Removes empty rows and blank bullets before saving or rendering. */
export function pruneCv(cv: Cv): Cv {
  const bl = (b: string[]) => b.map((x) => x.trim()).filter(Boolean);
  const keep = <T extends Record<string, unknown>>(rows: T[]) => rows.filter((r) => Object.values(r).some((v) => (Array.isArray(v) ? v.some((x) => String(x).trim()) : String(v ?? '').trim())));
  return {
    ...cv,
    education: keep(cv.education), certifications: keep(cv.certifications), languages: keep(cv.languages),
    experience: keep(cv.experience.map((e) => ({ ...e, bullets: bl(e.bullets) }))), internships: keep(cv.internships.map((e) => ({ ...e, bullets: bl(e.bullets) }))),
    leadership: keep(cv.leadership.map((e) => ({ ...e, bullets: bl(e.bullets) }))), projects: keep(cv.projects.map((p) => ({ ...p, bullets: bl(p.bullets) }))),
    achievements: bl(cv.achievements), skills: { technical: bl(cv.skills.technical), soft: bl(cv.skills.soft) },
    personal: { ...cv.personal, links: cv.personal.links.filter((l) => l.url.trim()) },
  };
}

export type Section = { id: SectionId; title: string };
/** Ordered, visible, non-empty sections. Shared by the live preview and the PDF so they cannot drift apart. */
export function visibleSections(cv: Cv): Section[] {
  const has: Record<SectionId, boolean> = {
    summary: Boolean(cv.summary), education: cv.education.length > 0, experience: cv.experience.length > 0, internships: cv.internships.length > 0, projects: cv.projects.length > 0,
    skills: cv.skills.technical.length + cv.skills.soft.length > 0, certifications: cv.certifications.length > 0, leadership: cv.leadership.length > 0, achievements: cv.achievements.length > 0, languages: cv.languages.length > 0,
  };
  const hidden = new Set(cv.hidden);
  return cv.sectionOrder.filter((id) => has[id] && !hidden.has(id)).map((id) => ({ id, title: SECTION_TITLES[id] }));
}
export const dateRange = (s: string, e: string) => [s, e].filter(Boolean).join(' – ');
export function safeLink(url: string): string | null { return toWebUrl(url); }

/** What is allowed to leave the app for the AI provider: no contact details, links or name. */
export function redactForAi(cv: Cv): Omit<Cv, 'personal' | 'accent' | 'sectionOrder' | 'hidden'> & { headline: string } {
  const { personal, accent: _a, sectionOrder: _o, hidden: _h, ...rest } = cv; void _a; void _o; void _h;
  return { headline: personal.headline, ...rest, projects: rest.projects.map((p) => ({ ...p, link: '' })) };
}
