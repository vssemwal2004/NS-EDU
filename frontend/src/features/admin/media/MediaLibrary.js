'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import styles from './MediaLibrary.module.css';

const USAGES = [{ value: 'logo', label: 'University logo' }, { value: 'cover', label: 'Cover image' }, { value: 'site', label: 'Site artwork' }, { value: 'other', label: 'Other' }];
const MAX_BYTES = 8 * 1024 * 1024;
const kb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

// Files go straight from the browser to Cloudinary with a short-lived signature from our API,
// then the result is registered here. The API secret never reaches the browser.
export default function MediaLibrary() {
  const { request } = useAdminSession();
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState('logo');
  const [filter, setFilter] = useState('');
  const [list, setList] = useState({ items: [], total: 0, loading: true, error: '' });
  const [upload, setUpload] = useState({ busy: false, error: '', done: '' });
  const [copied, setCopied] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setList((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const data = await request(`/media?${new URLSearchParams({ limit: '48', ...(filter && { usage: filter }) })}`);
      setList({ items: data.items, total: data.total, loading: false, error: '' });
    } catch (error) { setList((previous) => ({ ...previous, loading: false, error: error.message })); }
  }, [filter, request]);

  useEffect(() => { request('/media/config').then(setConfig).catch(() => setConfig({ configured: false })); }, [request]);
  useEffect(() => { load(); }, [load]);

  async function onUpload(event) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    const alt = new FormData(event.currentTarget).get('alt')?.toString().trim() || '';
    if (!file) { setUpload({ busy: false, error: 'Choose an image first.', done: '' }); return; }
    if (!file.type.startsWith('image/')) { setUpload({ busy: false, error: 'Only image files can be uploaded.', done: '' }); return; }
    if (file.size > MAX_BYTES) { setUpload({ busy: false, error: `Images must be ${kb(MAX_BYTES)} or smaller.`, done: '' }); return; }
    setUpload({ busy: true, error: '', done: '' });
    try {
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
      await request('/media', { method: 'POST', body: { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, bytes: result.bytes, format: result.format, alt, usage } });
      event.target.reset();
      setUpload({ busy: false, error: '', done: 'Uploaded. Copy the URL into a university’s Logo URL or Cover image URL field.' });
      load();
    } catch (error) { setUpload({ busy: false, error: error.message, done: '' }); }
  }

  async function copy(url) {
    try { await window.navigator.clipboard.writeText(url); setCopied(url); window.setTimeout(() => setCopied(''), 2000); } catch { window.prompt('Copy this URL', url); }
  }
  async function remove(item) {
    if (!window.confirm(`Delete this image from Cloudinary? Pages that still use it will show a broken image.\n\n${item.publicId}`)) return;
    try { await request(`/media/${item.id}`, { method: 'DELETE' }); load(); } catch (error) { setList((previous) => ({ ...previous, error: error.message })); }
  }

  return <div className={styles.layout}>
    <section className={styles.card} aria-labelledby="media-upload-title">
      <h2 id="media-upload-title"><Icon name="plus" />Upload an image</h2>
      {config && !config.configured ? <p className={styles.warning} role="status"><Icon name="shield" />Cloudinary is not configured on the server. Add CLOUDINARY_URL to backend/.env and restart the API.</p> : <>
        <p className={styles.muted}>Images are stored on Cloudinary{config?.cloudName ? ` (${config.cloudName})` : ''} in the <code>{config?.folder || 'gyaan-vidhya'}</code> folder and served from its CDN. JPG, PNG, WebP, AVIF, GIF or SVG, up to {kb(MAX_BYTES)}.</p>
        <form className={styles.form} onSubmit={onUpload}>
          <label>Image<input ref={fileRef} type="file" accept="image/*" disabled={upload.busy} /></label>
          <label>Used for<select value={usage} onChange={(event) => setUsage(event.target.value)} disabled={upload.busy}>{USAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Description (alt text)<input name="alt" maxLength={200} placeholder="e.g. Main gate of Example University" disabled={upload.busy} /></label>
          {upload.error && <p className={styles.error} role="alert">{upload.error}</p>}
          {upload.done && <p className={styles.success} role="status">{upload.done}</p>}
          <button className="button button--primary" type="submit" disabled={upload.busy || !config?.configured}>{upload.busy ? 'Uploading…' : 'Upload to Cloudinary'}</button>
        </form>
      </>}
    </section>

    <section className={styles.card} aria-labelledby="media-list-title">
      <div className={styles.head}>
        <h2 id="media-list-title">Library <small>{list.total}</small></h2>
        <label className={styles.filter}><span className="sr-only">Filter by use</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All images</option>{USAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      {list.error && <p className={styles.error} role="alert">{list.error}</p>}
      {list.loading ? <p className={styles.muted}>Loading…</p> : list.items.length ? <ul className={styles.grid}>
        {list.items.map((item) => <li key={item.id} className={styles.tile}>
          {/* Cloudinary thumbnail transformation keeps the grid light. */}
          <img src={item.url.replace('/upload/', '/upload/c_fit,w_320,h_220,q_auto,f_auto/')} alt={item.alt || ''} loading="lazy" />
          <div className={styles.meta}>
            <strong title={item.publicId}>{item.alt || item.publicId.split('/').pop()}</strong>
            <small>{USAGES.find((usageItem) => usageItem.value === item.usage)?.label} · {item.width}×{item.height} · {item.bytes ? kb(item.bytes) : ''}</small>
          </div>
          <div className={styles.actions}>
            <button type="button" className="button button--outline" onClick={() => copy(item.url)}><Icon name={copied === item.url ? 'check' : 'document'} />{copied === item.url ? 'Copied' : 'Copy URL'}</button>
            <button type="button" className={styles.danger} onClick={() => remove(item)} aria-label={`Delete ${item.alt || item.publicId}`}><Icon name="trash" /></button>
          </div>
        </li>)}
      </ul> : <p className={styles.muted}>No images yet.</p>}
    </section>
  </div>;
}
