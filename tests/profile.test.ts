import { describe, expect, it } from 'vitest';
import { basicsSchema, normaliseUrl, splitList, studentSchema } from '../src/lib/validation/profile';
import { updatePasswordSchema } from '../src/lib/validation/auth';
import { profileCompletion } from '../src/lib/profile/completion';

describe('password update', () => {
  it('requires matching passwords of sensible length', () => {
    expect(updatePasswordSchema.safeParse({ password: 'longenough1', confirm: 'longenough1' }).success).toBe(true);
    expect(updatePasswordSchema.safeParse({ password: 'longenough1', confirm: 'different12' }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(false);
  });
});
describe('profile validation', () => {
  const base = { full_name: 'Ada Obi', phone: '', headline: '', location: '', summary: '' };
  it('accepts a name only', () => expect(basicsSchema.safeParse(base).success).toBe(true));
  it('rejects bad phone numbers and tiny names', () => {
    expect(basicsSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false);
    expect(basicsSchema.safeParse({ ...base, phone: '+234 801 234 5678' }).success).toBe(true);
    expect(basicsSchema.safeParse({ ...base, full_name: 'A' }).success).toBe(false);
  });
  it('validates student fields', () => {
    const ok = { institution: '', course: '', faculty: '', academic_level: '300 level', expected_graduation: '2027-07-01', siwes_eligible: 'yes', required_duration_weeks: '24', preferred_locations: '' };
    expect(studentSchema.safeParse(ok).success).toBe(true);
    expect(studentSchema.safeParse({ ...ok, academic_level: 'Wizard' }).success).toBe(false);
    expect(studentSchema.safeParse({ ...ok, required_duration_weeks: '500' }).success).toBe(false);
    expect(studentSchema.safeParse({ ...ok, expected_graduation: '2027-13-45' }).success).toBe(false);
  });
  it('only keeps http(s) links', () => {
    expect(normaliseUrl('linkedin.com/in/ada')).toBe('https://linkedin.com/in/ada');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', '']) expect(normaliseUrl(bad)).toBeNull();
  });
  it('splits and de-duplicates lists', () => expect(splitList('SQL, sql ,Excel,, SQL')).toEqual(['SQL', 'sql', 'Excel']));
});
describe('profile completion', () => {
  it('is 0 for an empty profile and lists what is missing', () => { const r = profileCompletion({}); expect(r.percent).toBe(0); expect(r.missing.length).toBe(8); });
  it('adds student items only for students', () => {
    expect(profileCompletion({ is_student: false }).missing.length).toBe(8);
    expect(profileCompletion({ is_student: true }).missing.length).toBe(12);
  });
  it('reaches 100 when everything is filled', () => {
    const r = profileCompletion({ full_name: 'A B', phone: '1', headline: 'h', location: 'l', summary: 's', skills: ['a', 'b', 'c'], links: [{}], arrangements: ['remote'] });
    expect(r.percent).toBe(100); expect(r.missing).toEqual([]);
  });
});
