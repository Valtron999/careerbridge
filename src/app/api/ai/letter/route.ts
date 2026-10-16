import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AI_LIMITS, aiConfigured, getAiProvider } from '@/lib/ai';
import { reserveAiUse } from '@/lib/ai/guard';
import { aiFailure, AI_MESSAGES } from '@/lib/ai/messages';
import { runLetterAssist, type JobInfo } from '@/lib/ai/letter-assist';
import { getOpportunity } from '@/lib/data/opportunities';
import { normalizeCv, pruneCv, redactForAi } from '@/lib/cv/schema';
import { TONES } from '@/lib/letters/model';

export const runtime = 'nodejs';
const body = z.object({
  action: z.enum(['generate', 'section']), cvId: z.string().uuid(), tone: z.enum(TONES),
  opportunitySlug: z.string().regex(/^[a-z0-9-]{1,200}$/).optional(),
  custom: z.object({ title: z.string().max(160), employer: z.string().max(160), description: z.string().max(6000) }).optional(),
  paragraphs: z.array(z.string().max(1500)).max(6).optional(), index: z.number().int().min(0).max(5).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to use AI assistance.' }, { status: 401 });
  if (session.profile.role !== 'candidate') return NextResponse.json({ error: 'Cover letters are for candidate accounts.' }, { status: 403 });
  if (!aiConfigured()) return NextResponse.json({ error: AI_MESSAGES.not_configured, code: 'not_configured' }, { status: 503 });

  const text = await req.text();
  if (text.length > 40_000) return NextResponse.json({ error: 'That request is too large.' }, { status: 413 });
  let p: z.infer<typeof body>;
  try { p = body.parse(JSON.parse(text)); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (p.action === 'section' && (!p.paragraphs?.length || p.index === undefined || p.index >= p.paragraphs.length)) return NextResponse.json({ error: 'Choose a paragraph to rewrite.' }, { status: 400 });

  // The CV is loaded here as the signed-in user (RLS), so a request can never use someone else's CV or a tampered copy.
  const supabase = createClient();
  const { data: row } = await supabase.from('candidate_cvs').select('content').eq('id', p.cvId).eq('user_id', session.userId).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Choose one of your CVs so the letter uses your real details.' }, { status: 400 });
  const cv = pruneCv(normalizeCv(row.content));
  const mode = cv.sectionOrder.indexOf('education') < cv.sectionOrder.indexOf('experience') ? 'student' : 'general';

  let job: JobInfo | undefined;
  if (p.opportunitySlug) {
    const o = await getOpportunity(p.opportunitySlug);
    if (!o) return NextResponse.json({ error: 'That listing is no longer available.' }, { status: 404 });
    job = { title: o.title, employer: o.employer?.name ?? '', description: [o.description, o.responsibilities, o.requirements, o.qualifications].filter(Boolean).join('\n\n') };
  } else if (p.custom && (p.custom.description.trim() || p.custom.title.trim())) job = p.custom;

  const chars = JSON.stringify(redactForAi(cv)).length + (job ? job.title.length + job.employer.length + Math.min(job.description.length, 5000) : 0) + (p.paragraphs?.join('').length ?? 0);
  if (chars > AI_LIMITS.maxInputChars) return NextResponse.json({ error: 'Your CV and the job text are too long to send together. Shorten the job text and try again.' }, { status: 413 });

  const quota = await reserveAiUse(supabase, session.userId, `letter.${p.action}`, chars);
  if (!quota.ok) return NextResponse.json({ error: quota.reason === 'minute' ? 'You are going a bit fast. Wait a minute and try again.' : "You have reached today's AI limit. It resets within 24 hours. You can keep writing by hand.", code: 'quota' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } });
  try {
    const out = await runLetterAssist(getAiProvider(), p.action === 'generate' ? { action: 'generate', cv, mode, tone: p.tone, job } : { action: 'section', cv, mode, tone: p.tone, job, paragraphs: p.paragraphs!, index: p.index! });
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return aiFailure(e, 'letter ai failed'); }
}
