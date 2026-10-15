import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processAvatar } from '../src/lib/files/avatar';
import { detectKind } from '../src/lib/files/validate';

describe('avatar processing', () => {
  it('re-encodes to a 512px square WebP and strips EXIF/GPS metadata', async () => {
    const withGps = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#315EFB' } })
      .withExif({ IFD0: { Copyright: 'secret-owner' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '6/1 27/1 0/1' } }).jpeg().toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined(); // the input really carries metadata
    const out = await processAvatar(withGps);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp'); expect([meta.width, meta.height]).toEqual([512, 512]);
    expect(meta.exif).toBeUndefined();
    expect(out.toString('latin1')).not.toContain('secret-owner');
    expect(detectKind(out)?.ext).toBe('webp');
  });
  it('rejects bytes that only look like an image header', async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('this is not really a jpeg at all, just text')]);
    await expect(processAvatar(fake)).rejects.toThrow();
  });
  it('rejects an oversized pixel count (decompression bomb guard)', async () => {
    const huge = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(processAvatar(huge)).rejects.toThrow();
  });
});
