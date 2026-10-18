import { AiError, type AiProvider } from './types';
import { createGeminiProvider } from './gemini';

/** Chooses the provider from environment variables. Add new providers here only. */
export function getAiProvider(): AiProvider {
  const kind = (process.env.AI_PROVIDER ?? 'none').toLowerCase();
  const key = process.env.AI_API_KEY;
  if (kind === 'gemini' && key) return createGeminiProvider(key, process.env.AI_MODEL || 'gemini-flash-latest');
  throw new AiError('not_configured');
}
export function aiConfigured(): boolean { return (process.env.AI_PROVIDER ?? 'none') !== 'none' && Boolean(process.env.AI_API_KEY); }
export const AI_LIMITS = {
  daily: Number(process.env.AI_DAILY_LIMIT ?? 20) || 20,
  perMinute: Number(process.env.AI_PER_MINUTE_LIMIT ?? 5) || 5,
  maxInputChars: 12_000,
};
export { AiError } from './types';
