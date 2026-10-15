import { z } from 'zod';

/** Only https URLs may be used as external application destinations. */
export function isSafeExternalUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}

/** Prevents open redirects: only same-site relative paths are accepted. */
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}

export const externalUrlSchema = z.string().url().refine(isSafeExternalUrl, 'Use a secure https:// link');
export const externalEmailSchema = z.string().email();

/** Turns user-typed text into an http(s) URL, or null. "example.com/x" gets https://; any other scheme is rejected. */
export function toWebUrl(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^(javascript|data|vbscript|mailto|file|blob|ftp|tel|sms):/i.test(v)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^https?:\/\//i.test(v)) return null;
  try { const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? u.toString() : null; } catch { return null; }
}
