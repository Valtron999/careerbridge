export type AiErrorCode = 'not_configured' | 'rate_limited' | 'provider_rejected' | 'provider_error' | 'bad_output' | 'timeout';
export class AiError extends Error { constructor(public code: AiErrorCode, message?: string) { super(message ?? code); } }

export type GenerateRequest = { system: string; user: string; maxOutputTokens?: number };
/** Any model provider implements this. Features (CV, cover letters, assistant) depend only on this interface. */
export interface AiProvider { readonly name: string; generateJson(req: GenerateRequest): Promise<string>; }
