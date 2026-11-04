import { describe, expect, it } from 'vitest';

import { detectAiOrigin } from './aiOrigin';

const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
const u16 = (n: number) => Uint8Array.of(n >> 8, n & 0xff);
const u32 = (n: number) => Uint8Array.of(n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
const le32 = (n: number) => Uint8Array.of(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24);

/** A JPEG: SOI, the given APPn segments, then start of scan with some pixels. */
function jpeg(segments: [number, string][], pixels = 'pixels') {
  return concat(
    Uint8Array.of(0xff, 0xd8),
    ...segments.map(([marker, body]) =>
      concat(Uint8Array.of(0xff, marker), u16(body.length + 2), bytes(body)),
    ),
    Uint8Array.of(0xff, 0xda),
    bytes(pixels),
    Uint8Array.of(0xff, 0xd9),
  );
}

/** A PNG with the given chunks around one IDAT. */
function png(chunks: [string, string][], pixels = 'pixels') {
  const chunk = (type: string, body: string) =>
    concat(u32(body.length), bytes(type), bytes(body), u32(0));
  return concat(
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk('IHDR', 'header-bytes!'),
    ...chunks.map(([type, body]) => chunk(type, body)),
    chunk('IDAT', pixels),
    chunk('IEND', ''),
  );
}

function webp(chunks: [string, string][]) {
  const body = concat(
    bytes('WEBP'),
    ...chunks.map(([type, data]) =>
      concat(
        bytes(type),
        le32(data.length),
        bytes(data),
        data.length % 2 ? Uint8Array.of(0) : new Uint8Array(),
      ),
    ),
  );
  return concat(bytes('RIFF'), le32(body.length), body);
}

const xmp = (inner: string) =>
  `http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta><rdf:Description ${inner}/></x:xmpmeta>`;

describe('detectAiOrigin', () => {
  it('reads an ordinary camera JPEG as an upload', () => {
    expect(detectAiOrigin(jpeg([[0xe1, 'Exif\x00\x00Canon EOS R6']]))).toBe('upload');
  });

  it('finds the IPTC digital source type in XMP', () => {
    const source =
      'Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"';
    expect(detectAiOrigin(jpeg([[0xe1, xmp(source)]]))).toBe('ai');
    const composite = source.replace('trained', 'compositeWithTrained');
    expect(detectAiOrigin(jpeg([[0xe1, xmp(composite)]]))).toBe('ai');
  });

  it('finds a generator in the EXIF Software field or the XMP CreatorTool', () => {
    expect(detectAiOrigin(jpeg([[0xe1, 'Exif\x00\x00II*\x00\x31\x01Midjourney v6']]))).toBe('ai');
    expect(detectAiOrigin(jpeg([[0xe1, xmp('xmp:CreatorTool="Adobe Firefly"')]]))).toBe('ai');
  });

  it('finds a C2PA manifest saying the picture was generated', () => {
    const c2pa = 'JP\x00\x00jumbc2pa...digitalSourceType...trainedAlgorithmicMedia';
    expect(detectAiOrigin(jpeg([[0xeb, c2pa]]))).toBe('ai');
  });

  it('finds Stable Diffusion and ComfyUI text chunks in a PNG', () => {
    expect(
      detectAiOrigin(png([['tEXt', 'parameters\x00a cat on a bench\nSteps: 30, Sampler: Euler']])),
    ).toBe('ai');
    expect(
      detectAiOrigin(
        png([
          ['tEXt', 'prompt\x00{"3":{}}'],
          ['tEXt', 'workflow\x00{"nodes":[]}'],
        ]),
      ),
    ).toBe('ai');
    expect(detectAiOrigin(png([['tEXt', 'Software\x00GIMP 2.10']]))).toBe('upload');
  });

  it('reads the XMP of a WebP', () => {
    expect(detectAiOrigin(webp([['XMP ', xmp('xmp:CreatorTool="DALL-E 3"')]]))).toBe('ai');
    expect(detectAiOrigin(webp([['VP8 ', 'pixels']]))).toBe('upload');
  });

  it('never reads the pixels or anything the author wrote', () => {
    expect(detectAiOrigin(jpeg([], 'midjourney trainedAlgorithmicMedia'))).toBe('upload');
    expect(detectAiOrigin(png([], 'Stable Diffusion'))).toBe('upload');
    expect(detectAiOrigin(bytes('Сгенерировано с ИИ: midjourney'))).toBe('upload');
  });
});
