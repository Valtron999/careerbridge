import { AiError, type AiProvider, type GenerateRequest } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function createGeminiProvider(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): AiProvider {
  return {
    name: 'gemini',
    async generateJson({ system, user, maxOutputTokens = 2048 }: GenerateRequest) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      try {
        const res = await fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, // key stays in a header, never in logs or URLs
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens },
          }),
        });
        if (res.status === 429) throw new AiError('rate_limited');
        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) throw new AiError('provider_rejected', `gemini status ${res.status}`);
        if (!res.ok) throw new AiError('provider_error', `gemini status ${res.status}`);
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
