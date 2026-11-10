import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Minimal Cloudflare R2 client over its S3-compatible API (no SDK; requests are signed with AWS
// Signature V4, like lib/cloudinary.js signs its own). Used for campus photographs instead of
// Cloudinary, which bills every image transformation against a 25-credit Free plan.
//
// Settings (backend/.env):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY   the Cloudflare account and an R2 API token
//   R2_IMAGES_BUCKET        bucket for photographs (default "gyaan-vidhya"). Deliberately not R2_BUCKET,
//                           which other projects sharing the same account may use for something else.
//   R2_IMAGES_PUBLIC_URL    the bucket's public address: its r2.dev URL or a custom domain, no trailing slash
//   R2_IMAGES_PREFIX        optional folder inside the bucket (e.g. "gyaan-vidhya") when the bucket is shared with
//                           something else; every object this module writes for photographs goes under it
//   IMAGE_STORAGE=cloudinary  forces the old Cloudinary uploader even when R2 is configured
const clean = (value) => String(value ?? '').trim().replace(/^["']|["']$/g, '').replace(/[\\/\s]+$/g, '');

export function r2Config() {
  const accountId = clean(process.env.R2_ACCOUNT_ID);
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  const bucket = clean(process.env.R2_IMAGES_BUCKET) || 'gyaan-vidhya';
  const publicUrl = clean(process.env.R2_IMAGES_PUBLIC_URL);
  const prefix = clean(process.env.R2_IMAGES_PREFIX).replace(/^\/+/, '');
  return {
    accountId, accessKeyId, secretAccessKey, bucket, publicUrl, prefix,
    host: `${accountId}.r2.cloudflarestorage.com`,
    // Uploading needs the keys; the stored address needs the public URL.
    configured: Boolean(accountId && accessKeyId && secretAccessKey && /^https:\/\//i.test(publicUrl)),
    hasKeys: Boolean(accountId && accessKeyId && secretAccessKey),
  };
}

/** True when new photographs should go to R2 (configured, and not switched off with IMAGE_STORAGE=cloudinary). */
export const r2Selected = () => r2Config().configured && process.env.IMAGE_STORAGE !== 'cloudinary';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const encodeSegment = (segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const encodeKey = (key) => key.split('/').map(encodeSegment).join('/');

// Error text never carries credentials, but strip them anyway before anything is logged.
function sanitize(message) {
  const { accessKeyId, secretAccessKey } = r2Config();
  return [accessKeyId, secretAccessKey].filter(Boolean).reduce((text, value) => text.split(value).join('[redacted]'), String(message));
}

/** One signed request. `key` is the object key inside the bucket; an empty key addresses the bucket itself. */
async function request(method, key, { body, contentType, headers = {}, bucket, timeoutMs = 60_000 } = {}) {
  const config = r2Config();
  if (!config.hasKeys) throw new Error('R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in backend/.env.');
  const payload = body ?? '';
  const payloadHash = sha256(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const path = `/${encodeSegment(bucket ?? config.bucket)}${key ? `/${encodeKey(key)}` : ''}`;
  const signed = { host: config.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...(contentType ? { 'content-type': contentType } : {}), ...headers };
  const names = Object.keys(signed).map((name) => name.toLowerCase()).sort();
  const lowered = Object.fromEntries(Object.entries(signed).map(([name, value]) => [name.toLowerCase(), String(value).trim()]));
  const canonical = [method, path, '', ...names.map((name) => `${name}:${lowered[name]}`), '', names.join(';'), payloadHash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, day), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const { host: _host, ...sendHeaders } = lowered;
  try {
    return await fetch(`https://${config.host}${path}`, { method, headers: { ...sendHeaders, authorization }, body: body ?? undefined, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(sanitize(`R2 ${method} failed: ${error.cause?.code ?? error.message}`));
  }
}

async function fail(response, what) {
  const text = await response.text().catch(() => '');
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
  throw new Error(sanitize(`R2 ${what} failed: HTTP ${response.status}${code ? ` ${code}` : ''}`));
}

/** 'exists', 'missing' (no such bucket) or 'forbidden' (the token cannot see it). */
export async function bucketState(bucket) {
  const response = await request('HEAD', '', { bucket });
  if (response.ok) return 'exists';
  if (response.status === 404) return 'missing';
  if (response.status === 403) return 'forbidden';
  return fail(response, 'bucket check');
}

export async function createBucket(bucket) {
  const response = await request('PUT', '', { bucket });
  if (!response.ok) await fail(response, 'bucket creation');
}

/** The object key for a path like universities/<slug>/photo-1.webp: the optional R2_IMAGES_PREFIX goes in front. */
export const objectKey = (path) => { const { prefix } = r2Config(); return prefix ? `${prefix}/${path.replace(/^\/+/, '')}` : path.replace(/^\/+/, ''); };

const TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', gif: 'image/gif' };
export const publicUrlFor = (key) => `${r2Config().publicUrl}/${encodeKey(key)}`;
export const isR2Url = (value) => { const base = r2Config().publicUrl; return Boolean(base) && typeof value === 'string' && value.startsWith(`${base}/`); };

/** Stores a Buffer (or a local file path) at `key`. Returns { key, secure_url } like the Cloudinary uploader. */
export async function putObject(source, key, { contentType, cacheControl = 'public, max-age=604800' } = {}) {
  const body = typeof source === 'string' ? await readFile(source) : source;
  const type = contentType ?? TYPES[key.split('.').pop().toLowerCase()] ?? 'application/octet-stream';
  const response = await request('PUT', key, { body, contentType: type, headers: { 'cache-control': cacheControl } });
  if (!response.ok) await fail(response, `upload of ${key}`);
  return { key, secure_url: publicUrlFor(key), bytes: body.byteLength };
}

export async function hasObject(key) {
  const response = await request('HEAD', key);
  if (response.ok) return true;
  if (response.status === 404) return false;
  return fail(response, `check of ${key}`);
}

export async function deleteObject(key) {
  const response = await request('DELETE', key);
  if (!response.ok && response.status !== 404) await fail(response, `delete of ${key}`);
}

/** Same signature as lib/cloudinary.js uploadImage, so the image pipeline can use either. */
export async function uploadImage(source, { publicId, folder, format = 'webp' } = {}) {
  const key = objectKey(`${folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : ''}${publicId}.${format}`);
  const stored = await putObject(source, key);
  return { ...stored, public_id: key, format };
}
