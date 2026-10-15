import { NextResponse, type NextRequest } from 'next/server';
import { createElement, type ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CvPdf } from '@/components/cv/cv-pdf';
import { TEMPLATES, normalizeCv, pruneCv, type TemplateId } from '@/lib/cv/schema';

export const runtime = 'nodejs';
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to download your CV.' }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  // RLS restricts this query to the signed-in owner, so guessed ids return nothing.
  const { data } = await createClient().from('candidate_cvs').select('title, template, content').eq('id', params.id).eq('user_id', session.userId).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const template = (TEMPLATES as readonly string[]).includes(data.template) ? (data.template as TemplateId) : 'professional';
  try {
    const cv = pruneCv(normalizeCv(data.content));
    const buf = await renderToBuffer(createElement(CvPdf, { cv, template }) as unknown as ReactElement<DocumentProps>);
    const name = (data.title || 'cv').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'cv';
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"`, 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('pdf render failed', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({ error: 'We could not generate the PDF. Please try again.' }, { status: 500 });
  }
}
