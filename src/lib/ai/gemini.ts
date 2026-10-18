import { AiError, type AiErrorCode, type AiProvider, type GenerateRequest } from './types';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GoogleError = { error?: { code?: number; message?: string; status?: string; details?: { reason?: string }[] } };

/** Turns Google's error response into a code we can act on, plus a short log line. Never includes the key or anything we sent. */
export function classifyGeminiError(http: number, bodyText: string, apiKey = ''): { code: AiErrorCode; detail: string } {
  let g: GoogleError['error'] = {};
  try { g = (JSON.parse(bodyText) as GoogleError).error ?? {}; } catch { /* not JSON */ }
  const message = g?.message ?? bodyText.slice(0, 200);
  const reason = g?.details?.find((d) => d.reason)?.reason ?? '';
  const text = `${message} ${reason}`.toLowerCase();
  let code: AiErrorCode = 'provider_rejected';
  if (http === 429) code = 'rate_limited';
  else if (http === 401 || http === 403 || /api key (not valid|expired)|api_key_invalid|leaked|permission_denied/.test(text)) code = 'provider_auth';
  else if (g?.status === 'FAILED_PRECONDITION' || /free tier is not available|location is not supported|enable billing|billing/.test(text)) code = 'provider_region';
  else if (http === 404 || /no longer available|is not found|not supported for generatecontent|unexpected model name|json mode is not enabled|developer instruction is not enabled|not enabled for models/.test(text)) code = 'provider_model';
  else if (http >= 500) code = 'provider_error';
  let detail = `gemini ${http}${g?.status ? ` ${g.status}` : ''}${reason ? ` ${reason}` : ''}: ${message}`.replace(/\s+/g, ' ').slice(0, 300);
  if (apiKey) detail = detail.split(apiKey).join('[key]');
  return { code, detail: detail.replace(/AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,}/g, '[key]') };
}

export function createGeminiProvider(apiKey: string, model: string, fetchImpl: typeof fetch = fetch, baseUrl: string = process.env.AI_BASE_URL || DEFAULT_BASE): AiProvider {
  return {
    name: 'gemini',
    async generateJson({ system, user, maxOutputTokens = 2048 }: GenerateRequest) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      try {
        const res = await fetchImpl(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, // key stays in a header, never in logs or URLs
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens },
          }),
        });
        if (!res.ok) { const c = classifyGeminiError(res.status, await res.text().catch(() => ''), apiKey); throw new AiError(c.code, c.detail); }
        const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
        if (!text) throw new AiError('bad_output', json.promptFeedback?.blockReason ? 'blocked' : 'empty');
        return text;
      } catch (e) {
        if (e instanceof AiError) throw e;
        if (e instanceof Error && e.name === 'AbortError') throw new AiError('timeout');
        throw new AiError('provider_error', 'network');
      } finally { clearTimeout(timer); }
    },
  };
}
