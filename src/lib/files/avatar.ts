import sharp from 'sharp';

/** Square 512px WebP. Re-encoding drops EXIF (including GPS) and any data hidden after the image. Throws if the bytes are not a decodable image. */
export async function processAvatar(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
}
