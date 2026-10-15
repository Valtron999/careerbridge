import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_LIMITS } from './index';

export type QuotaResult = { ok: true } | { ok: false; reason: 'minute' | 'day'; retryAfterSeconds: number };

/** Per-user limits so one person cannot use up the shared free quota. Counts come from ai_usage_records (owner-readable under RLS). */
export async function reserveAiUse(supabase: SupabaseClient, userId: string, feature: string, inputChars: number): Promise<QuotaResult> {
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (ms: number) => (await supabase.from('ai_usage_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since(ms))).count ?? 0;
  const [minute, day] = await Promise.all([count(60_000), count(86_400_000)]);
  if (minute >= AI_LIMITS.perMinute) return { ok: false, reason: 'minute', retryAfterSeconds: 60 };
  if (day >= AI_LIMITS.daily) return { ok: false, reason: 'day', retryAfterSeconds: 3600 };
  // Recorded before the call so parallel requests cannot bypass the limit. Failed provider calls still count.
  const { error } = await supabase.from('ai_usage_records').insert({ user_id: userId, feature, input_chars: inputChars });
  if (error) return { ok: false, reason: 'minute', retryAfterSeconds: 30 };
  return { ok: true };
}
