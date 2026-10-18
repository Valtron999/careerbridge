import { describe, expect, it } from 'vitest';
import { destinationAfterLogin, roleHome } from '../src/lib/auth/redirect';

describe('where people land after signing in', () => {
  it('sends each role to its own home by default', () => {
    expect(destinationAfterLogin(null, 'candidate')).toBe('/dashboard'); expect(destinationAfterLogin(null, 'employer')).toBe('/employer');
    expect(destinationAfterLogin(null, 'admin')).toBe('/admin'); expect(destinationAfterLogin(null, 'super_admin')).toBe('/admin');
  });
  it('honours a requested page inside the area their role can open', () => {
    expect(destinationAfterLogin('/employer/opportunities/new', 'employer')).toBe('/employer/opportunities/new');
    expect(destinationAfterLogin('/admin/reports', 'admin')).toBe('/admin/reports'); expect(destinationAfterLogin('/dashboard/cvs', 'candidate')).toBe('/dashboard/cvs');
  });
  it('never sends someone into an area their role cannot open', () => {
    expect(destinationAfterLogin('/admin', 'candidate')).toBe('/dashboard'); expect(destinationAfterLogin('/admin/users', 'employer')).toBe('/employer');
    expect(destinationAfterLogin('/employer', 'candidate')).toBe('/dashboard'); expect(destinationAfterLogin('/dashboard', 'employer')).toBe('/employer');
    expect(destinationAfterLogin('/employer', 'admin')).toBe('/admin');
  });
  it('lets anyone continue to public pages they were visiting', () => { expect(destinationAfterLogin('/apply/some-job', 'candidate')).toBe('/apply/some-job'); expect(destinationAfterLogin('/jobs?q=x', 'employer')).toBe('/jobs?q=x'); });
  it('knows each role\'s home', () => { expect(roleHome('employer')).toBe('/employer'); });
});
