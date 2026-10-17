import { z } from 'zod';

/** Free-text filters never throw: bad or oversized input is trimmed or dropped, so a hand-edited URL cannot crash the page. */
const str = (max = 100) => z.string().optional().catch(undefined).transform((v) => v?.trim().slice(0, max) || undefined);
export const PAGE_SIZE = 12;

export const searchSchema = z.object({
  q: str(120), location: str(80),
  type: z.enum(['job', 'internship', 'placement', 'graduate', 'siwes', 'swep', 'entry']).optional().catch(undefined),
  arrangement: z.enum(['onsite', 'hybrid', 'remote']).optional().catch(undefined),
  category: str(60),
  experience: z.enum(['none', 'entry', 'mid', 'senior', 'lead']).optional().catch(undefined),
  duration: z.coerce.number().int().min(1).max(104).optional().catch(undefined),
  paid: z.enum(['paid', 'unpaid']).optional().catch(undefined),
  verified: z.literal('1').optional().catch(undefined),
  course: str(80),
  sort: z.enum(['newest', 'deadline', 'relevance']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});
export type SearchParams = z.infer<typeof searchSchema>;

/** Maps the quick-category links on the landing page to category slugs / kinds. */
export const TYPE_TO_CATEGORY: Record<string, { kind?: 'job' | 'placement'; slugs?: string[] }> = {
  job: { kind: 'job' }, placement: { kind: 'placement' }, entry: { kind: 'job' }, // 'entry' also sets the experience filter (see searchOpportunities)
 
  internship: { slugs: ['internship'] }, graduate: { slugs: ['graduate-trainee'] },
  siwes: { slugs: ['siwes', 'industrial-training', 'industrial-attachment'] }, swep: { slugs: ['swep'] },
};

/** Turns what the user typed into a safe prefix-matching tsquery ("react eng" becomes "react:* & eng:*"). Letters and digits only. */
export function buildTsQuery(input: string): string | null {
  const tokens = (input.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((t) => t.slice(0, 40)).slice(0, 8);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null;
}
