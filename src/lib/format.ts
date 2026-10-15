export type Money = { salary_min: number | null; salary_max: number | null; salary_currency: string | null; is_unpaid: boolean };

function money(n: number, currency: string): string {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); } catch { return `${currency} ${n.toLocaleString()}`; }
}
/** Returns null when the employer supplied nothing, so the UI can omit or say "Not specified". Never invents figures. */
export function formatCompensation(o: Money): string | null {
  if (o.is_unpaid) return 'Unpaid';
  const c = o.salary_currency ?? 'NGN';
  if (o.salary_min != null && o.salary_max != null) return `${money(o.salary_min, c)} – ${money(o.salary_max, c)}`;
  if (o.salary_min != null) return `From ${money(o.salary_min, c)}`;
  if (o.salary_max != null) return `Up to ${money(o.salary_max, c)}`;
  return null;
}
export function formatLocation(o: { location_city: string | null; location_state: string | null; location_country: string | null; work_arrangement: string }): string {
  const parts = [o.location_city, o.location_state].filter(Boolean);
  if (parts.length === 0 && o.location_country) parts.push(o.location_country);
  const place = parts.join(', ');
  if (o.work_arrangement === 'remote') return place ? `Remote · ${place}` : 'Remote';
  return place || 'Location not specified';
}
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(iso));
}
export const ARRANGEMENT_LABEL: Record<string, string> = { onsite: 'Onsite', hybrid: 'Hybrid', remote: 'Remote' };
export const EMPLOYMENT_LABEL: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', apprenticeship: 'Apprenticeship', volunteer: 'Volunteer', temporary: 'Temporary' };

export type ListingState = 'open' | 'closed' | 'expired';
export function listingState(o: { status: string; deadline: string | null }, now = new Date()): ListingState {
  if (o.status !== 'published') return 'closed';
  if (o.deadline && new Date(o.deadline) < now) return 'expired';
  return 'open';
}
