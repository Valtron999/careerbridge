import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CvEditor } from '@/components/cv/cv-editor';
import { TEMPLATES, normalizeCv, type TemplateId } from '@/lib/cv/schema';
import { aiConfigured } from '@/lib/ai';

export const metadata: Metadata = { title: 'Edit CV', robots: { index: false } };
export default async function EditCv({ params, searchParams }: { params: { id: string }; searchParams: { job?: string } }) {
  const { userId } = await requireUser(`/dashboard/cvs/${params.id}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const { data: cv } = await supabase.from('candidate_cvs').select('id, title, template, content').eq('id', params.id).eq('user_id', userId).maybeSingle();
  if (!cv) notFound();
  let jobText = '';
  if (searchParams.job && /^[a-z0-9-]{1,200}$/.test(searchParams.job)) {
    const { data: o } = await supabase.from('opportunities').select('title, description, requirements, qualifications').eq('slug', searchParams.job).eq('status', 'published').maybeSingle();
    if (o) jobText = [o.title, o.description, o.requirements, o.qualifications].filter(Boolean).join('\n\n').slice(0, 8000);
  }
  const content = normalizeCv(cv.content);
  const template = (TEMPLATES as readonly string[]).includes(cv.template) ? (cv.template as TemplateId) : 'professional';
  const mode = content.sectionOrder.indexOf('education') < content.sectionOrder.indexOf('experience') ? 'student' : 'general';
  return <CvEditor key={cv.id} id={cv.id} initialTitle={cv.title} initialTemplate={template} initial={content} mode={mode} aiEnabled={aiConfigured()} jobText={jobText} />;
}
