import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AI_LIMITS, aiConfigured, getAiProvider } from '@/lib/ai';
import { AI_MESSAGES, aiFailure } from '@/lib/ai/messages';
import { reserveAiUse } from '@/lib/ai/guard';
import { ACTIONS, BULLET_SECTIONS, runCvAssist } from '@/lib/ai/cv-assist';
import { cvSchema, normalizeCv, pruneCv, redactForAi } from '@/lib/cv/schema';

export const runtime = 'nodejs';
const body = z.object({
  action: z.enum(ACTIONS), cv: z.unknown(), mode: z.enum(['student', 'general']).default('general'),
  jobDescription: z.string().max(8000).optional(),
  target: z.object({ section: z.enum(BULLET_SECTIONS), index: z.number().int().min(0).max(20) }).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to use AI assistance.' }, { status: 401 });
  if (session.profile.role !== 'candidate') return NextResponse.json({ error: 'AI CV tools are for candidate accounts.' }, { status: 403 });
  if (!aiConfigured()) return NextResponse.json({ error: AI_MESSAGES.not_configured, code: 'not_configured' }, { status: 503 });

  const text = await req.text();
  if (text.length > 80_000) return NextResponse.json({ error: 'That request is too large.' }, { status: 413 });
  let parsed: z.infer<typeof body>;
  try { parsed = body.parse(JSON.parse(text)); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const cv = pruneCv(normalizeCv(parsed.cv));
  if (!cvSchema.safeParse(cv).success) return NextResponse.json({ error: 'Invalid CV data.' }, { status: 400 });
  if (parsed.action === 'tailor' && !(parsed.jobDescription ?? '').trim()) return NextResponse.json({ error: 'Paste a job description to tailor your CV.' }, { status: 400 });

  const inputChars = JSON.stringify(redactForAi(cv)).length + (parsed.jobDescription?.length ?? 0);
  if (inputChars > AI_LIMITS.maxInputChars) return NextResponse.json({ error: 'Your CV is too long to send to the AI in one go. Try improving one section at a time.' }, { status: 413 });

  const quota = await reserveAiUse(createClient(), session.userId, `cv.${parsed.action}`, inputChars);
  if (!quota.ok) return NextResponse.json({ error: quota.reason === 'minute' ? 'You are going a bit fast. Wait a minute and try again.' : 'You have reached today\'s AI limit. It resets within 24 hours. You can keep editing by hand.', code: 'quota' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } });

  try {
    const out = await runCvAssist(getAiProvider(), { action: parsed.action, cv, mode: parsed.mode, jobDescription: parsed.jobDescription, target: parsed.target });
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return aiFailure(e, 'cv ai failed'); }
}
