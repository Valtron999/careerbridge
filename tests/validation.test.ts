import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl, safeNextPath } from '../src/lib/validation/safe-url';
import { searchSchema, buildTsQuery } from '../src/lib/validation/search';
import { signupSchema } from '../src/lib/validation/auth';
import { formatCompensation, listingState } from '../src/lib/format';

describe('external URL safety', () => {
  it('accepts https only', () => {
    expect(isSafeExternalUrl('https://example.com/apply')).toBe(true);
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', 'https://user:pw@example.com', 'not a url'])
      expect(isSafeExternalUrl(bad)).toBe(false);
  });
});
describe('open redirect protection', () => {
  it('allows same-site paths', () => expect(safeNextPath('/dashboard/applications')).toBe('/dashboard/applications'));
  it('rejects external and protocol-relative targets', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:x', '', null, undefined]) expect(safeNextPath(bad as string)).toBe('/dashboard');
  });
});
describe('search params', () => {
  it('parses valid values', () => { const p = searchSchema.parse({ q: ' react ', type: 'siwes', page: '2' }); expect(p.q).toBe('react'); expect(p.type).toBe('siwes'); expect(p.page).toBe(2); });
  it('falls back on garbage instead of throwing', () => { const p = searchSchema.parse({ type: 'hack', page: '-5', sort: 'x', arrangement: '1' }); expect(p.type).toBeUndefined(); expect(p.page).toBe(1); expect(p.sort).toBeUndefined(); });
  it('never throws on oversized or odd input', () => {
    const p = searchSchema.parse({ q: 'x'.repeat(5000), location: 'y'.repeat(900), course: ['a', 'b'] as unknown as string });
    expect(p.q).toHaveLength(120); expect(p.location).toHaveLength(80); expect(p.course).toBeUndefined();
  });
  it('builds a safe prefix query', () => {
    expect(buildTsQuery('react eng')).toBe('react:* & eng:*');
    expect(buildTsQuery("a,b)%*\"c' | !:*")).toBe('a:* & b:* & c:*'); // tsquery operators never survive
    expect(buildTsQuery('   !!! ')).toBeNull();
    expect(buildTsQuery('Ọlá Ibadan 2025')).toBe('ọlá:* & ibadan:* & 2025:*');
    expect(buildTsQuery('a b c d e f g h i j')!.split(' & ')).toHaveLength(8);
  });
});
describe('signup', () => {
  it('only allows candidate or employer account types', () => {
    const base = { full_name: 'Ada Obi', email: 'a@b.com', password: 'longenough1' };
    expect(signupSchema.safeParse({ ...base, account_type: 'candidate' }).success).toBe(true);
    expect(signupSchema.safeParse({ ...base, account_type: 'admin' }).success).toBe(false);
  });
});
describe('formatting', () => {
  it('never invents compensation', () => expect(formatCompensation({ salary_min: null, salary_max: null, salary_currency: null, is_unpaid: false })).toBeNull());
  it('labels unpaid explicitly', () => expect(formatCompensation({ salary_min: null, salary_max: null, salary_currency: null, is_unpaid: true })).toBe('Unpaid'));
  it('detects expired listings', () => {
    expect(listingState({ status: 'published', deadline: '2000-01-01T00:00:00Z' })).toBe('expired');
    expect(listingState({ status: 'closed', deadline: null })).toBe('closed');
    expect(listingState({ status: 'published', deadline: null })).toBe('open');
  });
});

import { opportunitySchema, parseQuestions, orgSchema } from '../src/lib/validation/employer';
import { zonedToUtc } from '../src/lib/time';
const base = { title: 'Software intern', kind: 'placement', description: 'x'.repeat(40), work_arrangement: 'onsite', application_method: 'direct', questions: '' };
describe('employer listing validation', () => {
  it('accepts a minimal listing and leaves optional pay unset', () => { const r = opportunitySchema.parse({ ...base, salary_min: '', salary_max: '' }); expect(r.salary_min).toBeUndefined(); expect(r.location_country).toBe('Nigeria'); });
  it('rejects max pay below min pay', () => expect(opportunitySchema.safeParse({ ...base, salary_min: '200', salary_max: '100' }).success).toBe(false));
  it('external listing needs a destination', () => expect(opportunitySchema.safeParse({ ...base, application_method: 'external' }).success).toBe(false));
  it('rejects non-https external links', () => { for (const u of ['http://a.com', 'javascript:alert(1)']) expect(opportunitySchema.safeParse({ ...base, application_method: 'external', external_url: u }).success).toBe(false); expect(opportunitySchema.safeParse({ ...base, application_method: 'external', external_url: 'https://a.com/apply' }).success).toBe(true); });
  it('splits list fields', () => expect(opportunitySchema.parse({ ...base, eligible_courses: 'Computer Science, Physics\nMaths' }).eligible_courses).toEqual(['Computer Science', 'Physics', 'Maths']));
  it('rejects non-https org website', () => expect(orgSchema.safeParse({ name: 'Acme', website: 'http://acme.com' }).success).toBe(false));
});
describe('question parsing', () => {
  it('parses prompt | type | required', () => expect(parseQuestions('Why us? | long | required\nStart date | date')).toEqual([{ prompt: 'Why us?', type: 'long_text', required: true, sort_order: 0 }, { prompt: 'Start date', type: 'date', required: false, sort_order: 1 }]));
});
describe('time zones', () => {
  it('converts Lagos local time (UTC+1) to UTC', () => expect(zonedToUtc('2026-10-20T14:30', 'Africa/Lagos')?.toISOString()).toBe('2026-10-20T13:30:00.000Z'));
  it('converts New York in October (EDT, UTC-4)', () => expect(zonedToUtc('2026-10-20T09:00', 'America/New_York')?.toISOString()).toBe('2026-10-20T13:00:00.000Z'));
  it('rejects malformed input', () => expect(zonedToUtc('tomorrow', 'UTC')).toBeNull());
});
