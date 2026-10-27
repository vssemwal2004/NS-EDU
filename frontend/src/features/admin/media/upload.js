export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const formatBytes = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

// The browser uploads straight to Cloudinary with a short-lived signature from our API, then the
// result is registered in the media library so it can be reused. The API secret never reaches the browser.
// `request` is useAdminSession().request. Resolves to the registered media item ({ url, publicId, … }).
export async function uploadImage(request, file, { usage = 'other', alt = '' } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Images must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller.`);
  const signed = await request('/media/sign', { method: 'POST', body: { usage } });
  const form = new FormData();
  form.set('file', file);
  for (const key of ['api_key', 'timestamp', 'folder', 'allowed_formats', 'tags', 'signature']) {
    const value = { api_key: signed.apiKey }[key] ?? signed[key];
    if (value !== undefined && value !== null && value !== '') form.set(key, String(value));
  }
  const response = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || 'Cloudinary rejected the upload.');
  const { item } = await request('/media', { method: 'POST', body: { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, bytes: result.bytes, format: result.format, alt, usage } });
  return item;
}
