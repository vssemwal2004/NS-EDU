'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { formatSize, formatWhen, mediaSlots, parseJson, pretty } from './content-format';
import styles from './Content.module.css';

// JSON editor for one site_content key: format, client-side parse check, server validation,
// optimistic concurrency (updatedAt), the last five versions and reset to default.
export default function ContentEditor({ contentKey }) {
  const [item, setItem] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [serverError, setServerError] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const textRef = useRef(null);

  const apply = useCallback((next) => { setItem(next); setText(pretty(next.data)); setServerError(null); }, []);
  const load = useCallback((signal) => api(`/admin/content/${contentKey}`, { signal })
    .then(({ item: next }) => { apply(next); setLoadError(''); })
    .catch((error) => { if (error.name !== 'AbortError') setLoadError(error.status === 404 ? 'This content key does not exist.' : error.message); }), [apply, contentKey]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const parsed = useMemo(() => parseJson(text), [text]);
  const saved = item ? pretty(item.data) : '';
  const dirty = Boolean(item) && text !== saved;
  const preview = parsed.value ?? item?.data;

  async function run(action, success) {
    setBusy(true); setNotice(''); setServerError(null);
    try {
      const { item: next } = await action();
      apply(next);
      setNotice(success);
    } catch (error) {
      setServerError({ message: error.message, fields: error.fields, conflict: error.status === 409 });
    } finally { setBusy(false); setConfirm(null); }
  }
  const save = (event) => {
    event.preventDefault();
    if (parsed.error || !dirty) return;
    run(() => api(`/admin/content/${contentKey}`, { method: 'PUT', body: { data: parsed.value, updatedAt: item.updatedAt } }), 'Saved. The site shows the change within about a minute.');
  };
  const format = () => { if (!parsed.error) setText(pretty(parsed.value)); };
  const jumpToError = () => {
    const node = textRef.current;
    if (!node || !parsed.error?.line) return;
    const offset = text.split('\n').slice(0, parsed.error.line - 1).join('\n').length + (parsed.error.line > 1 ? 1 : 0) + (parsed.error.column || 1) - 1;
    node.focus(); node.setSelectionRange(offset, offset + 1);
  };

  if (loadError) return <div className={styles.page}><p className={styles.error} role="alert"><Icon name="shield" />{loadError}</p><Link className="text-link" href="/admin/content"><Icon name="arrow" />All site content</Link></div>;
  if (!item) return <div className={styles.page}><p className={styles.muted} role="status">Loading…</p></div>;

  return <div className={styles.page}>
    <Link className={`text-link ${styles.back}`} href="/admin/content"><Icon name="arrow" />All site content</Link>
    <header className={styles.editorHead}>
      <div><h2>{item.label} <code>{item.key}</code></h2><p>{item.description}</p></div>
      <p className={styles.meta}><span><Icon name="calendar" />Last saved {formatWhen(item.updatedAt)}{item.updatedBy ? ` by ${item.updatedBy}` : ' (default)'}</span><span><Icon name="layers" />{formatSize(item.size)}</span></p>
    </header>

    {item.key === 'media' && <section className={styles.panel} aria-labelledby="media-preview-title">
      <h3 id="media-preview-title">Image previews</h3>
      <ul className={styles.media}>{mediaSlots(preview).map((slot) => <li key={slot.path}>
        {/* Admin preview of any URL: a plain img avoids the optimiser's host allow-list. */}
        <span className={styles.thumb}><img src={slot.src} alt={slot.alt || ''} loading="lazy" /></span>
        <span><strong>{slot.path}</strong><small>{slot.width} × {slot.height}</small><small className={styles.src}>{slot.src}</small></span>
      </li>)}</ul>
    </section>}

    <form className={styles.panel} onSubmit={save} noValidate>
      <div className={styles.toolbar}>
        <label htmlFor="content-json"><h3>JSON</h3></label>
        <span className={styles.status} data-state={parsed.error ? 'error' : dirty ? 'dirty' : 'clean'}>{parsed.error ? 'Invalid JSON' : dirty ? 'Unsaved changes' : 'Saved'}</span>
        <div className={styles.actions}>
          <button type="button" className="button button--ghost" onClick={format} disabled={Boolean(parsed.error)}>Format</button>
          <button type="button" className="button button--ghost" onClick={() => setText(saved)} disabled={!dirty || busy}>Discard</button>
          <button type="submit" className="button button--primary" disabled={!dirty || Boolean(parsed.error) || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      <textarea ref={textRef} id="content-json" className={styles.code} value={text} spellCheck={false} autoCapitalize="off" autoComplete="off" wrap="off"
        rows={Math.min(36, Math.max(12, text.split('\n').length + 1))} aria-invalid={Boolean(parsed.error)} aria-describedby="content-json-help"
        onChange={(event) => { setText(event.target.value); setNotice(''); }} />
      <p id="content-json-help" className={styles.muted}>Keep property names and ids unchanged unless you know what reads them; edit the text values. Links are site paths (/about) or https:// URLs.</p>
      {parsed.error && <p className={styles.error} role="alert"><Icon name="shield" /><span>{parsed.error.line ? `Line ${parsed.error.line}, column ${parsed.error.column}: ` : ''}{parsed.error.message}{parsed.error.line && <> <button type="button" className={styles.linkButton} onClick={jumpToError}>Go to line</button></>}</span></p>}
      {serverError && <div className={styles.error} role="alert"><Icon name="shield" /><div>
        <p>{serverError.message}{serverError.conflict && <> <button type="button" className={styles.linkButton} onClick={() => load()}>Load the latest version</button> (your edits will be replaced).</>}</p>
        {serverError.fields && <ul>{Object.entries(serverError.fields).map(([field, message]) => <li key={field}><code>{field === '_' ? 'content' : field}</code> {message}</li>)}</ul>}
      </div></div>}
      {notice && <p className={styles.success} role="status"><Icon name="check" />{notice}</p>}
    </form>

    <section className={styles.panel} aria-labelledby="history-title">
      <div className={styles.toolbar}>
        <h3 id="history-title">Previous versions</h3>
        <button type="button" className="button button--outline" onClick={() => setConfirm({ type: 'reset' })} disabled={busy}><Icon name="refresh" />Reset to default</button>
      </div>
      {item.history.length ? <ol className={styles.history}>{item.history.map((version) => <li key={version.index}>
        <div><strong>{formatWhen(version.updatedAt)}</strong><small>{version.updatedBy || 'Default content'} · {formatSize(version.size)}</small></div>
        <details><summary>View</summary><pre className={styles.code}>{pretty(version.data)}</pre></details>
        <button type="button" className="button button--ghost" onClick={() => setConfirm({ type: 'restore', version })} disabled={busy}>Restore</button>
      </li>)}</ol> : <p className={styles.muted}>No earlier versions yet. Each save keeps the previous version here (last five).</p>}
    </section>

    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.type === 'reset' ? 'Reset to default content?' : 'Restore this version?'}>
      <p className={styles.dialogText}>{confirm?.type === 'reset'
        ? `“${item.label}” will be replaced with the original default copy. The current version is kept in Previous versions.`
        : `The version saved ${formatWhen(confirm?.version?.updatedAt)} becomes live. The current version is kept in Previous versions.`}
      {dirty && ' Unsaved edits in the editor will be lost.'}</p>
      <div className={styles.dialogActions}>
        <button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>Cancel</button>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => confirm.type === 'reset'
          ? run(() => api(`/admin/content/${contentKey}/reset`, { method: 'POST' }), 'Reset to the default content.')
          : run(() => api(`/admin/content/${contentKey}/restore`, { method: 'POST', body: { index: confirm.version.index } }), 'Version restored.')}>{confirm?.type === 'reset' ? 'Reset' : 'Restore'}</button>
      </div>
    </Dialog>
  </div>;
}
