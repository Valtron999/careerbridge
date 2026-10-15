export type FileKind = { mime: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'pdf' | 'jpg' | 'png' | 'webp' };

export const DOC_TYPES = { school_letter: 'School introduction letter', acceptance_letter: 'Acceptance letter', logbook: 'Logbook', transcript: 'Transcript or result', certificate: 'Certificate', id_document: 'ID document', other: 'Other' } as const;
export type DocType = keyof typeof DOC_TYPES;
export const isDocType = (v: string): v is DocType => v in DOC_TYPES;

// 4 MB stays under common serverless request-body limits (for example 4.5 MB on Vercel).
export const LIMITS = { document: 4 * 1024 * 1024, avatar: 2 * 1024 * 1024, verification: 4 * 1024 * 1024, maxDocsPerUser: 30, maxVerificationFiles: 3 } as const;

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
/** Identifies a file from its first bytes. The browser-declared type and the file extension are never trusted. */
export function detectKind(b: Uint8Array): FileKind | null {
  if (b.length < 12) return null;
  if (starts(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf' };
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  if (starts(b, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Heuristic only: flags PDFs that declare scripts or launch actions. This is not a virus scan. */
export function pdfLooksActive(b: Uint8Array): boolean {
  const text = Buffer.from(b).toString('latin1');
  return /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/.test(text) && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(text);
}

export function sanitizeFileName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const stem = base.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^\w .()-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return `${stem || 'file'}.${ext}`;
}

export type Checked = { ok: true; bytes: Uint8Array; kind: FileKind; name: string } | { ok: false; error: string };
export async function checkUpload(file: unknown, opts: { maxBytes: number; allow: FileKind['mime'][] }): Promise<Checked> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a file to upload.' };
  if (file.size > opts.maxBytes) return { ok: false, error: `That file is too large. The limit is ${Math.round(opts.maxBytes / 1024 / 1024)} MB.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(bytes);
  const label = opts.allow.map((m) => m.split('/')[1]!.toUpperCase()).join(', ');
  if (!kind || !opts.allow.includes(kind.mime)) return { ok: false, error: `That file type is not allowed. Upload a ${label} file.` };
  if (kind.mime === 'application/pdf' && pdfLooksActive(bytes)) return { ok: false, error: 'This PDF contains scripts or embedded files, so we cannot accept it. Export a plain PDF and try again.' };
  return { ok: true, bytes, kind, name: sanitizeFileName(file.name, kind.ext) };
}
