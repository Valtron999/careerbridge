import { AiError, type AiProvider } from './types';
import { createGeminiProvider } from './gemini';

const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{1,80}$/;

/** Chooses the provider from environment variables. Add new providers here only. */
export function getAiProvider(): AiProvider {
  const kind = (process.env.AI_PROVIDER ?? 'none').toLowerCase();
  const key = process.env.AI_API_KEY;
  if (kind === 'gemini' && key) {
    const model = (process.env.AI_MODEL || 'gemini-flash-latest').trim();
    if (!MODEL_NAME.test(model)) throw new AiError('provider_model', `AI_MODEL is "${model.slice(0, 60)}", which is not a valid model name. It must look like gemini-flash-latest (letters, numbers, dots and dashes only). Check .env.local or your host's environment settings, then restart.`);
    return createGeminiProvider(key, model);
  }
  throw new AiError('not_configured');
}
export function aiConfigured(): boolean { return (process.env.AI_PROVIDER ?? 'none') !== 'none' && Boolean(process.env.AI_API_KEY); }
export const AI_LIMITS = {
  daily: Number(process.env.AI_DAILY_LIMIT ?? 20) || 20,
  perMinute: Number(process.env.AI_PER_MINUTE_LIMIT ?? 5) || 5,
  maxInputChars: 12_000,
};
export { AiError } from './types';
