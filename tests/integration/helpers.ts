import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const ids = JSON.parse(readFileSync(process.env.CB_INT_FILE!, 'utf8')) as {
  secret: string; users: Record<'a' | 'b' | 'e1' | 'e2' | 'adm', string>; orgs: { org1: string; org2: string }; opps: Record<string, string>; visible: string[]; categories: Record<string, string>;
};
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub: string | null, role: string) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64({ ...(sub ? { sub } : {}), role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${h}.${p}.${createHmac('sha256', ids.secret).update(`${h}.${p}`).digest('base64url')}`;
}
/** A supabase-js client talking to real PostgREST as the given user (or anonymously), so RLS and RPC argument shapes are the real thing. */
export const tokenFor = (who: keyof typeof ids.users | 'anon') => (who === 'anon' ? jwt(null, 'anon') : jwt(ids.users[who], 'authenticated'));
export function as(who: keyof typeof ids.users | 'anon'): SupabaseClient {
  const token = who === 'anon' ? jwt(null, 'anon') : jwt(ids.users[who], 'authenticated');
  return createClient(process.env.CB_REST_URL!, 'test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}
