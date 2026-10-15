import { describe, expect, it } from 'vitest';
import { checkUpload, detectKind, pdfLooksActive, sanitizeFileName } from '../src/lib/files/validate';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(Math.max(0, 16 - b.length)).fill(0)]);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34);
const file = (b: Uint8Array, name: string, type = '') => new File([b as BlobPart], name, { type });

describe('file type detection', () => {
  it('recognises real PDFs and images by content', () => {
    expect(detectKind(PDF)?.ext).toBe('pdf');
    expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe('png');
    expect(detectKind(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe('jpg');
    expect(detectKind(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0]))?.ext).toBe('webp');
  });
  it('rejects everything else, including executables and HTML', () => {
    expect(detectKind(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectKind(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // Windows .exe
    expect(detectKind(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // zip/docx
    expect(detectKind(new Uint8Array(4))).toBeNull();
  });
});
describe('upload checks', () => {
  const opts = { maxBytes: 1000, allow: ['application/pdf' as const] };
  it('accepts a PDF whatever it is called or declared as', async () => {
    const r = await checkUpload(file(PDF, 'cv.exe', 'application/x-msdownload'), opts);
    expect(r.ok && r.name).toBe('cv.pdf');
  });
  it('rejects a disguised executable', async () => { expect((await checkUpload(file(bytes(0x4d, 0x5a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), 'letter.pdf', 'application/pdf'), opts)).ok).toBe(false); });
  it('rejects empty, oversize and non-files', async () => {
    expect((await checkUpload(file(new Uint8Array(0), 'a.pdf'), opts)).ok).toBe(false);
    expect((await checkUpload(file(new Uint8Array(2000), 'a.pdf'), opts)).ok).toBe(false);
    expect((await checkUpload('not a file', opts)).ok).toBe(false);
    expect((await checkUpload(null, opts)).ok).toBe(false);
  });
  it('rejects an image where only PDFs are allowed', async () => { expect((await checkUpload(file(bytes(0xff, 0xd8, 0xff, 0xe0), 'p.jpg'), opts)).ok).toBe(false); });
  it('flags PDFs with scripts', async () => {
    const evil = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj');
    expect(pdfLooksActive(evil)).toBe(true);
    expect((await checkUpload(file(evil, 'x.pdf'), { maxBytes: 5000, allow: ['application/pdf'] })).ok).toBe(false);
    expect(pdfLooksActive(PDF)).toBe(false);
  });
});
describe('file names', () => {
  it('strips paths and odd characters and forces the detected extension', () => {
    expect(sanitizeFileName('../../etc/passwd', 'pdf')).toBe('passwd.pdf');
    expect(sanitizeFileName('C:\\Users\\me\\My <CV>.docx', 'pdf')).toBe('My CV.pdf');
    expect(sanitizeFileName('', 'png')).toBe('file.png');
    expect(sanitizeFileName('a'.repeat(300) + '.pdf', 'pdf').length).toBeLessThanOrEqual(64);
  });
});
