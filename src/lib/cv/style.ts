import type { TemplateId } from './schema';
/** One style table drives both the HTML preview and the PDF so the two stay consistent. */
export const STYLE: Record<TemplateId, { serif: boolean; headerAlign: 'center' | 'left'; heading: 'rule' | 'bar' | 'accent-underline'; upper: boolean; nameSize: number; body: number; gap: number }> = {
  professional: { serif: true, headerAlign: 'center', heading: 'rule', upper: true, nameSize: 22, body: 10, gap: 11 },
  modern: { serif: false, headerAlign: 'left', heading: 'bar', upper: false, nameSize: 24, body: 9.5, gap: 12 },
  student: { serif: false, headerAlign: 'left', heading: 'accent-underline', upper: true, nameSize: 22, body: 10, gap: 12 },
};
