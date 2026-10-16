import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';
import { CoverLetterPdf } from '../src/components/letters/letter-pdf';
import { parseLetter } from '../src/lib/letters/model';

describe('cover letter pdf', () => {
  it('renders a valid PDF from a stored letter', async () => {
    const parts = parseLetter('Dear Hiring Manager,\n\nI am a third-year Computer Science student applying for the placement.\n\nI built a library app with React.\n\nSincerely,\nAda Example');
    const buf = await renderToBuffer(createElement(CoverLetterPdf, { parts, sender: { name: 'Ada Example', email: 'ada@example.com', phone: '+234 800 000 0000', location: 'Lagos' }, date: '16 October 2026', title: 'Letter' }) as unknown as ReactElement<DocumentProps>);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF'); writeFileSync('/tmp/letter.pdf', buf);
  });
  it('renders without a sender (no CV linked)', async () => {
    const buf = await renderToBuffer(createElement(CoverLetterPdf, { parts: parseLetter('Dear X,\n\nHello world.\n\nSincerely,\nA'), sender: null, date: 'today', title: 'L' }) as unknown as ReactElement<DocumentProps>);
    expect(buf.length).toBeGreaterThan(500);
  });
});
