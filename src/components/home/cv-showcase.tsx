'use client';
import { useMemo, useState } from 'react';
import { CvPreview } from '@/components/cv/cv-preview';
import { TEMPLATES, TEMPLATE_LABELS, type TemplateId } from '@/lib/cv/schema';
import { sampleCv } from '@/lib/cv/sample';

/** The real CV preview with placeholder text, so students see what the builder produces. Template choice is the same switch the builder offers. */
export function CvShowcase() {
  const [t, setT] = useState<TemplateId>('student');
  const cv = useMemo(() => sampleCv(), []);
  return (
    <div>
      <div role="group" aria-label="Preview a template" className="mb-3 flex flex-wrap gap-2">
        {TEMPLATES.map((id) => <button key={id} type="button" aria-pressed={t === id} onClick={() => setT(id)} className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition motion-reduce:transition-none ${t === id ? 'border-brand bg-brand text-white' : 'border-surface-line bg-white text-slate-700 hover:border-brand'}`}>{TEMPLATE_LABELS[id].name}</button>)}
      </div>
      <CvPreview cv={cv} template={t} pageWidth={560} fontScale={1.25} />
      <p className="mt-2 text-xs text-ink-muted">Sample layout with placeholder text. Your CV uses your own details.</p>
    </div>
  );
}
