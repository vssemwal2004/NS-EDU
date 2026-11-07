'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import ConfirmDialog from '../crm/ConfirmDialog';
import RowMenu from '../crm/RowMenu';
import { dateTimeOf } from '../crm/format';
import { useToaster } from '../crm/toast';
import Pagination from '../table/Pagination';
import { useServerList } from '../table/useServerList';
import { PageToolbar } from '../ui/Page';
import { resizedImage } from '@/lib/image-url';
import { formatBytes, MAX_IMAGE_BYTES, uploadImage } from './upload';
import styles from './MediaLibrary.module.css';

const USAGES = [{ value: 'logo', label: 'University logo' }, { value: 'cover', label: 'Cover image' }, { value: 'site', label: 'Site artwork' }, { value: 'place', label: 'City or state tile' }, { value: 'counsellor', label: 'Counsellor photo' }, { value: 'other', label: 'Other' }];
const usageLabel = (value) => USAGES.find((item) => item.value === value)?.label ?? 'Other';
const PAGE_SIZES = [24, 48];
const nameOf = (item) => item.alt || item.publicId.split('/').pop();
// A small copy resized by Next keeps the grid light (CSS crops it); see lib/image-url.
const thumb = (url) => resizedImage(url, 400);

async function copyText(text) {
  try { await window.navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function UploadDrawer({ open, onClose, request, config, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [usage, setUsage] = useState('logo');
  const [alt, setAlt] = useState('');
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: '' });
  const input = useRef(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function reset() { setFile(null); setPreview(''); setUsage('logo'); setAlt(''); setErrors({}); setState({ busy: false, error: '' }); if (input.current) input.current.value = ''; }
  function close() { if (state.busy) return; reset(); onClose(); }

  function choose(event) {
    const next = event.target.files?.[0] ?? null;
    setErrors({});
    if (!next) { setFile(null); setPreview(''); return; }
    if (!next.type.startsWith('image/')) { setErrors({ file: 'Choose an image file (JPG, PNG, WebP, AVIF, GIF or SVG).' }); setFile(null); setPreview(''); event.target.value = ''; return; }
    if (next.size > MAX_IMAGE_BYTES) { setErrors({ file: `This image is ${formatBytes(next.size)}. Images must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller.` }); setFile(null); setPreview(''); event.target.value = ''; return; }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) { setErrors({ file: 'Choose an image first.' }); return; }
    setState({ busy: true, error: '' });
    try {
      const item = await uploadImage(request, file, { usage, alt: alt.trim() });
      reset();
      onUploaded(item);
    } catch (error) { setState({ busy: false, error: error.message }); }
  }

  return <AdminDrawer open={open} onClose={close} title="Upload an image" subtitle={`Stored on Cloudinary${config?.cloudName ? ` (${config.cloudName})` : ''} in the ${config?.folder || 'gyaan-vidhya'} folder.`}>
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.fieldBlock}>
        <span className="adm-label" id="media-file-label">Image <span className={styles.required} aria-hidden="true">*</span></span>
        <label className={styles.drop} data-filled={file ? true : undefined} data-invalid={errors.file ? true : undefined}>
          <input ref={input} type="file" accept="image/*" disabled={state.busy} onChange={choose} aria-labelledby="media-file-label" aria-describedby="media-file-help" aria-invalid={Boolean(errors.file) || undefined} />
          {preview ? <img src={preview} alt="" /> : <span className={styles.dropEmpty}><Icon name="upload" /><strong>Choose an image</strong><small>or drop it here</small></span>}
        </label>
        {file && <p className={styles.fileName} title={file.name}>{file.name} · <span className="crm-tabnum">{formatBytes(file.size)}</span></p>}
        <span id="media-file-help" className="adm-hint">JPG, PNG, WebP, AVIF, GIF or SVG, up to {formatBytes(MAX_IMAGE_BYTES)}.</span>
        {errors.file && <span className="adm-error" role="alert">{errors.file}</span>}
      </div>
      <div className={styles.two}>
        <label className="adm-label">Used for
          <select className="adm-select" value={usage} disabled={state.busy} title="Decides the Cloudinary folder and helps find the image later" onChange={(event) => setUsage(event.target.value)}>
            {USAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="adm-label">Alt text
          <input className="adm-input" value={alt} maxLength={200} placeholder="What the image shows" title="Read aloud by screen readers. Describe what the image shows." disabled={state.busy} onChange={(event) => setAlt(event.target.value)} />
        </label>
      </div>
      {state.error && <p className={styles.formError} role="alert"><Icon name="alert" />{state.error}</p>}
      <div className={styles.formFooter}>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={close} disabled={state.busy}>Cancel</button>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy || !file}><Icon name="upload" />{state.busy ? 'Uploading…' : 'Upload image'}</button>
      </div>
    </form>
  </AdminDrawer>;
}

// Files go straight from the browser to Cloudinary with a short-lived signature from our API,
// then the result is registered here. The API secret never reaches the browser.
export default function MediaLibrary() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const [config, setConfig] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ q: '', usage: '', page: 1, limit: PAGE_SIZES[0] });
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });
  const list = useServerList(request, '/media', filters, { scope: admin?.id ?? '' });
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    request('/media/config', { signal: controller.signal }).then(setConfig).catch((error) => { if (error.name !== 'AbortError') setConfig({ configured: false }); });
    return () => controller.abort();
  }, [request]);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  // ?add=1 (from the New menu) opens the upload drawer once the configuration is known.
  useEffect(() => {
    if (!config?.configured) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('add') !== '1') return;
    url.searchParams.delete('add');
    window.history.replaceState(null, '', url);
    Promise.resolve().then(() => setUploading(true));
  }, [config]);

  async function copy(item) {
    if (await copyText(item.url)) toast.success('Image URL copied. Paste it into a Logo, Cover or image field.');
    else toast.error('Could not copy. Open the original and copy the address from the browser.');
  }
  async function remove() {
    setDeleteState({ busy: true, error: '' });
    try {
      await request(`/media/${deleting.id}`, { method: 'DELETE' });
      toast.success(`Deleted “${nameOf(deleting)}”.`);
      setDeleting(null); setDeleteState({ busy: false, error: '' });
      list.reload();
    } catch (error) { setDeleteState({ busy: false, error: error.message }); }
  }

  const filtered = Boolean(filters.q || filters.usage);
  const notConfigured = config && !config.configured;
  const summary = list.data
    ? <><strong className="crm-tabnum">{total.toLocaleString('en-IN')}</strong> {total === 1 ? 'image' : 'images'}{filtered ? ' match' : ''}</>
    : list.error ? 'Media library' : 'Loading images…';

  return <>
    <PageToolbar summary={summary} start={<>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search images</span>
        <input type="search" value={query} maxLength={80} placeholder="Search alt text or file name…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className={styles.filter}><span className="sr-only">Filter by use</span>
        <select className="adm-select" value={filters.usage} onChange={(event) => setFilters((current) => ({ ...current, usage: event.target.value, page: 1 }))}>
          <option value="">All uses</option>
          {USAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
    </>}>
      <button type="button" className="adm-btn adm-btn--primary" onClick={() => setUploading(true)} disabled={!config?.configured}
        title={notConfigured ? 'Cloudinary is not configured on the server' : undefined}><Icon name="upload" />Upload image</button>
    </PageToolbar>

    {notConfigured && <p className={styles.notice} role="status"><Icon name="alert" />Cloudinary is not configured on the server, so uploads are off. Add CLOUDINARY_URL to backend/.env and restart the API.</p>}

    <section className={`adm-panel ${styles.panel}`} aria-label="Images" aria-busy={list.loading || list.busy}>
      {list.error ? <div className={styles.state} role="alert">
        <span className={styles.stateIcon} data-tone="bad"><Icon name="alert" /></span>
        <strong>Could not load images</strong><p>{list.error}</p>
        <button type="button" className="adm-btn" onClick={list.reload}><Icon name="refresh" />Try again</button>
      </div> : list.loading ? <ul className={styles.grid} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <li key={index} className={styles.card}><span className={styles.skelThumb} /><span className={styles.skelLine} /><span className={styles.skelLine} data-short="true" /></li>)}
      </ul> : !items.length ? <div className={styles.empty}>
        <p>{filtered ? 'No images match this search.' : 'No images yet. Uploaded images can be pasted into any image field.'}</p>
        {filtered ? <button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); setFilters((current) => ({ ...current, q: '', usage: '', page: 1 })); }}>Clear filters</button>
          : config?.configured && <button type="button" className="adm-btn adm-btn--sm" onClick={() => setUploading(true)}><Icon name="upload" />Upload image</button>}
      </div> : <ul className={styles.grid} data-busy={list.busy || undefined}>
        {items.map((item) => <li key={item.id} className={styles.card}>
          <a className={styles.thumb} href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${nameOf(item)} in a new tab`}>
            <img src={thumb(item.url)} alt={item.alt || ''} loading="lazy" />
          </a>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <strong className={styles.name} title={item.alt ? `${item.alt}\n${item.publicId}` : item.publicId}>{nameOf(item)}</strong>
              <RowMenu label={`Actions for ${nameOf(item)}`} items={[
                { key: 'copy', label: 'Copy URL', icon: 'copy', onSelect: () => copy(item) },
                { key: 'open', label: 'Open original', icon: 'external', onSelect: () => window.open(item.url, '_blank', 'noopener,noreferrer') },
                { divider: true },
                { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', onSelect: () => { setDeleteState({ busy: false, error: '' }); setDeleting(item); } },
              ]} />
            </div>
            <small className={styles.meta}>{usageLabel(item.usage)}</small>
            <small className={`${styles.meta} crm-tabnum`} title={[item.format?.toUpperCase(), `Uploaded ${dateTimeOf(item.createdAt)}`, item.createdBy].filter(Boolean).join(' · ')}>{[item.width && item.height ? `${item.width}×${item.height}` : '', item.bytes ? formatBytes(item.bytes) : ''].filter(Boolean).join(' · ') || '—'}</small>
          </div>
        </li>)}
      </ul>}
      {list.data && total > 0 && <Pagination page={filters.page} pageSize={filters.limit} pageSizes={PAGE_SIZES} total={total} rowCount={items.length} noun="images"
        hasPrevious={filters.page > 1} hasNext={filters.page * filters.limit < total} disabled={list.busy}
        onPage={(page) => setFilters((current) => ({ ...current, page }))} onPageSize={(limit) => setFilters((current) => ({ ...current, limit, page: 1 }))} />}
    </section>

    <UploadDrawer open={uploading} onClose={() => setUploading(false)} request={request} config={config}
      onUploaded={(item) => { setUploading(false); toast.success(`Uploaded “${nameOf(item)}”. Copy its URL from the ⋮ menu.`); list.reload(); }} />

    <ConfirmDialog open={Boolean(deleting)} tone="danger" title="Delete this image?" confirmLabel="Delete image" requireText="DELETE" busy={deleteState.busy} error={deleteState.error}
      onCancel={() => setDeleting(null)} onConfirm={remove}>
      <strong>{deleting ? nameOf(deleting) : ''}</strong> is removed from Cloudinary for good. Pages that still use its URL will show a broken image.
    </ConfirmDialog>
  </>;
}
