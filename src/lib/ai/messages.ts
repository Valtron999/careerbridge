import { NextResponse } from 'next/server';
import { AiError } from './types';

export const AI_MESSAGES: Record<string, string> = {
  not_configured: 'AI assistance is not set up on this site. You can keep writing by hand.',
  rate_limited: 'The AI service is busy right now. Please try again in a minute.',
  timeout: 'The AI service took too long to respond. Please try again.',
  bad_output: 'The AI returned something we could not use. Please try again.',
  provider_auth: 'AI assistance is temporarily unavailable on this site. You can keep writing by hand.',
  provider_region: 'AI assistance is temporarily unavailable on this site. You can keep writing by hand.',
  provider_model: 'AI assistance is temporarily unavailable on this site. You can keep writing by hand.',
  provider_rejected: 'The AI service could not process this request. Please try again later.',
  provider_error: 'The AI service is unavailable right now. You can keep writing by hand.',
};
/** Turns a provider failure into a safe JSON response. Logs the code only, never user content or keys. */
export function aiFailure(e: unknown, label: string) {
  const code = e instanceof AiError ? e.code : 'provider_error';
  const detail = e instanceof AiError ? e.message : '';
  console.error(label, code, detail); // Google's reason (never the key or your content), so the site owner can see what to fix
  const debug = process.env.AI_DEBUG === '1' || process.env.NODE_ENV === 'development';
  return NextResponse.json({ error: AI_MESSAGES[code] ?? AI_MESSAGES.provider_error, code, ...(debug ? { detail } : {}) }, { status: code === 'rate_limited' ? 429 : 502 });
}
