import { NextResponse } from 'next/server';
import { AiError } from './types';

export const AI_MESSAGES: Record<string, string> = {
  not_configured: 'AI assistance is not set up on this site. You can keep writing by hand.',
  rate_limited: 'The AI service is busy right now. Please try again in a minute.',
  timeout: 'The AI service took too long to respond. Please try again.',
  bad_output: 'The AI returned something we could not use. Please try again.',
  provider_rejected: 'The AI service could not process this request. Please try again later.',
  provider_error: 'The AI service is unavailable right now. You can keep writing by hand.',
};
/** Turns a provider failure into a safe JSON response. Logs the code only, never user content or keys. */
export function aiFailure(e: unknown, label: string) {
  const code = e instanceof AiError ? e.code : 'provider_error';
  console.error(label, code, e instanceof AiError ? e.message : '');
  return NextResponse.json({ error: AI_MESSAGES[code] ?? AI_MESSAGES.provider_error, code }, { status: code === 'rate_limited' ? 429 : 502 });
}
