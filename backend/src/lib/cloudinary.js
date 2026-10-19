import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

// Minimal Cloudinary client over the REST API (no SDK): signed uploads, signed browser-upload
// parameters and deletes. Configure with CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>
// or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
function readConfig() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'cloudinary:') return { cloudName: parsed.hostname, apiKey: decodeURIComponent(parsed.username), apiSecret: decodeURIComponent(parsed.password) };
    } catch { /* fall through to the separate variables */ }
  }
  return { cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET };
}

export const cloudinaryFolder = () => (process.env.CLOUDINARY_FOLDER || 'gyaan-vidhya').replace(/^\/+|\/+$/g, '');

let warnedSwap = false;
export function cloudinaryConfig() {
  const config = readConfig();
  // Cloudinary API keys are numeric and secrets are not; a pasted-backwards pair is corrected with a warning.
  if (config.apiKey && config.apiSecret && !/^\d+$/.test(config.apiKey) && /^\d+$/.test(config.apiSecret)) {
    if (!warnedSwap) { warnedSwap = true; console.warn('Cloudinary: CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET look swapped in backend/.env; using them the other way round. Please fix the .env file.'); }
    [config.apiKey, config.apiSecret] = [config.apiSecret, config.apiKey];
  }
  return { ...config, configured: Boolean(config.cloudName && config.apiKey && config.apiSecret) };
}

// Cloudinary echoes the api_key in some errors; never pass credentials on to logs or responses.
function sanitize(message) {
  const { apiKey, apiSecret } = readConfig();
  return [apiKey, apiSecret].filter(Boolean).reduce((text, value) => text.split(value).join('[redacted]'), String(message));
}

function requireConfig() {
  const config = cloudinaryConfig();
  if (!config.configured) throw new Error('Cloudinary is not configured. Set CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) in backend/.env.');
  return config;
}

// https://cloudinary.com/documentation/authentication_signatures: sorted key=value pairs joined by &, then the secret, SHA-1.
export function signParams(params, apiSecret) {
  const payload = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== '').sort()
    .map((key) => `${key}=${Array.isArray(params[key]) ? params[key].join(',') : params[key]}`).join('&');
  return createHash('sha1').update(payload + apiSecret).digest('hex');
}

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif,gif,svg';

// Parameters a browser needs to upload straight to Cloudinary; the secret never leaves the server.
export function signedUploadParams({ folder, tags = [] } = {}) {
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const params = { timestamp: Math.floor(Date.now() / 1000), folder: folder || `${cloudinaryFolder()}/uploads`, allowed_formats: ALLOWED_FORMATS, tags: tags.join(',') || undefined };
  return { cloudName, apiKey, ...params, signature: signParams(params, apiSecret), uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` };
}

async function call(path, form) {
  const { cloudName } = requireConfig();
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${path}`, { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(sanitize(`Cloudinary ${path} failed: ${data.error?.message || response.status}`));
  return data;
}

/** Uploads a local file (path) or Buffer. Returns Cloudinary's response (secure_url, public_id, width, height, bytes, format). */
export async function uploadImage(source, { publicId, folder, overwrite = false, tags = [] } = {}) {
  const { apiKey, apiSecret } = requireConfig();
  const buffer = typeof source === 'string' ? await readFile(source) : source;
  const params = { timestamp: Math.floor(Date.now() / 1000), public_id: publicId, folder, overwrite: overwrite ? 'true' : undefined, tags: tags.join(',') || undefined, unique_filename: publicId ? 'false' : undefined };
  const form = new FormData();
  form.set('file', new Blob([buffer]), typeof source === 'string' ? basename(source) : 'upload');
  for (const [key, value] of Object.entries(params)) if (value !== undefined) form.set(key, String(value));
  form.set('api_key', apiKey);
  form.set('signature', signParams(params, apiSecret));
  return call('image/upload', form);
}

export async function destroyImage(publicId) {
  const { apiKey, apiSecret } = requireConfig();
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), invalidate: 'true' };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, String(value));
  form.set('api_key', apiKey);
  form.set('signature', signParams(params, apiSecret));
  return call('image/destroy', form);
}

// True only for delivery URLs of this account, so stored media cannot point at arbitrary hosts.
export function isOwnDeliveryUrl(value) {
  const { cloudName } = cloudinaryConfig();
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && url.pathname.startsWith(`/${cloudName}/`);
  } catch {
    return false;
  }
}
