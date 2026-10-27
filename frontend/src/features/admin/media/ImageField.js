'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { formatBytes, MAX_IMAGE_BYTES, uploadImage } from './upload';
import styles from '../ResourceManager.module.css';

const CLOUDINARY = 'https://res.cloudinary.com/';
// Only Cloudinary URLs are previewed (the API rejects anything else), as a small cropped thumbnail.
const thumbnail = (url) => url.startsWith(CLOUDINARY) ? url.replace('/image/upload/', '/image/upload/c_fill,w_480,h_270,q_auto,f_auto/') : '';

// Form control for `type: 'image'` resource fields: upload to Cloudinary (registered in the media
// library under `field.usage`), or paste a URL copied from the library. The value is the URL.
export default function ImageField({ field, common, value, onChange, onBusyChange }) {
  const { request } = useAdminSession();
  const fileRef = useRef(null);
  const [configured, setConfigured] = useState(null);
  const [status, setStatus] = useState({ busy: false, error: '' });
  const preview = thumbnail(value.trim());

  useEffect(() => {
    const controller = new AbortController();
    request('/media/config', { signal: controller.signal }).then((data) => setConfigured(data.configured)).catch((error) => { if (error.name !== 'AbortError') setConfigured(false); });
    return () => controller.abort();
  }, [request]);

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus({ busy: true, error: '' });
    onBusyChange?.(true);
    try {
      const item = await uploadImage(request, file, { usage: field.usage || 'other' });
      onChange(item.url);
      setStatus({ busy: false, error: '' });
    } catch (error) { setStatus({ busy: false, error: error.message }); } finally { onBusyChange?.(false); }
  }

  return <div className={styles.imageField}>
    <div className={styles.imagePreview} data-empty={!preview || undefined}>
      {preview ? <img src={preview} alt="" /> : <span><Icon name="plus" />No image yet</span>}
    </div>
    <div className={styles.imageControls}>
      <div className={styles.imageActions}>
        <button type="button" className="button button--outline" onClick={() => fileRef.current?.click()} disabled={status.busy || !configured}>
          <Icon name="plus" />{status.busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
        </button>
        {value && <button type="button" className="button button--ghost" onClick={() => onChange('')} disabled={status.busy}><Icon name="trash" />Remove</button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      <input className={styles.input} {...common} type="url" inputMode="url" maxLength={field.maxLength ?? 500} placeholder={`${CLOUDINARY}…`} value={value} onChange={(event) => onChange(event.target.value)} />
      <p className={styles.help} role="status">
        {configured === false ? 'Cloudinary is not configured on the server, so uploads are off. Add CLOUDINARY_URL to backend/.env.' : `JPG, PNG, WebP or AVIF up to ${formatBytes(MAX_IMAGE_BYTES)}, or paste a URL copied from the Media library.`}
      </p>
      {status.error && <p className={styles.fieldError} role="alert">{status.error}</p>}
    </div>
  </div>;
}
