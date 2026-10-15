function offsetMs(ts: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - ts;
}
/** Converts a `datetime-local` string ("2026-10-20T14:30") interpreted in `tz` to a UTC Date. */
export function zonedToUtc(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const o1 = offsetMs(guess, tz); let t = guess - o1;
    const o2 = offsetMs(t, tz); if (o2 !== o1) t = guess - o2;
    return new Date(t);
  } catch { return null; }
}
export const INTERVIEW_ZONES = ['Africa/Lagos', 'UTC', 'Europe/London', 'America/New_York'] as const;
export function formatInZone(iso: string, tz: string): string {
  try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso)) + ` (${tz})`; } catch { return iso; }
}
