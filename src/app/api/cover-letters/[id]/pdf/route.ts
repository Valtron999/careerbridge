import { NextResponse, type NextRequest } from 'next/server';
import { createElement, type ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CoverLetterPdf, type Sender } from '@/components/letters/letter-pdf';
import { parseLetter } from '@/lib/letters/model';
import { normalizeCv } from '@/lib/cv/schema';

export const runtime = 'nodejs';
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to download your letter.' }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = createClient();
  const { data: letter } = await supabase.from('cover_letters').select('title, body, cv_id').eq('id', params.id).eq('user_id', session.userId).maybeSingle(); // RLS: owner only
  if (!letter) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  let sender: Sender | null = null;
  if (letter.cv_id) { const { data: cv } = await supabase.from('candidate_cvs').select('content').eq('id', letter.cv_id).eq('user_id', session.userId).maybeSingle(); if (cv) { const p = normalizeCv(cv.content).personal; sender = { name: p.full_name, email: p.email, phone: p.phone, location: p.location }; } }
  try {
    const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date());
    const buf = await renderToBuffer(createElement(CoverLetterPdf, { parts: parseLetter(letter.body), sender, date, title: letter.title }) as unknown as ReactElement<DocumentProps>);
    const name = (letter.title || 'cover-letter').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'cover-letter';
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"`, 'Cache-Control': 'private, no-store' } });
  } catch (e) { console.error('letter pdf failed', e instanceof Error ? e.name : 'unknown'); return NextResponse.json({ error: 'We could not generate the PDF. Please try again.' }, { status: 500 }); }
}
