export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const formatBytes = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

const LONG_EDGE = { logo: 640, counsellor: 800, place: 1280, cover: 1920, site: 1920, other: 1920 };
const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

// Multi-frame formats need their original encoded frames. Canvas can only draw a single frame.
async function keepAnimation(file) {
  if (file.type === 'image/gif') return true;
  if (!['image/png', 'image/webp', 'image/avif'].includes(file.type)) return false;
  const header = new Uint8Array(await file.slice(0, 128).arrayBuffer());
  const text = String.fromCharCode(...header);
  if (file.type === 'image/avif') return text.includes('avis');
  if (file.type === 'image/webp') return text.slice(12, 16) === 'VP8X' && Boolean(header[20] & 2);
  // APNG must declare acTL before its first IDAT. Skip large metadata chunks without reading them.
  for (let offset = 8; offset + 8 <= file.size;) {
    const chunk = new DataView(await file.slice(offset, offset + 8).arrayBuffer());
    const type = chunk.getUint32(4);
    if (type === 0x6163544c) return true;
    if (type === 0x49444154 || type === 0x49454e44) break;
    offset += chunk.getUint32(0) + 12;
  }
  return false;
}

async function prepareImage(file, usage) {
  if (!file.size || (!RASTER_TYPES.includes(file.type) && file.type !== 'image/svg+xml')) throw new Error('Choose a JPG, PNG, WebP, AVIF, GIF or SVG image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Images must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller.`);
  const source = document.createElement('img');
  const localUrl = URL.createObjectURL(file);
  try {
    source.src = localUrl;
    await source.decode().catch(() => { throw new Error('This image cannot be opened. Choose a valid image file.'); });
    const { naturalWidth, naturalHeight } = source;
    if (!naturalWidth || !naturalHeight) throw new Error('This image has no usable dimensions.');
    if (await keepAnimation(file)) {
      if (Math.max(naturalWidth, naturalHeight) > 8192) throw new Error('Resize animated images to 8192 pixels per side or smaller.');
      return { blob: file, width: naturalWidth, height: naturalHeight };
    }
    const scale = Math.min(1, (LONG_EDGE[usage] || LONG_EDGE.other) / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const encoded = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', usage === 'logo' ? 0.9 : 0.8));
    if (!encoded) throw new Error('Image compression failed. Please choose the file again.');
    const blob = scale === 1 && file.size <= encoded.size && RASTER_TYPES.includes(file.type) ? file : encoded;
    return { blob, width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(localUrl); }
}

export async function uploadImage(request, file, { usage = 'other', alt = '' } = {}) {
  const { blob, width, height } = await prepareImage(file, usage);
  const { uploadUrl, headers, receipt } = await request('/media/sign', { method: 'POST', body: {
    filename: file.name, usage, format: blob.type.slice('image/'.length), bytes: blob.size, width, height,
  } });
  // R2 may have completed a PUT even if the network or CORS prevents the browser reading its reply.
  const response = await fetch(uploadUrl, { method: 'PUT', body: blob, headers, credentials: 'omit', referrerPolicy: 'no-referrer' }).catch(() => null);
  if (response && !response.ok && response.status !== 412) throw new Error(`R2 could not accept the image (HTTP ${response.status}). Try uploading again.`);
  try {
    const { item } = await request('/media', { method: 'POST', body: { receipt, alt } });
    return item;
  } catch (error) {
    if (!response) throw new Error('Upload could not be confirmed. Check your connection and the allowed upload origins in R2.', { cause: error });
    throw error;
  }
}
