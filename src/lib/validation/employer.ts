import { z } from 'zod';
import { isSafeExternalUrl } from './safe-url';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
export const optStr = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());
export const optNum = (min: number, max: number) => z.preprocess(blank, z.coerce.number().min(min).max(max).optional());
const list = z.preprocess((v) => (typeof v === 'string' ? v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : []), z.array(z.string().max(120)).max(30));
const httpsUrl = z.preprocess(blank, z.string().url('Enter a valid link').refine(isSafeExternalUrl, 'Links must start with https://').optional());

export const orgSchema = z.object({
  name: z.string().trim().min(2, 'Organisation name is required').max(120),
  industry: optStr(80), location: optStr(120), description: optStr(3000),
  website: httpsUrl, public_email: z.preprocess(blank, z.string().email('Enter a valid public email').optional()), public_phone: optStr(40),
});

export const QUESTION_TYPES = { short: 'short_text', long: 'long_text', yes_no: 'yes_no', date: 'date', number: 'number' } as const;
/** One question per line: `prompt | type | required` (type: short, long, yes_no, date, number; third part optional). */
export function parseQuestions(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 15).map((line, i) => {
    const [prompt = '', type = 'short', req = ''] = line.split('|').map((s) => s.trim());
    return { prompt: prompt.slice(0, 300), type: QUESTION_TYPES[type as keyof typeof QUESTION_TYPES] ?? 'short_text', required: /^req/i.test(req), sort_order: i };
  }).filter((q) => q.prompt.length > 0);
}

export const opportunitySchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  kind: z.enum(['job', 'placement']),
  category_id: z.preprocess(blank, z.string().uuid().optional()),
  description: z.string().trim().min(30, 'Describe the opportunity in at least 30 characters').max(10000),
  responsibilities: optStr(6000), requirements: optStr(6000), qualifications: optStr(4000), benefits: optStr(3000),
  employment_type: z.preprocess(blank, z.enum(['full_time', 'part_time', 'contract', 'internship', 'apprenticeship', 'volunteer', 'temporary']).optional()),
  work_arrangement: z.enum(['onsite', 'hybrid', 'remote']),
  location_city: optStr(80), location_state: optStr(80), location_country: z.string().trim().min(2).max(80).default('Nigeria'),
  experience_level: z.preprocess(blank, z.enum(['none', 'entry', 'mid', 'senior', 'lead']).optional()),
  education_level: optStr(80),
  salary_min: optNum(0, 1e10), salary_max: optNum(0, 1e10), salary_currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']).default('NGN'),
  compensation_note: optStr(300),
  placement_duration_weeks: optNum(1, 104), start_date: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  eligible_courses: list, eligible_institutions: list, required_documents: list, skills: list,
  positions_available: optNum(1, 100000),
  deadline: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid deadline date').optional()),
  application_method: z.enum(['direct', 'external']),
  external_url: httpsUrl, external_email: z.preprocess(blank, z.string().email('Enter a valid application email').optional()),
  application_instructions: optStr(3000), questions: z.string().max(4000).default(''),
}).superRefine((v, ctx) => {
  if (v.salary_min != null && v.salary_max != null && v.salary_max < v.salary_min) ctx.addIssue({ code: 'custom', path: ['salary_max'], message: 'Maximum pay must be at least the minimum' });
  if (v.application_method === 'external' && !v.external_url && !v.external_email) ctx.addIssue({ code: 'custom', path: ['external_url'], message: 'External applications need an https link or an email address' });
});
export type OpportunityInput = z.infer<typeof opportunitySchema>;
