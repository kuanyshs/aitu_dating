/**
 * Whether a picture was made by a generative model, read from the original file's own
 * metadata before it is shrunk (the smaller copy keeps none). Never from the post's text.
 * The real backend repeats this check on the original it receives.
 */
export type PhotoOrigin = 'upload' | 'ai';

/** IPTC Digital Source Type values for generated media, as XMP or C2PA carry them. */
const SOURCE_TYPES = ['trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia'];

/** Generators that sign the Software / CreatorTool fields or PNG text chunks. */
const GENERATORS = [
  'midjourney',
  'dall-e',
  'dall·e',
  'dalle',
  'stable diffusion',
  'stablediffusion',
  'adobe firefly',
  'imagen',
  'leonardo.ai',
  'novelai',
  'comfyui',
  'automatic1111',
];

/** Metadata sits before the pixels; a C2PA manifest may also trail them. */
const HEAD_BYTES = 512 * 1024;
const TAIL_BYTES = 128 * 1024;

function latin1(bytes: Uint8Array): string {
  let out = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return out;
}

/** The metadata of a JPEG, PNG or WebP without its pixels, as text; unknown formats give ''. */
export function metadataText(bytes: Uint8Array): string {
  const parts: Uint8Array[] = [];
  const u16 = (i: number) => (bytes[i]! << 8) | bytes[i + 1]!;
  const u32 = (i: number) => ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | u16(i + 2)) >>> 0;
  const le32 = (i: number) =>
    (bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)) >>> 0;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // JPEG: APPn and COM segments up to the start of scan.
    let i = 2;
    while (i + 4 <= bytes.length && bytes[i] === 0xff) {
      const marker = bytes[i + 1]!;
      if (marker === 0xda) break;
      const length = u16(i + 2);
      parts.push(bytes.subarray(i + 4, i + 2 + length));
      i += 2 + length;
    }
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    // PNG: every chunk but the pixels, with its type, so «tEXtparameters» stays readable.
    let i = 8;
    while (i + 8 <= bytes.length) {
      const length = u32(i);
      const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
      if (type !== 'IDAT') parts.push(bytes.subarray(i + 4, i + 8 + length));
      if (type === 'IEND') break;
      i += 12 + length;
    }
  } else if (latin1(bytes.subarray(0, 4)) === 'RIFF' && latin1(bytes.subarray(8, 12)) === 'WEBP') {
    // WebP: the EXIF and XMP chunks.
    let i = 12;
    while (i + 8 <= bytes.length) {
      const type = latin1(bytes.subarray(i, i + 4));
      const length = le32(i + 4);
      if (type === 'EXIF' || type === 'XMP ') parts.push(bytes.subarray(i + 8, i + 8 + length));
      i += 8 + length + (length % 2);
    }
  }
  return parts.map(latin1).join('\n');
}

/** PNG text chunks that Stable Diffusion front ends and ComfyUI write. */
function hasGeneratorChunks(meta: string): boolean {
  // A1111 / Forge: «parameters» with «Steps:»; ComfyUI: «prompt» and «workflow».
  const sd = /(tEXt|iTXt)parameters\x00[\s\S]{0,4000}Steps: \d+/.test(meta);
  const comfy = /(tEXt|iTXt)prompt\x00/.test(meta) && /(tEXt|iTXt)workflow\x00/.test(meta);
  return sd || comfy;
}

export function detectAiOrigin(bytes: Uint8Array): PhotoOrigin {
  const meta = metadataText(bytes);
  // C2PA manifests may also trail the pixels.
  const tail = bytes.length > HEAD_BYTES ? latin1(bytes.subarray(-TAIL_BYTES)) : '';
  if (SOURCE_TYPES.some((type) => meta.includes(type) || tail.includes(type))) return 'ai';
  if (hasGeneratorChunks(meta)) return 'ai';
  const lower = meta.toLowerCase();
  if (GENERATORS.some((name) => lower.includes(name))) return 'ai';
  return 'upload';
}

export async function photoOrigin(file: Blob): Promise<PhotoOrigin> {
  const size = file.size;
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  if (size <= HEAD_BYTES) return detectAiOrigin(head);
  const tail = new Uint8Array(await file.slice(size - TAIL_BYTES).arrayBuffer());
  const joined = new Uint8Array(head.length + tail.length);
  joined.set(head);
  joined.set(tail, head.length);
  return detectAiOrigin(joined);
}
