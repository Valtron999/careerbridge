import { z } from 'zod';
import { toWebUrl } from './safe-url';

export const ACADEMIC_LEVELS = ['100 level', '200 level', '300 level', '400 level', '500 level', 'ND1', 'ND2', 'HND1', 'HND2', 'Postgraduate', 'Graduate', 'Other'] as const;
export const ARRANGEMENTS = ['onsite', 'hybrid', 'remote'] as const;
const s = (max: number) => z.string().trim().max(max);

export const basicsSchema = z.object({
  full_name: s(120).min(2, 'Enter your full name'),
  phone: s(25).refine((v) => v === '' || /^\+?[\d\s()-]{7,22}$/.test(v), 'Enter a valid phone number, or leave it blank'),
  headline: s(160), location: s(120), summary: s(1200),
});
export const studentSchema = z.object({
  institution: s(160), course: s(160), faculty: s(160),
  academic_level: z.string().refine((v) => v === '' || (ACADEMIC_LEVELS as readonly string[]).includes(v), 'Choose a level from the list'),
  expected_graduation: z.string().refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'Enter a valid date'),
  siwes_eligible: z.enum(['', 'yes', 'no', 'unsure']),
  required_duration_weeks: z.string().refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 104), 'Enter a number of weeks between 1 and 104'),
  preferred_locations: s(400),
});
export const interestsSchema = z.object({ skills: s(1500), interests: s(600) });

export const splitList = (v: string, max = 30, len = 60): string[] =>
  [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, len)))].slice(0, max);

export const normaliseUrl = toWebUrl;
