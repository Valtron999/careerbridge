export const TONES = ['professional', 'concise', 'enthusiastic'] as const;
export type Tone = (typeof TONES)[number];
export const TONE_LABELS: Record<Tone, { name: string; blurb: string }> = {
  professional: { name: 'Professional', blurb: 'Formal and clear. About 250 words.' },
  concise: { name: 'Concise', blurb: 'Short and direct. Under 200 words.' },
  enthusiastic: { name: 'Enthusiastic', blurb: 'Warm and energetic without exaggeration.' },
};
export const isTone = (v: unknown): v is Tone => typeof v === 'string' && (TONES as readonly string[]).includes(v);

export type LetterParts = { greeting: string; paragraphs: string[]; signoff: string };
// A greeting is a short line with no sentence punctuation ("Dear Sir," yes; "Hello. I am a student." no).
const GREETING = /^(dear|hello|hi|to whom it may concern)\b[^.!?\n]{0,60}[,:]?$/i;
// A sign-off is a closing phrase, optionally followed by one short name line.
const SIGNOFF = /^(sincerely|yours (sincerely|faithfully|truly)|kind regards|best regards|warm regards|regards|best wishes|respectfully)\s*[,!]?(\s*\n[^\n.!?]{0,60})?$/i;
export const DEFAULT_GREETING = 'Dear Hiring Manager,';
export const defaultSignoff = (name: string) => `Sincerely,\n${name.trim() || '[Your name]'}`;

/** The letter is stored as plain text: greeting, blank line, body paragraphs, blank line, sign-off. */
export function composeLetter(p: LetterParts): string {
  return [p.greeting.trim(), ...p.paragraphs.map((x) => x.trim()).filter(Boolean), p.signoff.trim()].filter(Boolean).join('\n\n');
}
export function parseLetter(body: string): LetterParts {
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  let greeting = DEFAULT_GREETING, signoff = '';
  if (blocks[0] && GREETING.test(blocks[0])) greeting = blocks.shift()!;
  const last = blocks[blocks.length - 1];
  if (last && SIGNOFF.test(last)) signoff = blocks.pop()!;
  return { greeting, paragraphs: blocks, signoff };
}
/** Drops any greeting or sign-off the model added by itself, so the app controls those lines. */
export function cleanParagraphs(ps: string[]): string[] {
  return ps.map((p) => p.trim()).filter((p) => p && !GREETING.test(p) && !SIGNOFF.test(p));
}
/** Bracketed gaps such as [add your course] that the user still has to fill in. */
export const findPlaceholders = (text: string): string[] => [...new Set(text.match(/\[[^\]\n]{2,80}\]/g) ?? [])];
export const wordCount = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);
