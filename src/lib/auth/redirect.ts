export type Role = 'candidate' | 'employer' | 'admin' | 'super_admin';
export const roleHome = (role: Role): string => (role === 'employer' ? '/employer' : role === 'candidate' ? '/dashboard' : '/admin');

/** Where to send someone after sign-in. A requested area is honoured only if their role may use it; otherwise they land on their own home. */
export function destinationAfterLogin(next: string | null, role: Role): string {
  const home = roleHome(role);
  if (!next) return home;
  if (next.startsWith('/admin')) return role === 'admin' || role === 'super_admin' ? next : home;
  if (next.startsWith('/employer')) return role === 'employer' ? next : home;
  if (next.startsWith('/dashboard')) return role === 'candidate' ? next : home;
  return next;
}
