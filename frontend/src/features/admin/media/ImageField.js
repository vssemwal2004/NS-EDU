'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { isOptimisable, resizedImage } from '@/lib/image-url';
import { formatBytes, MAX_IMAGE_BYTES, uploadImage } from './upload';
import styles from '../ResourceManager.module.css';

const thumbnail = (url) => (isOptimisable(url) ? resizedImage(url, 480) : '');

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
      <input className={styles.input} {...common} type="url" inputMode="url" maxLength={field.maxLength ?? 500} placeholder="Paste an image URL from the library" value={value} onChange={(event) => onChange(event.target.value)} />
      <p className={styles.help} role="status">
        {configured === false ? 'Set up R2 image storage on the server to enable uploads.' : `Choose an image up to ${formatBytes(MAX_IMAGE_BYTES)}, or paste a URL copied from the media library.`}
      </p>
      {status.error && <p className={styles.fieldError} role="alert">{status.error}</p>}
    </div>
  </div>;
}
